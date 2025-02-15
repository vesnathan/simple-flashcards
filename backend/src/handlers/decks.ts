/* eslint-disable no-console */
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

import { dynamodbService } from "../services/dynamodb";

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));
const TABLE_NAME = process.env.DECKS_TABLE || "";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID || "",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
};

// Add structured logging helper
const log = {
  info: (message: string, data?: any) => {
    console.log(
      JSON.stringify({
        level: "INFO",
        timestamp: new Date().toISOString(),
        message,
        data,
      }),
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      JSON.stringify({
        level: "ERROR",
        timestamp: new Date().toISOString(),
        message,
        error: error?.message || error,
        stack: error?.stack,
      }),
    );
  },
};

// Define custom error class
class LambdaError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.name = "LambdaError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const getDecks = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;

  log.info(`Starting request processing`, { requestId });

  try {
    const auth = event.headers.Authorization || event.headers.authorization;
    const userId = event.queryStringParameters?.userId;

    // If userId is provided, verify auth token
    if (userId) {
      if (!auth?.startsWith("Bearer ")) {
        log.error(`Invalid auth header`, { requestId, auth });

        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Authentication required" }),
        };
      }

      const token = auth.split(" ")[1];

      try {
        await verifier.verify(token);
        log.info(`Token verified`, { requestId, userId });
      } catch (error) {
        log.error(`Token verification failed`, {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new LambdaError("Invalid token", 401);
      }

      // Get user's decks
      log.info(`Fetching user decks`, { requestId, userId });
      const userDecks = await dynamodb.query({
        TableName: TABLE_NAME,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(userDecks.Items || []),
      };
    }

    // If no userId, return public decks
    log.info(`Fetching system decks`, { requestId });
    const publicDecks = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: "userId = :systemId",
      ExpressionAttributeValues: {
        ":systemId": "system",
      },
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(publicDecks.Items || []),
    };
  } catch (error) {
    if (error instanceof LambdaError) {
      log.error(`Known error occurred`, {
        requestId,
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
      });

      return {
        statusCode: error.statusCode || 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: error.message }),
      };
    }

    log.error(`Unhandled error`, {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Internal server error",
        requestId,
      }),
    };
  }
};

// Update getDeck handler to use logging too
export const getDeck: APIGatewayProxyHandler = async (event) => {
  const requestId = event.requestContext.requestId;

  try {
    const id = event.pathParameters?.id;

    if (!id) {
      log.error(`Missing deck ID`, { requestId });

      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Deck ID is required" }),
      };
    }

    log.info(`Fetching deck`, { requestId, deckId: id });
    const deck = await dynamodbService.getDeckById(id);

    if (!deck) {
      log.error(`Deck not found`, { requestId, deckId: id });

      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Deck not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(deck),
    };
  } catch (error) {
    log.error(`Error fetching deck`, { requestId, error });

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Error fetching deck" }),
    };
  }
};
