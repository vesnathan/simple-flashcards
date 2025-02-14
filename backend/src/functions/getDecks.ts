import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { CONFIG } from '../config/aws';

const ddb = DynamoDBDocument.from(new DynamoDBClient({}));

export const handler: APIGatewayProxyHandler = async (event) => {
  const { userId, isPublic } = event.queryStringParameters || {};

  try {
    let params = {
      TableName: CONFIG.DECKS_TABLE,
      ...isPublic === 'true'
        ? {
            IndexName: 'PublicDecksIndex',
            KeyConditionExpression: 'isPublic = :isPublic',
            ExpressionAttributeValues: { ':isPublic': 'true' }
          }
        : {
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': userId }
          }
    };

    const result = await ddb.query(params);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to fetch decks' })
    };
  }
};
