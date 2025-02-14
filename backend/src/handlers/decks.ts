import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';
import { dynamodbService } from '../services/dynamodb';

const ddb = DynamoDBDocument.from(new DynamoDB({}));

export const getDecks: APIGatewayProxyHandler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    console.log('Querying table:', process.env.DECKS_TABLE);
    const result = await ddb.scan({
      TableName: process.env.DECKS_TABLE || ''
    });

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Failed to fetch decks' })
    };
  }
};

export const getDeck: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Deck ID is required' }),
      };
    }

    const deck = await dynamodbService.getDeckById(id);
    if (!deck) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Deck not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(deck),
    };
  } catch (error) {
    console.error('Error fetching deck:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error fetching deck' }),
    };
  }
};
