/* eslint-disable no-console */
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";

import { dynamodbService } from "../services/dynamodb";

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

export const getDecks: APIGatewayProxyHandler = async (event) => {
  const tableName = process.env.DECKS_TABLE;

  log.info("GetDecks invoked", {
    httpMethod: event.httpMethod,
    tableName,
    stage: process.env.STAGE,
    region: process.env.APP_REGION, // Changed from AWS_REGION
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
    // Handle preflight requests
    if (event.httpMethod === "OPTIONS") {
      log.info("Handling OPTIONS request");

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    log.info("Scanning DynamoDB table", { table: tableName });
    const result = await ddb.scan({
      TableName: tableName || "",
    });

    // Ensure we return an array even if no items found
    const items = result.Items || [];

    log.info("Scan completed", { itemCount: items.length });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(items),
    };
  } catch (err: unknown) {
    const error = err as LambdaError;

    log.error("Error in getDecks handler", error);

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

export const getDeck: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Deck ID is required" }),
      };
    }

    const deck = await dynamodbService.getDeckById(id);

    if (!deck) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Deck not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
      },
      body: JSON.stringify(deck),
    };
  } catch (error) {
    console.error("Error fetching deck:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Error fetching deck" }),
    };
  }
};
