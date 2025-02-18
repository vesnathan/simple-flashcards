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

const clientConfig = {
  region,
  profile: process.env.LAMBDA_TASK_ROOT ? undefined : profile, // Don't use profile in Lambda
};

export const dynamoDB = new DynamoDBClient(clientConfig);
export const apiGateway = new APIGatewayClient(clientConfig);
export const lambda = new LambdaClient(clientConfig);
export const cloudFront = new CloudFrontClient(clientConfig);

function validateEnv() {
  // Only validate in Lambda environment
  if (process.env.LAMBDA_TASK_ROOT) {
    const required = [
      "STAGE",
      "REGION",
      "DECKS_TABLE",
      "COGNITO_USER_POOL_ID",
      "COGNITO_CLIENT_ID",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables in Lambda: ${missing.join(", ")}\nPlease check deployment configuration.`,
      );
    }
  }
}

validateEnv();

export const CONFIG = {
  STAGE: process.env.STAGE || "dev",
  REGION: process.env.REGION || "ap-southeast-2",
  AWS_ACCOUNT_ID: process.env.AWS_ACCOUNT_ID,
  DECKS_TABLE:
    process.env.DECKS_TABLE || `flashcards-${process.env.STAGE || "dev"}-decks`,
  COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
  COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
} as const;
