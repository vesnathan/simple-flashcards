/* eslint-disable no-console */
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyResult, APIGatewayProxyEvent } from "aws-lambda";
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

// Update handler to handle both endpoints
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log("Incoming request:", {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers,
    pathParameters: event.pathParameters,
  });

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const path = event.path.toLowerCase();

    console.log("Processing path:", path);

    // Handle /user-decks endpoint
    if (path.includes("user-decks")) {
      console.log("Handling user-decks request");
      const auth = event.headers.Authorization || event.headers.authorization;

      if (!auth?.startsWith("Bearer ")) {
        console.log("Missing or invalid auth token");

        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Authorization required" }),
        };
      }

      try {
        const token = auth.split(" ")[1];
        const payload = await verifier.verify(token);
        const userId = payload.sub;

        console.log("Fetching decks for user:", userId);

        const result = await dynamodb.scan({
          TableName: TABLE_NAME,
          FilterExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": userId },
        });

        console.log("Found user decks:", {
          userId,
          count: result.Items?.length || 0,
        });

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(result.Items || []),
        };
      } catch (error) {
        console.error("Auth error:", error);

        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Invalid token" }),
        };
      }
    }

    // Default to getDecks for other paths
    return await getDecks(event);
  } catch (error) {
    console.error("Handler error:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};

export const getDecks = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  let userId: string | null = null;

  // Try to verify token if provided
  const auth = event.headers.Authorization || event.headers.authorization;

  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.split(" ")[1];

    try {
      const payload = await verifier.verify(token);

      userId = payload.sub;
    } catch (error) {
      console.error(`[${requestId}] Token verification failed:`, error);
      // Proceed without user decks if token invalid
    }
  }

  try {
    // Fetch public decks (system decks)
    const publicRes = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: "userId = :system",
      ExpressionAttributeValues: { ":system": "system" },
    });
    const publicDecks = publicRes.Items || [];

    let userDecks: any[] = [];

    if (userId) {
      // Fetch decks belonging to verified user
      const userRes = await dynamodb.scan({
        TableName: TABLE_NAME,
        FilterExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": userId },
      });

      userDecks = userRes.Items || [];
    }

    const mergedDecks = [...publicDecks, ...userDecks];

    console.log(`[${requestId}] Returning decks:`, {
      public: publicDecks.length,
      user: userDecks.length,
      total: mergedDecks.length,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(mergedDecks),
    };
  } catch (error) {
    console.error(`[${requestId}] Error fetching decks:`, error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Internal server error", requestId }),
    };
  }
};

// Update getDeck handler to use logging too
export const getDeck = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
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

export const getUserDecks = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;
  const auth = event.headers.Authorization || event.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Authorization required" }),
    };
  }

  try {
    // Verify the JWT token
    const token = auth.split(" ")[1];
    const payload = await verifier.verify(token);
    const userId = payload.sub;

    // Query DynamoDB for user's decks
    const result = await dynamodb.scan({
      TableName: TABLE_NAME,
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId },
    });

    console.log(`[${requestId}] Retrieved user decks:`, {
      userId,
      count: result.Items?.length || 0,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Items || []),
    };
  } catch (error) {
    console.error(`[${requestId}] Error fetching user decks:`, error);

    // Add type checking for error
    if (typeof error === "object" && error !== null && "name" in error) {
      if (error.name === "JWTVerificationFailed") {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Invalid token" }),
        };
      }
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Failed to fetch user decks" }),
    };
  }
};

// Change export to default for Lambda
export default handler;
