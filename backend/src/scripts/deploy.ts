/* eslint-disable no-console */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  AddPermissionCommand,
  UpdateFunctionConfigurationCommand,
  GetFunctionCommand,
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

interface DeploymentState {
  tableName?: string;
  authConfig?: {
    userPoolId: string;
    clientId: string;
  };
  apiId?: string;
  stage?: string;
}

async function updateEnvFiles(state: DeploymentState) {
  const frontendEnvPath = join(__dirname, "../../../frontend/.env");
  const backendEnvPath = join(__dirname, "../../.env");

  // Only include values that exist
  const frontendContent = [
    state.apiId &&
      `NEXT_PUBLIC_API_URL=https://${state.apiId}.execute-api.${CONFIG.REGION}.amazonaws.com/${CONFIG.STAGE}/decks`,
    state.stage && `NEXT_PUBLIC_API_STAGE=${state.stage}`,
    state.authConfig?.userPoolId &&
      `NEXT_PUBLIC_COGNITO_USER_POOL_ID=${state.authConfig.userPoolId}`,
    state.authConfig?.clientId &&
      `NEXT_PUBLIC_COGNITO_CLIENT_ID=${state.authConfig.clientId}`,
    `NEXT_PUBLIC_COGNITO_REGION=${CONFIG.REGION}`,
  ]
    .filter(Boolean)
    .join("\n");

  const backendContent = [
    state.authConfig?.clientId &&
      `COGNITO_CLIENT_ID=${state.authConfig.clientId}`,
    state.authConfig?.userPoolId &&
      `COGNITO_USER_POOL_ID=${state.authConfig.userPoolId}`,
    state.tableName && `DECKS_TABLE=${state.tableName}`,
    `STAGE=${CONFIG.STAGE}`,
    `REGION=${CONFIG.REGION}`,
    `AWS_ACCOUNT_ID=${CONFIG.AWS_ACCOUNT_ID}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    writeFileSync(frontendEnvPath, frontendContent);
    writeFileSync(backendEnvPath, backendContent);

    console.log("Updated environment files with:", {
      frontend: frontendEnvPath,
      backend: backendEnvPath,
      values: {
        apiId: state.apiId,
        stage: state.stage,
        userPoolId: state.authConfig?.userPoolId,
        clientId: state.authConfig?.clientId,
      },
    });
  } catch (error) {
    console.error("Failed to write environment files:", error);
    throw error;
  }
}

async function deployLambda(authConfig: AuthConfig) {
  console.log("Creating IAM role...");
  const roleArn = await iamService.createLambdaRole();

  if (!CONFIG.AWS_ACCOUNT_ID) {
    throw new Error("AWS_ACCOUNT_ID is required in configuration");
  }

  console.log("Created role:", roleArn);
  const zipFile = readFileSync(join(__dirname, "../../dist/functions.zip"));

  // Declare all function names at the start
  const getFunctionName = `flashcards-${CONFIG.STAGE}-getDecks`;
  const syncFunctionName = `flashcards-${CONFIG.STAGE}-syncDeck`;
  const userDecksFunctionName = `flashcards-${CONFIG.STAGE}-userDecks`;

  const environmentVariables: Record<string, string> = {
    DECKS_TABLE: CONFIG.DECKS_TABLE || "",
    STAGE: CONFIG.STAGE || "dev",
    AWS_ACCOUNT_ID: CONFIG.AWS_ACCOUNT_ID,
    APP_REGION: CONFIG.REGION || "ap-southeast-2",
    COGNITO_USER_POOL_ID: authConfig.userPoolId || "",
    COGNITO_CLIENT_ID: authConfig.clientId || "",
  };

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

    // Create/update sync function with corrected handler path
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: syncFunctionName,
        Runtime: "nodejs18.x",
        Handler: "sync.syncDeck", // Change this line back to the expected handler name
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
      getFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:function:${getFunctionName}`,
      userDecksFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:function:${userDecksFunctionName}`,
      syncFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:function:${syncFunctionName}`,
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
        getFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:function:${getFunctionName}`,
        userDecksFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:function:${userDecksFunctionName}`,
        syncFunctionArn: `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:function:${syncFunctionName}`,
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

    // Add /sync endpoint
    const syncResource = await apiGateway.send(
      new CreateResourceCommand({
        restApiId: api.id,
        parentId: apiResources.decks.id,
        pathPart: "sync",
      }),
    );

    // Add methods to /decks/sync
    if (syncResource.id) {
      await addResourceMethods(api.id, syncResource.id, syncFunctionArn, [
        "POST",
        "OPTIONS",
      ]);
      log.verbose("Added sync endpoint");
    }

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
        "application/json": '{"statusCode": 200}',
      },
      passthroughBehavior: "WHEN_NO_MATCH",
    }),
  );

  await apiGateway.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: "OPTIONS",
      statusCode: "200",
      responseParameters: {
        "method.response.header.Access-Control-Allow-Headers": true,
        "method.response.header.Access-Control-Allow-Methods": true,
        "method.response.header.Access-Control-Allow-Origin": true,
        "method.response.header.Access-Control-Allow-Credentials": true,
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
        "method.response.header.Access-Control-Allow-Headers":
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'",
        "method.response.header.Access-Control-Allow-Methods":
          "'GET,POST,PUT,DELETE,OPTIONS,HEAD,PATCH'",
        "method.response.header.Access-Control-Allow-Origin": "'*'",
        "method.response.header.Access-Control-Allow-Credentials": "'true'",
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
      passthroughBehavior: "WHEN_NO_MATCH",
    }),
  );

  // Add comprehensive CORS headers
  await apiGateway.send(
    new PutMethodResponseCommand({
      restApiId: apiId,
      resourceId: resourceId,
      httpMethod: method,
      statusCode: "200",
      responseParameters: {
        "method.response.header.Access-Control-Allow-Origin": true,
        "method.response.header.Access-Control-Allow-Headers": true,
        "method.response.header.Access-Control-Allow-Methods": true,
        "method.response.header.Access-Control-Allow-Credentials": true,
      },
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
            value: `arn:aws:logs:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:log-group:${logGroupName}`,
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
        SourceArn: `arn:aws:execute-api:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:*/*/*/*`,
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

async function waitForFunction(functionName: string): Promise<void> {
  let retries = 0;
  const maxRetries = 30; // Increased from 10 to 30
  const delay = 5000; // Increased from 3s to 5s

  while (retries < maxRetries) {
    try {
      // Try to get function configuration instead of updating
      await lambda.send(
        new GetFunctionCommand({
          FunctionName: functionName,
        }),
      );

      // If successful and no error, function is ready
      return;
    } catch (error: any) {
      if (error.name === "ResourceConflictException") {
        log.verbose(
          `Function ${functionName} still updating, waiting... (${retries + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        retries++;
      } else if (error.name === "ResourceNotFoundException") {
        // Function doesn't exist yet, no need to wait
        return;
      } else {
        throw error;
      }
    }
  }
  throw new Error(`Timed out waiting for function ${functionName} to be ready`);
}

async function updateExistingFunctions(
  zipFile: Buffer,
  authConfig: AuthConfig,
) {
  const getFunctionName = `flashcards-${CONFIG.STAGE}-getDecks`;
  const syncFunctionName = `flashcards-${CONFIG.STAGE}-syncDeck`;
  const userDecksFunctionName = `flashcards-${CONFIG.STAGE}-userDecks`;

  if (!CONFIG.AWS_ACCOUNT_ID) {
    throw new Error("AWS_ACCOUNT_ID is required for function deployment");
  }

  // Ensure all environment variables are strings
  const environmentVariables: Record<string, string> = {
    DECKS_TABLE: CONFIG.DECKS_TABLE || "",
    STAGE: CONFIG.STAGE || "dev",
    AWS_ACCOUNT_ID: CONFIG.AWS_ACCOUNT_ID,
    APP_REGION: CONFIG.REGION || "ap-southeast-2",
    COGNITO_USER_POOL_ID: authConfig.userPoolId || "",
    COGNITO_CLIENT_ID: authConfig.clientId || "",
  };

  const handlers = {
    [getFunctionName]: "decks.handler",
    [syncFunctionName]: "sync.syncDeck", // Change this line to match
    [userDecksFunctionName]: "userDecks.handler",
  };

  // Update functions sequentially with better error handling
  for (const functionName of Object.keys(handlers)) {
    try {
      log.verbose(`Updating function: ${functionName}`);

      // Wait for any pending updates first
      await waitForFunction(functionName);

      try {
        // Try to update code first
        await lambda.send(
          new UpdateFunctionCodeCommand({
            FunctionName: functionName,
            ZipFile: zipFile,
          }),
        );

        // Wait after code update
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await waitForFunction(functionName);

        // Then update configuration
        await lambda.send(
          new UpdateFunctionConfigurationCommand({
            FunctionName: functionName,
            Handler: handlers[functionName],
            Environment: { Variables: environmentVariables },
          }),
        );

        // Wait for configuration update
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await waitForFunction(functionName);

        log.verbose(`Successfully updated ${functionName}`);
      } catch (updateError: any) {
        if (updateError.name === "ResourceNotFoundException") {
          // Function doesn't exist, create it
          log.verbose(`Creating new function: ${functionName}`);
          await lambda.send(
            new CreateFunctionCommand({
              FunctionName: functionName,
              Runtime: "nodejs18.x",
              Handler: handlers[functionName],
              Role: await iamService.createLambdaRole(),
              Code: { ZipFile: zipFile },
              Environment: { Variables: environmentVariables },
            }),
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
        } else {
          throw updateError;
        }
      }
    } catch (error: any) {
      log.error(`Failed to update ${functionName}:`, error);
      throw error;
    }
  }
}

// Enhanced logging utility with minimal output by default
const isVerbose = process.argv.includes("--verbose");

// Completely silence AWS SDK and debug logs unless verbose
if (!isVerbose) {
  console.debug = () => {};
  console.info = () => {};
  console.log = (message: string) => {
    // Only allow messages that start with our status indicators
    if (
      typeof message === "string" &&
      (message.startsWith("✓") ||
        message.startsWith("✗") ||
        message.startsWith("✨") ||
        message.startsWith("["))
    ) {
      process.stdout.write(message + "\n");
    }
  };
}

const log = {
  info: (message: string) => console.log(`✓ ${message}`),
  step: (message: string) =>
    console.log(`\n[${new Date().toLocaleTimeString()}] ${message}`),
  verbose: (message: string, data?: any) => {
    if (isVerbose) {
      if (data) console.log(`[verbose] ${message}:`, data);
      else console.log(`[verbose] ${message}`);
    }
  },
  error: (message: string, error?: any) => {
    console.error(`✗ ${message}`);
    if (isVerbose && error) console.error(error);
  },
  success: (message: string) => console.log(`\n✨ ${message}\n`),
  status: (message: string) => {
    process.stdout.write(`${message}...`);
  },
  done: () => {
    process.stdout.write(" done\n");
  },
};

async function deploy() {
  try {
    const state: DeploymentState = {
      stage: CONFIG.STAGE,
      tableName: `flashcards-${CONFIG.STAGE}-decks`,
    };

    log.status("Setting up infrastructure");
    const isNewTable = await dynamodbService.createTable();

    if (isNewTable) {
      await dynamodbService.seedTable();
    }
    state.authConfig = await cognitoService.setupAuth();
    log.done();

    log.status("Deploying functions");
    const { getFunctionArn, userDecksFunctionArn, syncFunctionArn } =
      await deployLambda(state.authConfig);
    const zipFile = readFileSync(join(__dirname, "../../dist/functions.zip"));

    await updateExistingFunctions(zipFile, state.authConfig);
    log.done();

    log.status("Configuring API Gateway");
    state.apiId = await deployAPI(
      getFunctionArn,
      userDecksFunctionArn,
      syncFunctionArn,
    );
    await updateEnvFiles(state);
    log.done();

    log.status("Setting up permissions");
    const functionNames = [
      `flashcards-${CONFIG.STAGE}-getDecks`,
      `flashcards-${CONFIG.STAGE}-syncDeck`,
      `flashcards-${CONFIG.STAGE}-userDecks`,
    ];

    for (const functionName of functionNames) {
      await addLambdaPermission(functionName);
    }
    log.done();

    const apiUrl = `https://${state.apiId}.execute-api.${CONFIG.REGION}.amazonaws.com/${CONFIG.STAGE}/decks`;

    log.success(`Deployment completed successfully!\nAPI URL: ${apiUrl}`);
  } catch (error) {
    log.error("Deployment failed", error);
    process.exit(1);
  }
}

// Help message
if (process.argv.includes("--help")) {
  console.log(`
Usage: yarn deploy [options]

Options:
  --verbose    Show detailed deployment logs
  --help       Show this help message
  `);
  process.exit(0);
}

deploy();
