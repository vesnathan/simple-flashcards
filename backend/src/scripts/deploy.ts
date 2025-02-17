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
  DeleteRestApiCommand,
  CreateStageCommand,
  DeleteStageCommand,
  GetMethodCommand,
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

interface ApiGatewayResource {
  id: string;
  restApiId: string;
}

async function deployLambda(authConfig: AuthConfig) {
  console.log("Creating IAM role...");
  const roleArn = await iamService.createLambdaRole();

  if (!CONFIG.ACCOUNT_ID) {
    throw new Error("ACCOUNT_ID is required in configuration");
  }

  console.log("Created role:", roleArn);
  const zipFile = readFileSync(join(__dirname, "../../dist/functions.zip"));

  // Declare all function names at the start
  const getFunctionName = `flashcards-${CONFIG.STAGE}-getDecks`;
  const syncFunctionName = `flashcards-${CONFIG.STAGE}-syncDeck`;
  const userDecksFunctionName = `flashcards-${CONFIG.STAGE}-userDecks`;

  const environmentVariables = {
    DECKS_TABLE: CONFIG.DECKS_TABLE,
    STAGE: CONFIG.STAGE,
    ACCOUNT_ID: CONFIG.ACCOUNT_ID,
    APP_REGION: CONFIG.REGION,
    COGNITO_USER_POOL_ID: authConfig.userPoolId,
    COGNITO_CLIENT_ID: authConfig.clientId,
  } as Record<string, string>;

  try {
    // Create/update get function with correct handler path
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: getFunctionName,
        Runtime: "nodejs18.x",
        Handler: "decks.handler", // Changed from handlers/decks.handler
        Role: roleArn,
        Code: { ZipFile: zipFile },
        Environment: {
          Variables: environmentVariables,
        },
      }),
    );

    // Deploy user-decks function
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: userDecksFunctionName,
        Runtime: "nodejs18.x",
        Handler: "userDecks.handler",
        Role: roleArn,
        Code: { ZipFile: zipFile },
        Environment: { Variables: environmentVariables },
      }),
    );

    // Create/update sync function with correct handler path
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: syncFunctionName,
        Runtime: "nodejs18.x",
        Handler: "sync.syncDeck", // Changed from handlers/sync.syncDeck
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
      userDecksFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${userDecksFunctionName}`,
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
        userDecksFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${userDecksFunctionName}`,
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

