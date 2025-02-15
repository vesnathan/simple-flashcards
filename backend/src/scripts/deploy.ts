/* eslint-disable no-console */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  AddPermissionCommand,
} from "@aws-sdk/client-lambda";
import {
  APIGatewayClient,
  CreateRestApiCommand,
  CreateResourceCommand,
  PutMethodCommand,
  PutIntegrationCommand,
  CreateDeploymentCommand,
  GetResourcesCommand,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";

import { dynamodbService } from "../services/dynamodb";
import { iamService } from "../services/iam";
import { CONFIG } from "../config/aws";
import { cognitoService } from "../services/cognito";

const lambda = new LambdaClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});
const apiGateway = new APIGatewayClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

interface AuthConfig {
  userPoolId: string | undefined;
  clientId: string | undefined;
}

async function deployLambda() {
  console.log("Creating IAM role...");
  const roleArn = await iamService.createLambdaRole();

  if (!CONFIG.ACCOUNT_ID) {
    throw new Error("ACCOUNT_ID is required in configuration");
  }

  console.log("Created role:", roleArn);
  const zipFile = readFileSync(join(__dirname, "../../dist/functions.zip"));

  // Deploy main function
  const getFunctionName = `flashcards-${CONFIG.STAGE}-getDecks`;
  const syncFunctionName = `flashcards-${CONFIG.STAGE}-syncDeck`;

  const environmentVariables = {
    DECKS_TABLE: CONFIG.DECKS_TABLE,
    STAGE: CONFIG.STAGE,
    ACCOUNT_ID: CONFIG.ACCOUNT_ID,
    APP_REGION: CONFIG.REGION,
  };

  try {
    // Create/update get function
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: getFunctionName,
        Runtime: "nodejs18.x",
        Handler: "decks.getDecks",
        Role: roleArn,
        Code: { ZipFile: zipFile },
        Environment: {
          Variables: environmentVariables,
        },
      }),
    );

    // Create/update sync function
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: syncFunctionName,
        Runtime: "nodejs18.x",
        Handler: "sync.syncDeck",
        Role: roleArn,
        Code: { ZipFile: zipFile },
        Environment: {
          Variables: environmentVariables,
        },
      }),
    );

    return {
      getFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${getFunctionName}`,
      syncFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${syncFunctionName}`,
    };
  } catch (error: any) {
    if (error.name === "ResourceConflictException") {
      console.log("Updating existing Lambda function...");
      await lambda.send(
        new UpdateFunctionCodeCommand({
          FunctionName: getFunctionName,
          ZipFile: zipFile,
        }),
      );
      console.log("Lambda function updated successfully");

      return {
        getFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${getFunctionName}`,
        syncFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${syncFunctionName}`,
      };
    } else {
      throw error;
    }
  }
}

async function findExistingApi(): Promise<string | undefined> {
  const apis = await apiGateway.send(new GetRestApisCommand({}));
  const existingApi = apis.items?.find(
    (api) => api.name === `flashcards-${CONFIG.STAGE}-api`,
  );

  return existingApi?.id;
}

