/* eslint-disable no-console */
import { readFileSync } from "fs";
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
} from "@aws-sdk/client-api-gateway";

import { dynamodbService } from "../services/dynamodb";
import { iamService } from "../services/iam";
import { CONFIG } from "../config/aws";

const lambda = new LambdaClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});
const apiGateway = new APIGatewayClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

async function deployLambda() {
  console.log("Creating IAM role...");
  const roleArn = await iamService.createLambdaRole();

  console.log("Created role:", roleArn);

  console.log("Deploying Lambda functions...");
  const functionName = `flashcards-${CONFIG.STAGE}-getDecks`;
  const zipFile = readFileSync(join(__dirname, "../../dist/functions.zip"));

  try {
    await lambda.send(
      new CreateFunctionCommand({
        FunctionName: functionName,
        Runtime: "nodejs18.x",
        Handler: "decks.getDecks",
        Role: roleArn,
        Code: { ZipFile: zipFile },
        Environment: {
          Variables: {
            DECKS_TABLE: CONFIG.DECKS_TABLE,
          },
        },
      }),
    );
    console.log("Lambda function created successfully");

    return `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${functionName}`;
  } catch (error: any) {
    if (error.name === "ResourceConflictException") {
      console.log("Updating existing Lambda function...");
      await lambda.send(
        new UpdateFunctionCodeCommand({
          FunctionName: functionName,
          ZipFile: zipFile,
        }),
      );
      console.log("Lambda function updated successfully");

      return `arn:aws:lambda:${CONFIG.REGION}:${CONFIG.ACCOUNT_ID}:function:${functionName}`;
    } else {
      throw error;
    }
  }
}

async function deployAPI(functionArn: string) {
  console.log("Deploying API Gateway...");

  // Create API
  const api = await apiGateway.send(
    new CreateRestApiCommand({
      name: `flashcards-${CONFIG.STAGE}-api`,
      description: "Flashcards API",
    }),
  );

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

  // Create deployment
  await apiGateway.send(
    new CreateDeploymentCommand({
      restApiId: api.id,
      stageName: CONFIG.STAGE,
    }),
  );

  return api.id;
}

async function deploy() {
  try {
    console.log("Building Lambda functions...");
    execSync("yarn build", { stdio: "inherit" });

    console.log("Creating DynamoDB table...");
    await dynamodbService.createTable();

    // Deploy Lambda and get its ARN
    const functionArn = await deployLambda();

    // Deploy API Gateway with Lambda integration
    const apiId = await deployAPI(functionArn);

    // Add Lambda permission for API Gateway
    await lambda.send(
      new AddPermissionCommand({
        FunctionName: `flashcards-${CONFIG.STAGE}-getDecks`,
        StatementId: "apigateway-invoke",
        Action: "lambda:InvokeFunction",
        Principal: "apigateway.amazonaws.com",
      }),
    );

    console.log("Deployment successful");
    console.log(
      "API URL:",
      `https://${apiId}.execute-api.${CONFIG.REGION}.amazonaws.com/${CONFIG.STAGE}/decks`,
    );

    console.log("Deployment successful, seeding database...");
    await import("./seed");

    console.log("Deployment and seeding completed successfully");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

deploy();