async function waitForApiDeletion(existingApiId: string) {
  console.log("Waiting for API Gateway deletion to complete...");
  let retries = 0;
  const maxRetries = 30; // Increased from 20 to 30

  while (retries < maxRetries) {
    try {
      // Check if API still exists
      const apis = await apiGateway.send(
        new GetRestApisCommand({
          limit: 100,
        }),
      );

      const existingApi = apis.items?.find((api) => api.id === existingApiId);

      if (!existingApi) {
        console.log(
          "API Gateway deleted, waiting for resources to clean up...",
        );
        await new Promise((resolve) => setTimeout(resolve, 30000)); // Reduced from 60s to 30s

        return;
      }

      // Check if resources are still being deleted
      try {
        await apiGateway.send(
          new GetResourcesCommand({
            restApiId: existingApiId,
          }),
        );
        // If we can still get resources, they're not deleted yet
        console.log("Resources still exist, waiting...");
      } catch (resourceError: any) {
        if (resourceError.name === "NotFoundException") {
          console.log("All resources deleted successfully");
          // Wait additional time after resources are gone
          await new Promise((resolve) => setTimeout(resolve, 30000));

          return;
        }
      }
    } catch (error) {
      console.log("Error checking API/resource status:", error);
    }

    console.log(
      `Waiting for deletion (attempt ${retries + 1}/${maxRetries})...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Reduced from 20s to 10s
    retries++;
  }

  throw new Error("Timed out waiting for API Gateway deletion");
}

async function createApiResources(
  api: { id: string },
  rootResourceId: string,
): Promise<Record<string, ApiGatewayResource>> {
  // Add delay before creating resources
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Create resources one by one with delay between
  const resources: Record<string, any> = {};

  const resourceConfigs = {
    decks: { pathPart: "decks" },
    public: { pathPart: "public" },
    userDecks: { pathPart: "user-decks" },
    proxy: { pathPart: "{proxy+}" },
  };

  for (const [key, config] of Object.entries(resourceConfigs)) {
    try {
      console.log(`Creating resource: ${key}`);
      const resource = await apiGateway.send(
        new CreateResourceCommand({
          restApiId: api.id,
          parentId: rootResourceId,
          pathPart: config.pathPart,
        }),
      );

      if (!resource.id) {
        throw new Error(`Failed to create ${key} resource - no ID returned`);
      }

      resources[key] = {
        id: resource.id,
        restApiId: api.id,
      };

      // Add delay between resource creation
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (error: any) {
      if (error.name === "ConflictException") {
        console.log(`Resource ${key} already exists, skipping...`);
        continue;
      }
      throw error;
    }
  }

  return resources;
}

async function deployAPI(
  functionArn: string,
  userDecksFunctionArn: string,
  syncFunctionArn: string,
): Promise<string> {
  console.log("Starting API Gateway deployment...");

  // Find and delete existing API
  const existingApiId = await findExistingApi();

  if (existingApiId) {
    console.log("Found existing API, deleting...");
    try {
      await apiGateway.send(
        new DeleteRestApiCommand({ restApiId: existingApiId }),
      );
      await waitForApiDeletion(existingApiId);

      // Add extra safety delay after deletion
      console.log("Adding extra delay for AWS to clean up resources...");
      await new Promise((resolve) => setTimeout(resolve, 60000)); // 1 minute
    } catch (error) {
      console.error("Error deleting existing API:", error);
      throw error;
    }
  }

  // Add delay before creating new API
  console.log("Waiting before creating new API...");
  await new Promise((resolve) => setTimeout(resolve, 30000));

  console.log("Creating new API Gateway...");
  try {
    const apiResponse = await apiGateway.send(
      new CreateRestApiCommand({
        name: `flashcards-${CONFIG.STAGE}-api`,
        description: "Flashcards API",
      }),
    );

    if (!apiResponse.id) {
      throw new Error("Failed to create API Gateway - no API ID returned");
    }

    const api = { id: apiResponse.id };

    // Add delay after API creation
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Get root resource id with type checking
    const resources = await apiGateway.send(
      new GetResourcesCommand({
        restApiId: api.id,
      }),
    );

    const rootResourceId = resources.items?.[0]?.id;

    if (!rootResourceId) {
      throw new Error("Failed to get root resource ID");
    }

    // Create all resources first
    console.log("Creating API resources...");
    const apiResources = await createApiResources(api, rootResourceId);

    // Add delay before adding methods
    console.log("Waiting before adding methods...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Now add methods to each resource
    console.log("Adding methods to resources...");

    // Add methods to /decks
    await addResourceMethods(api.id, apiResources.decks.id, functionArn, [
      "GET",
      "OPTIONS",
    ]);

    // Add create endpoint
    await addResourceMethods(api.id, apiResources.decks.id, syncFunctionArn, [
      "POST",
      "OPTIONS",
    ]);

    // Add /create endpoint
    const createResource = await apiGateway.send(
      new CreateResourceCommand({
        restApiId: api.id,
        parentId: apiResources.decks.id,
        pathPart: "create",
      }),
    );

    // Add methods to /decks/create
    if (createResource.id) {
      await addResourceMethods(api.id, createResource.id, syncFunctionArn, [
        "POST",
        "OPTIONS",
      ]);
    }

    // Add methods to /public
    await addResourceMethods(api.id, apiResources.public.id, functionArn, [
      "GET",
      "OPTIONS",
    ]);

    // Add methods to /user-decks
    await addResourceMethods(
      api.id,
      apiResources.userDecks.id,
      userDecksFunctionArn,
      ["GET", "OPTIONS"],
    );

    // Add methods to proxy resource
    await addProxyMethods(api.id, apiResources.proxy.id, userDecksFunctionArn);

    // Create deployment without stage name
    console.log("Creating new deployment...");
    const deployment = await apiGateway.send(
      new CreateDeploymentCommand({
        restApiId: api.id,
        description: `Deployment for ${CONFIG.STAGE}`,
      }),
    );

    if (!deployment.id) {
      throw new Error("Failed to create deployment - no ID returned");
    }

    // Add delay after deployment
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Delete existing stage if it exists
    try {
      console.log(`Attempting to delete existing stage: ${CONFIG.STAGE}`);
      await apiGateway.send(
        new DeleteStageCommand({
          restApiId: api.id,
          stageName: CONFIG.STAGE,
        }),
      );
      // Add delay after deletion
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } catch (error: any) {
      if (error.name !== "NotFoundException") {
        console.log("Stage deletion result:", error.name);
      }
    }

    // Create new stage
    console.log("Creating new stage...");
    await apiGateway.send(
      new CreateStageCommand({
        restApiId: api.id,
        stageName: CONFIG.STAGE,
        deploymentId: deployment.id,
        variables: {
          stage: CONFIG.STAGE,
        },
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

async function addResourceMethods(
  apiId: string,
  resourceId: string,
  functionArn: string,
  methods: string[],
) {
  for (const method of methods) {
    try {
      // Check if method already exists
      try {
        await apiGateway.send(
          new GetMethodCommand({
            restApiId: apiId,
            resourceId: resourceId,
            httpMethod: method,
          }),
        );
        console.log(
          `Method ${method} already exists for resource ${resourceId}, skipping...`,
        );
        continue;
      } catch (error: any) {
        if (error.name !== "NotFoundException") {
          throw error;
        }
      }

      // Method doesn't exist, create it
      if (method === "OPTIONS") {
        await addOptionsMethod(apiId, resourceId);
      } else {
        await addProxyMethod(apiId, resourceId, method, functionArn);
      }
      // Add longer delay between methods
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Failed to add method ${method}:`, error);
      throw error;
    }
  }
}

