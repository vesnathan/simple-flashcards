import { DynamoDBClient, DeleteTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, ListFunctionsCommand, DeleteFunctionCommand } from "@aws-sdk/client-lambda";
import { APIGatewayClient, DeleteRestApiCommand, GetRestApisCommand } from "@aws-sdk/client-api-gateway";
import { CONFIG } from "../config/aws";

const dynamodb = new DynamoDBClient({ region: "ap-southeast-2", profile: "flashcards-dev" });
const lambda = new LambdaClient({ region: "ap-southeast-2", profile: "flashcards-dev" });
const apiGateway = new APIGatewayClient({ region: "ap-southeast-2", profile: "flashcards-dev" });

async function cleanupDynamoDB() {
  try {
    console.log(`Cleaning up DynamoDB tables for stage: ${CONFIG.STAGE}...`);
    const tables = await dynamodb.send(new ListTablesCommand({}));
    const tablesToDelete = tables.TableNames?.filter(name => 
      name.startsWith(`flashcards-${CONFIG.STAGE}-`)
    ) || [];
    
    for (const tableName of tablesToDelete) {
      console.log(`Deleting table: ${tableName}`);
      await dynamodb.send(new DeleteTableCommand({ TableName: tableName }));
    }
  } catch (error) {
    console.error('Error cleaning up DynamoDB:', error);
  }
}

async function cleanupLambda() {
  try {
    console.log(`Cleaning up Lambda functions for stage: ${CONFIG.STAGE}...`);
    const functions = await lambda.send(new ListFunctionsCommand({}));
    const functionsToDelete = functions.Functions?.filter(fn => 
      fn.FunctionName?.startsWith(`flashcards-${CONFIG.STAGE}-`)
    ) || [];

    for (const fn of functionsToDelete) {
      if (fn.FunctionName) {
        console.log(`Deleting function: ${fn.FunctionName}`);
        await lambda.send(new DeleteFunctionCommand({ 
          FunctionName: fn.FunctionName 
        }));
      }
    }
  } catch (error) {
    console.error('Error cleaning up Lambda:', error);
  }
}

async function cleanupAPIGateway() {
  try {
    console.log(`Cleaning up API Gateway for stage: ${CONFIG.STAGE}...`);
    const apis = await apiGateway.send(new GetRestApisCommand({}));
    const apisToDelete = apis.items?.filter(api => 
      api.name?.startsWith(`flashcards-${CONFIG.STAGE}-`)
    ) || [];

    for (const api of apisToDelete) {
      if (api.id) {
        console.log(`Deleting API: ${api.name}`);
        await apiGateway.send(new DeleteRestApiCommand({ 
          restApiId: api.id 
        }));
      }
    }
  } catch (error) {
    console.error('Error cleaning up API Gateway:', error);
  }
}

async function cleanup() {
  try {
    console.log('Starting cleanup...');
    await Promise.all([
      cleanupDynamoDB(),
      cleanupLambda(),
      cleanupAPIGateway()
    ]);
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

cleanup();
