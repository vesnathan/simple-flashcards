/* eslint-disable no-console */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  AddPermissionCommand,
  UpdateFunctionConfigurationCommand,
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
  UpdateStageCommand,
  PutMethodResponseCommand,
  PutIntegrationResponseCommand,
} from "@aws-sdk/client-api-gateway";
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";

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
const cloudWatchLogs = new CloudWatchLogsClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

interface AuthConfig {
  userPoolId: string | undefined;
  clientId: string | undefined;
}

async function deployLambda(authConfig: AuthConfig) {
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
    COGNITO_USER_POOL_ID: authConfig.userPoolId,
    COGNITO_CLIENT_ID: authConfig.clientId,
  } as Record<string, string>;

  try {
    // Create/update get function
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: getFunctionName,
        Runtime: "nodejs18.x",
        Handler: "handlers/decks.getDecks", // Fix handler path
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
        Handler: "handlers/sync.syncDeck", // Fix handler path
        Role: roleArn,
        Code: { ZipFile: zipFile },
        Environment: {
          Variables: environmentVariables,
        },
        Timeout: 30, // Increase timeout to 30 seconds
        MemorySize: 256, // Increase memory if needed
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

  try {
    // Add OPTIONS method with mock integration
    await apiGateway.send(
      new PutMethodCommand({
        restApiId: api.id,
        resourceId: resource.id,
        httpMethod: "OPTIONS",
        authorizationType: "NONE",
        apiKeyRequired: false,
      }),
    );

    // Configure mock integration for OPTIONS
    await apiGateway.send(
      new PutIntegrationCommand({
        restApiId: api.id,
        resourceId: resource.id,
        httpMethod: "OPTIONS",
        type: "MOCK",
        requestTemplates: {
          "application/json": '{ "statusCode": 200 }',
        },
      }),
    );

    // Add method response for OPTIONS
    await apiGateway.send(
      new PutMethodResponseCommand({
        restApiId: api.id,
        resourceId: resource.id,
        httpMethod: "OPTIONS",
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Origin": true,
          "method.response.header.Access-Control-Allow-Methods": true,
          "method.response.header.Access-Control-Allow-Headers": true,
        },
      }),
    );

    // Add integration response for OPTIONS
    await apiGateway.send(
      new PutIntegrationResponseCommand({
        restApiId: api.id,
        resourceId: resource.id,
        httpMethod: "OPTIONS",
        statusCode: "200",
        responseParameters: {
          "method.response.header.Access-Control-Allow-Origin": "'*'",
          "method.response.header.Access-Control-Allow-Methods":
            "'GET,POST,OPTIONS'",
          "method.response.header.Access-Control-Allow-Headers":
            "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        },
      }),
    );

    // Add GET method with proxy integration
    await apiGateway.send(
      new PutMethodCommand({
        restApiId: api.id,
        resourceId: resource.id,
        httpMethod: "GET",
        authorizationType: "NONE",
        apiKeyRequired: false,
      }),
    );

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

    // Add POST method with proxy integration
    await apiGateway.send(
      new PutMethodCommand({
        restApiId: api.id,
        resourceId: resource.id,
        httpMethod: "POST",
        authorizationType: "NONE",
        apiKeyRequired: false,
      }),
    );

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

    // Enable logging
    await enableApiGatewayLogging(api.id);

    return api.id;
  } catch (error) {
    console.error("Failed to create API Gateway resources:", error);
    throw error;
  }
}

