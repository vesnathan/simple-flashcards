import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { APIGatewayClient } from "@aws-sdk/client-api-gateway";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";

const region = "ap-southeast-2";
const profile = process.env.AWS_PROFILE || "flashcards-dev";

const clientConfig = {
  region,
  profile,
};

export const dynamoDB = new DynamoDBClient(clientConfig);
export const apiGateway = new APIGatewayClient(clientConfig);
export const lambda = new LambdaClient(clientConfig);
export const cloudFront = new CloudFrontClient(clientConfig);

if (!process.env.AWS_ACCOUNT_ID) {
  throw new Error("AWS_ACCOUNT_ID environment variable is required");
}

export const CONFIG = {
  DECKS_TABLE: `flashcards-${process.env.STAGE || "dev"}-decks`,
  STAGE: process.env.STAGE || "dev",
  REGION: region,
  ACCOUNT_ID: process.env.AWS_ACCOUNT_ID,
};
