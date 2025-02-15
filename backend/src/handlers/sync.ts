/* eslint-disable no-console */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));
const TABLE_NAME = process.env.DECKS_TABLE || "";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID || "",
});

interface SyncPayload {
  deck: {
    id?: string;
    title: string;
    cards: Array<{
      id: string;
      question: string;
      answer: string;
    }>;
    lastModified: number;
    isPublic: boolean;
  };
}

export const syncDeck = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext.requestId;

  console.log(`[${requestId}] Starting sync request:`, {
    headers: event.headers,
    body: event.body,
  });

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  };

  // Handle OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // Only verify auth for POST requests
    if (event.httpMethod === "POST") {
      const auth = event.headers.Authorization || event.headers.authorization;

      if (!auth?.startsWith("Bearer ")) {
        console.log(`[${requestId}] Invalid auth header:`, auth);

        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Invalid authorization header" }),
        };
      }

      const token = auth.split(" ")[1];
      let payload;

      try {
        payload = await verifier.verify(token);
        console.log(`[${requestId}] Token verified for user:`, payload.sub);
      } catch (verifyError) {
        console.error(`[${requestId}] Token verification failed:`, verifyError);

        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Invalid token" }),
        };
      }

      if (!event.body) {
        console.log(`[${requestId}] No request body provided`);

        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: "No request body provided" }),
        };
      }

      const { deck }: SyncPayload = JSON.parse(event.body);

      console.log(`[${requestId}] Parsed deck data`, {
        deckId: deck.id,
        title: deck.title,
        cardCount: deck.cards.length,
      });

      const existingDeck = deck.id
        ? await dynamodb.get({
            TableName: TABLE_NAME,
            Key: {
              id: deck.id,
              userId: payload.sub,
            },
          })
        : null;

      if (deck.id) {
        console.log(`[${requestId}] Fetching existing deck: ${deck.id}`);
        console.log(
          `[${requestId}] Existing deck found:`,
          existingDeck?.Item || "null",
        );
      }

      const deckId = deck.id || Date.now().toString();

      console.log(`[${requestId}] Using deck ID: ${deckId}`);

      const finalDeck = {
        ...deck,
        id: deckId,
        userId: payload.sub,
        lastModified: Date.now(),
        createdAt: existingDeck?.Item?.createdAt || Date.now(),
      };

      console.log(`[${requestId}] Attempting to save deck to DynamoDB`, {
        deckId,
        userId: payload.sub,
        table: TABLE_NAME,
      });

      const putParams = {
        TableName: TABLE_NAME,
        Item: finalDeck,
      };

      // Only add condition for existing decks and when lastModified is provided
      if (existingDeck && deck.lastModified) {
        Object.assign(putParams, {
          ConditionExpression:
            "attribute_not_exists(id) OR lastModified <= :lastMod",
          ExpressionAttributeValues: {
            ":lastMod": deck.lastModified,
          },
        });
      }

      await dynamodb.put(putParams);

      console.log(`[${requestId}] Successfully saved deck`);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Deck synchronized successfully",
          deck: finalDeck,
        }),
      };
    }

    // Handle GET request
    if (event.httpMethod === "GET") {
      try {
        const decks = await dynamodb.scan({
          TableName: TABLE_NAME,
          FilterExpression: "isPublic = :isPublic",
          ExpressionAttributeValues: {
            ":isPublic": true,
          },
        });

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify(decks.Items || []),
        };
      } catch (error) {
        console.error("Error fetching public decks:", error);

        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Failed to fetch public decks" }),
        };
      }
    }

    // Handle unsupported methods
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Method not allowed" }),
    };
  } catch (error: any) {
    // Handle specific DynamoDB errors
    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Deck was modified by another request",
          requestId,
        }),
      };
    }

    console.error(`[${requestId}] Error:`, error);

    return {
      statusCode: error.statusCode || 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: error.message || "Internal server error",
        requestId,
      }),
    };
  }
};