async function deployAPI(
  functionArn: string,
  syncFunctionArn: string,
): Promise<string> {
  console.log("Checking for existing API...");
  const existingApiId = await findExistingApi();

  if (existingApiId) {
    console.log("Found existing API, reusing API ID:", existingApiId);

    return existingApiId;
  }

  console.log("Creating new API Gateway...");
  const api = await apiGateway.send(
    new CreateRestApiCommand({
      name: `flashcards-${CONFIG.STAGE}-api`,
      description: "Flashcards API",
    }),
  );

  if (!api.id) {
    throw new Error("Failed to create API Gateway - no API ID returned");
  }

  // Get root resource id
  const resources = await apiGateway.send(
    new GetResourcesCommand({
      restApiId: api.id,
    }),
  );
  const rootResourceId = resources.items?.[0].id;

  // Create /decks resource
  const resource = await apiGateway.send(
    new CreateResourceCommand({
      restApiId: api.id,
      parentId: rootResourceId,
      pathPart: "decks",
    }),
  );

  // Create GET method
  await apiGateway.send(
    new PutMethodCommand({
      restApiId: api.id,
      resourceId: resource.id,
      httpMethod: "GET",
      authorizationType: "NONE",
      apiKeyRequired: false,
    }),
  );

  // Add OPTIONS method for CORS
  await apiGateway.send(
    new PutMethodCommand({
      restApiId: api.id,
      resourceId: resource.id,
      httpMethod: "OPTIONS",
      authorizationType: "NONE",
      apiKeyRequired: false,
    }),
  );

  // Integrate with Lambda
  await apiGateway.send(
    new PutIntegrationCommand({
      restApiId: api.id,
      resourceId: resource.id,
      httpMethod: "GET",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${CONFIG.REGION}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
    }),
  );

  // Add Lambda integration for OPTIONS
  await apiGateway.send(
    new PutIntegrationCommand({
      restApiId: api.id,
      resourceId: resource.id,
      httpMethod: "OPTIONS",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${CONFIG.REGION}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
    }),
  );

  // Add POST method for sync
  await apiGateway.send(
    new PutMethodCommand({
      restApiId: api.id,
      resourceId: resource.id,
      httpMethod: "POST",
      authorizationType: "NONE", // We'll handle auth in Lambda
      apiKeyRequired: false,
    }),
  );

  // Add Lambda integration for POST
  await apiGateway.send(
    new PutIntegrationCommand({
      restApiId: api.id,
      resourceId: resource.id,
      httpMethod: "POST",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${CONFIG.REGION}:lambda:path/2015-03-31/functions/${syncFunctionArn}/invocations`,
    }),
  );

  // Create deployment
  await apiGateway.send(
    new CreateDeploymentCommand({
      restApiId: api.id,
      stageName: CONFIG.STAGE,
    }),
  );

  return api.id;
}

async function addLambdaPermission(functionName: string) {
  try {
    // Try to add permission directly without checking if it exists
    await lambda.send(
      new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: "apigateway-invoke",
        Action: "lambda:InvokeFunction",
        Principal: "apigateway.amazonaws.com",
        SourceArn: `arn:aws:execute-api:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:*/*/*/*`,
      }),
    );
    console.log("Lambda permission added successfully");
  } catch (error: any) {
    // If permission already exists, that's fine
    if (error.name === "ResourceConflictException") {
      console.log("Lambda permission already exists");

      return;
    }
    throw error;
  }
}

async function writeEnvFile(apiId: string, authConfig: AuthConfig) {
  if (!authConfig.userPoolId || !authConfig.clientId) {
    throw new Error("Invalid auth configuration");
  }

  const envContent = `
NEXT_PUBLIC_API_URL=https://${apiId}.execute-api.${CONFIG.REGION}.amazonaws.com/${CONFIG.STAGE}/decks
NEXT_PUBLIC_COGNITO_USER_POOL_ID=${authConfig.userPoolId}
NEXT_PUBLIC_COGNITO_CLIENT_ID=${authConfig.clientId}
NEXT_PUBLIC_COGNITO_REGION=${CONFIG.REGION}
`.trim();

  const envPath = join(__dirname, "../../../frontend/.env");

  writeFileSync(envPath, envContent);

  console.log("Frontend configuration saved to .env file");
  console.log(
    "API URL:",
    `https://${apiId}.execute-api.${CONFIG.REGION}.amazonaws.com/${CONFIG.STAGE}/decks`,
  );
}

async function deploy() {
  try {
    console.log("Building Lambda functions...");
    execSync("yarn build", { stdio: "inherit" });

    console.log("Creating DynamoDB table...");
    const tableWasCreated = await dynamodbService.createTable();

    // Set up authentication and validate config
    console.log("Setting up authentication...");
    const authConfig = await cognitoService.setupAuth();

    if (!authConfig.userPoolId || !authConfig.clientId) {
      throw new Error("Failed to setup authentication");
    }

    // Deploy Lambda and get ARNs
    const { getFunctionArn, syncFunctionArn } = await deployLambda();

    // Deploy API Gateway with both function integrations
    const apiId = await deployAPI(getFunctionArn, syncFunctionArn);

    if (!apiId) throw new Error("Failed to get API ID");

    // Write all config to frontend .env
    await writeEnvFile(apiId, authConfig);

    // Add Lambda permission for API Gateway
    const functionName = `flashcards-${CONFIG.STAGE}-getDecks`;

    await addLambdaPermission(functionName);

    console.log("Deployment successful");
    console.log(
      "API URL:",
      `https://${apiId}.execute-api.${CONFIG.REGION}.amazonaws.com/${CONFIG.STAGE}/decks`,
    );
    console.log("User Pool ID:", authConfig.userPoolId);
    console.log("Client ID:", authConfig.clientId);

    if (tableWasCreated) {
      console.log("New table created, seeding database...");
      await import("./seed");
      console.log("Database seeded successfully");
    }

    console.log("Deployment completed successfully");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

deploy();