async function addOptionsMethod(apiId: string, resourceId: string) {
  await apiGateway.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: "OPTIONS",
      authorizationType: "NONE",
      apiKeyRequired: false,
    }),
  );

  await apiGateway.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: "OPTIONS",
      type: "MOCK",
      requestTemplates: {
        "application/json": '{ "statusCode": 200 }',
      },
    }),
  );

  await apiGateway.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: "OPTIONS",
      statusCode: "200",
      responseParameters: {
        "method.response.header.Access-Control-Allow-Origin": true,
        "method.response.header.Access-Control-Allow-Methods": true,
        "method.response.header.Access-Control-Allow-Headers": true,
      },
    }),
  );

  await apiGateway.send(
    new PutIntegrationResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
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
}

async function addProxyMethod(
  apiId: string,
  resourceId: string,
  method: string,
  functionArn: string,
) {
  await apiGateway.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: method,
      authorizationType: "NONE",
      apiKeyRequired: false,
    }),
  );

  await apiGateway.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: method,
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${CONFIG.REGION}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
    }),
  );
}

async function addProxyMethods(
  apiId: string,
  resourceId: string,
  functionArn: string,
) {
  await addOptionsMethod(apiId, resourceId);

  // Add ANY method
  await apiGateway.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: "ANY",
      authorizationType: "NONE",
      apiKeyRequired: false,
      requestParameters: {
        "method.request.path.proxy": true, // Add this line
      },
    }),
  );

  // Update integration with correct parameter mapping
  await apiGateway.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: "ANY",
      type: "AWS_PROXY",
      integrationHttpMethod: "POST",
      uri: `arn:aws:apigateway:${CONFIG.REGION}:lambda:path/2015-03-31/functions/${functionArn}/invocations`,
      passthroughBehavior: "WHEN_NO_MATCH",
      requestParameters: {
        "integration.request.path.proxy": "method.request.path.proxy",
      },
      timeoutInMillis: 29000, // Add timeout
    }),
  );
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
NEXT_PUBLIC_API_STAGE=${CONFIG.STAGE}
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
  const userDecksFunctionName = `flashcards-${CONFIG.STAGE}-userDecks`;

  const environmentVariables = {
    DECKS_TABLE: CONFIG.DECKS_TABLE,
    STAGE: CONFIG.STAGE,
    ACCOUNT_ID: CONFIG.ACCOUNT_ID,
    APP_REGION: CONFIG.REGION,
    COGNITO_USER_POOL_ID: authConfig.userPoolId || "",
    COGNITO_CLIENT_ID: authConfig.clientId || "",
  } as Record<string, string>;

  // Update all functions
  for (const functionName of [
    getFunctionName,
    syncFunctionName,
    userDecksFunctionName,
  ]) {
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
      if (error.name === "ResourceNotFoundException") {
        console.log(`Creating new function: ${functionName}`);
        await lambda.send(
          new CreateFunctionCommand({
            FunctionName: functionName,
            Runtime: "nodejs18.x",
            Handler: functionName.includes("userDecks")
              ? "userDecks.handler"
              : functionName.includes("sync")
                ? "sync.syncDeck"
                : "decks.handler",
            Role: await iamService.createLambdaRole(),
            Code: { ZipFile: zipFile },
            Environment: { Variables: environmentVariables },
          }),
        );
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
    const { getFunctionArn, userDecksFunctionArn, syncFunctionArn } =
      await deployLambda(authConfig);

    // Deploy API Gateway with function integrations
    const apiId = await deployAPI(
      getFunctionArn,
      userDecksFunctionArn,
      syncFunctionArn,
    );

    if (!apiId) throw new Error("Failed to get API ID");

    // Write frontend config
    await writeEnvFile(apiId, authConfig);

    // Update Lambda functions with latest code and config
    const zipFile = readFileSync(join(__dirname, "../../dist/functions.zip"));

    await updateExistingFunctions(zipFile, authConfig);

    // Function names
    const getFunctionName = `flashcards-${CONFIG.STAGE}-getDecks`;
    const syncFunctionName = `flashcards-${CONFIG.STAGE}-syncDeck`;
    const userDecksFunctionName = `flashcards-${CONFIG.STAGE}-userDecks`;

    // Add Lambda permissions after functions are created/updated
    console.log("Adding Lambda permissions...");
    for (const functionName of [
      getFunctionName,
      syncFunctionName,
      userDecksFunctionName,
    ]) {
      try {
        await addLambdaPermission(functionName);
      } catch (error: any) {
        console.error(
          `Failed to add permission for ${functionName}:`,
          error.message,
        );
        // Continue with other functions even if one fails
      }
    }

    console.log("Deployment successful");
    console.log(
      "API URL:",
      `https://${apiId}.execute-api.${CONFIG.REGION}.amazonaws.com/${CONFIG.STAGE}/decks`,
    );
    console.log("User Pool ID:", authConfig.userPoolId);
    console.log("Client ID:", authConfig.clientId);

    if (tableWasCreated) {
      console.log("New table created, running seed...");
      await dynamodbService.seedTable();
      console.log("Database seeded successfully");
    }

    console.log("Deployment completed successfully");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

deploy();
