/* eslint-disable no-console */
import { dynamodbService } from "../services/dynamodb";
import { cognitoService } from "../services/cognito";
import { cleanupService } from "../services/cleanup";

async function cleanup() {
  try {
    console.log("Starting cleanup...");

    // Delete CloudWatch log groups
    console.log("Deleting CloudWatch logs...");
    await cleanupService.deleteLogGroups();

    // Delete API Gateway
    console.log("Deleting API Gateway...");
    await cleanupService.deleteApiGateway();

    // Delete Lambda functions
    console.log("Deleting Lambda functions...");
    await cleanupService.deleteLambdaFunctions();

    // Delete DynamoDB table
    console.log("Deleting DynamoDB table...");
    await dynamodbService.deleteTable();

    // Delete Cognito resources
    console.log("Deleting Cognito resources...");
    await cognitoService.cleanup();

    console.log("Cleanup completed successfully");
  } catch (error) {
    console.error("Cleanup failed:", error);
    process.exit(1);
  }
}

cleanup();
