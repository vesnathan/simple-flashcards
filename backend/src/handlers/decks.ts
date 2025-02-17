/* eslint-disable no-console */
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocument.from(new DynamoDB({}));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
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

// Add error type
interface LambdaError extends Error {
  code?: string;
  statusCode?: number;
}

// Export the handler function directly
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const tableName = process.env.DECKS_TABLE;

  log.info("GetDecks invoked", {
    httpMethod: event.httpMethod,
    tableName,
    requestId: context.awsRequestId,
  });

  if (!tableName) {
    log.error("Missing DECKS_TABLE environment variable");

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Server configuration error" }),
    };
  }

  try {
    if (event.httpMethod === "OPTIONS") {
      log.info("Handling OPTIONS request");

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    // Only handle GET request for public decks
    log.info("Scanning DynamoDB table for public decks", { table: tableName });
    const result = await ddb.scan({
      TableName: tableName,
      FilterExpression: "isPublic = :isPublic",
      ExpressionAttributeValues: {
        ":isPublic": true,
      },
    });

    const publicDecks = (result.Items || []).map((deck) => ({
      ...deck,
      isPublic: true,
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(publicDecks),
    };
  } catch (err: unknown) {
    const error = err as LambdaError;

    log.error("Error in handler", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Internal server error",
        error: process.env.STAGE === "dev" ? error.message : undefined,
      }),
    };
  }
};
