/* eslint-disable no-console */
import { dynamodbService } from "../services/dynamodb";
import { cognitoService } from "../services/cognito";
import { cleanupService } from "../services/cleanup";

// Add logging utility
const log = {
  status: (message: string) => {
    process.stdout.write(`${message}...`);
  },
  done: () => {
    process.stdout.write(" done\n");
  },
  error: (message: string, error?: any) => {
    console.error(`✗ ${message}`);
    if (error) console.error(error);
  },
  success: (message: string) => console.log(`\n✨ ${message}\n`),
};

async function cleanup() {
  try {
    log.status("Cleaning up CloudWatch logs");
    await cleanupService.deleteLogGroups();
    log.done();

    log.status("Removing API Gateway");
    await cleanupService.deleteApiGateway();
    log.done();

    log.status("Removing Lambda functions");
    await cleanupService.deleteLambdaFunctions();
    log.done();

    log.status("Removing IAM roles and policies");
    await cleanupService.deleteIamRoles();
    log.done();

    log.status("Removing DynamoDB table");
    await dynamodbService.deleteTable();
    log.done();

    log.status("Removing Cognito resources");
    await cognitoService.cleanup();
    log.done();

    log.success("Cleanup completed successfully");
  } catch (error) {
    log.error("Cleanup failed:", error);
    process.exit(1);
  }
}

cleanup();
