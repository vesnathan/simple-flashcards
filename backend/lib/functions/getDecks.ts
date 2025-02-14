import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocument.from(new DynamoDB({}));

export const handler = async (event: any) => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  const { userId, isPublic } = event.queryStringParameters || {};

  try {
    console.log('Querying table:', process.env.DECKS_TABLE);
    let params;
    if (isPublic === 'true') {
      params = {
        TableName: process.env.DECKS_TABLE,
        IndexName: 'PublicDecksIndex',
        KeyConditionExpression: 'isPublic = :isPublic',
        ExpressionAttributeValues: {
          ':isPublic': 'true'
        }
      };
    } else {
      params = {
        TableName: process.env.DECKS_TABLE,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId
        }
      };
    }

    const result = await ddb.query(params);

    console.log('Query result:', JSON.stringify(result, null, 2));
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result.Items)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch decks' })
    };
  }
};
