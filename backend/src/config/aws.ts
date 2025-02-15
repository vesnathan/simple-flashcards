/* eslint-disable no-console */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayClient } from "@aws-sdk/client-api-gateway";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";

// Load env vars only for local development and deployment scripts
if (!process.env.LAMBDA_TASK_ROOT) {
  require("./env").loadEnv();
}

const region = "ap-southeast-2";
const profile = process.env.AWS_PROFILE || "flashcards-dev";
const stage = process.env.STAGE || "dev";

const clientConfig = {
  region,
  profile: process.env.LAMBDA_TASK_ROOT ? undefined : profile, // Don't use profile in Lambda
};

export const dynamoDB = new DynamoDBClient(clientConfig);
export const apiGateway = new APIGatewayClient(clientConfig);
export const lambda = new LambdaClient(clientConfig);
export const cloudFront = new CloudFrontClient(clientConfig);

export const CONFIG = {
  DECKS_TABLE: `flashcards-${stage}-decks`,
  STAGE: stage,
  REGION: region,
  ACCOUNT_ID: process.env.AWS_ACCOUNT_ID, // Make this optional
};