async function enableApiGatewayLogging(apiId: string) {
  console.log("Enabling API Gateway logging...");

  const logGroupName = `/aws/apigateway/flashcards-${CONFIG.STAGE}`;

  try {
    await cloudWatchLogs.send(
      new CreateLogGroupCommand({
        logGroupName,
      }),
    );
    console.log("Created CloudWatch log group:", logGroupName);
  } catch (error: any) {
    console.log("Log group creation result:", error.name);
  }

  try {
    // Update stage settings to enable logging
    await apiGateway.send(
      new UpdateStageCommand({
        restApiId: apiId,
        stageName: CONFIG.STAGE,
        patchOperations: [
          {
            op: "replace",
            path: "/*/*/logging/dataTrace",
            value: "true",
          },
          {
            op: "replace",
            path: "/*/*/logging/loglevel",
            value: "INFO",
          },
          {
            op: "replace",
            path: "/accessLogSettings/destinationArn",
            value: `arn:aws:logs:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:log-group:${logGroupName}`,
          },
          {
            op: "replace",
            path: "/accessLogSettings/format",
            value: JSON.stringify({
              requestId: "$context.requestId",
              ip: "$context.identity.sourceIp",
              caller: "$context.identity.caller",
              user: "$context.identity.user",
              requestTime: "$context.requestTime",
              httpMethod: "$context.httpMethod",
              resourcePath: "$context.resourcePath",
              status: "$context.status",
              protocol: "$context.protocol",
              responseLength: "$context.responseLength",
              error: "$context.error.message",
            }),
          },
        ],
      }),
    );

    console.log("API Gateway logging settings updated");
  } catch (error: any) {
    console.error("Failed to enable API Gateway logging:", error);
  }
}

async function addLambdaPermission(functionName: string) {
  console.log(`Adding Lambda permission for function: ${functionName}`);
  try {
    await lambda.send(
      new AddPermissionCommand({
        FunctionName: functionName,
        StatementId: `apigateway-invoke-${Date.now()}`, // Make StatementId unique
        Action: "lambda:InvokeFunction",
        Principal: "apigateway.amazonaws.com",
        SourceArn: `arn:aws:execute-api:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:*/*/*/*`,
      }),
    );
    console.log(`Lambda permission added successfully for ${functionName}`);
  } catch (error: any) {
    if (error.name === "ResourceConflictException") {
      console.log(`Lambda permission already exists for ${functionName}`);

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

async function updateExistingFunctions(
  zipFile: Buffer,
  authConfig: AuthConfig,
) {
  const getFunctionName = `flashcards-${CONFIG.STAGE}-getDecks`;
  const syncFunctionName = `flashcards-${CONFIG.STAGE}-syncDeck`;

  const environmentVariables = {
    DECKS_TABLE: CONFIG.DECKS_TABLE,
    STAGE: CONFIG.STAGE,
    ACCOUNT_ID: CONFIG.ACCOUNT_ID,
    APP_REGION: CONFIG.REGION,
    COGNITO_USER_POOL_ID: authConfig.userPoolId || "",
    COGNITO_CLIENT_ID: authConfig.clientId || "",
  } as Record<string, string>;

  // Update both functions
  for (const functionName of [getFunctionName, syncFunctionName]) {
    console.log(`Updating function: ${functionName}`);

    try {
      await lambda.send(
        new UpdateFunctionCodeCommand({
          FunctionName: functionName,
          ZipFile: zipFile,
        }),
      );

      // Also update environment variables
      await lambda.send(
        new UpdateFunctionConfigurationCommand({
          FunctionName: functionName,
          Environment: {
            Variables: environmentVariables,
          },
        }),
      );

      console.log(`Successfully updated ${functionName}`);
    } catch (error: any) {
      if (error.name === "ResourceConflictException") {
        console.log(`Skipping ${functionName} - update already in progress`);
        continue;
      }
      console.error(`Failed to update ${functionName}:`, error);
      throw error;
    }
  }
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
    const { getFunctionArn, syncFunctionArn } = await deployLambda(authConfig);

    // Deploy API Gateway with both function integrations
    const apiId = await deployAPI(getFunctionArn, syncFunctionArn);

    if (!apiId) throw new Error("Failed to get API ID");

    // Write all config to frontend .env
    await writeEnvFile(apiId, authConfig);

    // Add Lambda permissions for both functions
    const getFunctionName = `flashcards-${CONFIG.STAGE}-getDecks`;
    const syncFunctionName = `flashcards-${CONFIG.STAGE}-syncDeck`;

    await addLambdaPermission(getFunctionName);
    await addLambdaPermission(syncFunctionName);

    // Update both Lambda functions with latest code and config
    const zipFile = readFileSync(join(__dirname, "../../dist/functions.zip"));

    await updateExistingFunctions(zipFile, authConfig);

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
