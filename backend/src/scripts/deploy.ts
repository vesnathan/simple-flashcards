import { LambdaClient, CreateFunctionCommand, UpdateFunctionCodeCommand } from "@aws-sdk/client-lambda";
import { APIGatewayClient, CreateRestApiCommand, CreateResourceCommand, PutMethodCommand, PutIntegrationCommand } from "@aws-sdk/client-api-gateway";
import { dynamodbService } from '../services/dynamodb';
import { iamService } from '../services/iam';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CONFIG } from '../config/aws';

const lambda = new LambdaClient({ region: "ap-southeast-2", profile: "flashcards-dev" });
const apiGateway = new APIGatewayClient({ region: "ap-southeast-2", profile: "flashcards-dev" });

async function deployLambda() {
  console.log('Creating IAM role...');
  const roleArn = await iamService.createLambdaRole();
  console.log('Created role:', roleArn);

  console.log('Deploying Lambda functions...');
  const functionName = `flashcards-${CONFIG.STAGE}-getDecks`;
  const zipFile = readFileSync(join(__dirname, '../../dist/functions.zip'));

  try {
    await lambda.send(new CreateFunctionCommand({
      FunctionName: functionName,
      Runtime: 'nodejs18.x',
      Handler: 'decks.getDecks',
      Role: roleArn,
      Code: { ZipFile: zipFile },
      Environment: {
        Variables: {
          DECKS_TABLE: CONFIG.DECKS_TABLE
        }
      }
    }));
    console.log('Lambda function created successfully');
  } catch (error: any) {
    if (error.name === 'ResourceConflictException') {
      console.log('Updating existing Lambda function...');
      await lambda.send(new UpdateFunctionCodeCommand({
        FunctionName: functionName,
        ZipFile: zipFile
      }));
      console.log('Lambda function updated successfully');
    } else {
      throw error;
    }
  }
}

async function deployAPI() {
  console.log('Deploying API Gateway...');
  const api = await apiGateway.send(new CreateRestApiCommand({
    name: `flashcards-${CONFIG.STAGE}-api`,
    description: 'Flashcards API'
  }));

  // Add more API Gateway configuration here
  console.log('API Gateway endpoint:', `https://${api.id}.execute-api.ap-southeast-2.amazonaws.com/${CONFIG.STAGE}`);
}

async function deploy() {
  try {
    console.log('Creating DynamoDB table...');
    await dynamodbService.createTable();

    await deployLambda();
    await deployAPI();

    console.log('Deployment successful, seeding database...');
    await import('./seed');
    
    console.log('Deployment and seeding completed successfully');
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
}

deploy();
