/* eslint-disable no-console */
import {
  CloudWatchLogsClient,
  DeleteLogGroupCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  APIGatewayClient,
  DeleteRestApiCommand,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";
import { LambdaClient, DeleteFunctionCommand } from "@aws-sdk/client-lambda";

import { CONFIG } from "../config/aws";

const cloudWatchLogs = new CloudWatchLogsClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

const apiGateway = new APIGatewayClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

const lambda = new LambdaClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

export const cleanupService = {
  async deleteLogGroups() {
    const logGroups = [
      `/aws/lambda/flashcards-${CONFIG.STAGE}-getDecks`,
      `/aws/lambda/flashcards-${CONFIG.STAGE}-syncDeck`,
      `/aws/apigateway/flashcards-${CONFIG.STAGE}`,
    ];

    for (const logGroupName of logGroups) {
      try {
        await cloudWatchLogs.send(new DeleteLogGroupCommand({ logGroupName }));
        console.log(`Deleted log group: ${logGroupName}`);
      } catch (error: any) {
        if (error.name !== "ResourceNotFoundException") {
          console.error(`Failed to delete log group ${logGroupName}:`, error);
        }
      }
    }
  },

  async deleteApiGateway() {
    try {
      const apis = await apiGateway.send(new GetRestApisCommand({}));
      const api = apis.items?.find(
        (api) => api.name === `flashcards-${CONFIG.STAGE}-api`,
      );

      if (api?.id) {
        await apiGateway.send(new DeleteRestApiCommand({ restApiId: api.id }));
        console.log("Deleted API Gateway");
      }
    } catch (error) {
      console.error("Failed to delete API Gateway:", error);
    }
  },

  async deleteLambdaFunctions() {
    const functions = [
      `flashcards-${CONFIG.STAGE}-getDecks`,
      `flashcards-${CONFIG.STAGE}-syncDeck`,
    ];

    for (const functionName of functions) {
      try {
        await lambda.send(
          new DeleteFunctionCommand({ FunctionName: functionName }),
        );
        console.log(`Deleted Lambda function: ${functionName}`);
      } catch (error: any) {
        if (error.name !== "ResourceNotFoundException") {
          console.error(`Failed to delete function ${functionName}:`, error);
        }
      }
    }
  },
};
