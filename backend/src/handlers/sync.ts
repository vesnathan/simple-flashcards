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

interface Card {
  id: number;
  question: string;
  answer: string;
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

      // Parse and validate request body
      const rawBody = JSON.parse(event.body || "");

      console.log("Received raw body:", rawBody);

      // Handle the deck data directly, not expecting a nested structure
      const deck = rawBody;

      if (!deck || !deck.title || !Array.isArray(deck.cards)) {
        console.error("Invalid deck data:", deck);

        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            message: "Invalid deck format",
            received: deck,
            expected: {
              title: "string",
              cards: "array of { id, question, answer }",
            },
          }),
        };
      }

      // Validate cards array with proper typing
      if (
        !deck.cards.every((card: Card) => {
          return (
            typeof card.id === "number" &&
            typeof card.question === "string" &&
            typeof card.answer === "string"
          );
        })
      ) {
        console.error("Invalid cards format:", deck.cards);

        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({
            message: "Invalid cards format",
            received: deck.cards,
          }),
        };
      }

      const finalDeck = {
        ...deck,
        userId: payload.sub,
        lastModified: Date.now(),
        createdAt: deck.createdAt || Date.now(),
      };

      console.log("Saving deck:", {
        id: finalDeck.id,
        title: finalDeck.title,
        cardCount: finalDeck.cards.length,
        cards: finalDeck.cards,
      });

      await dynamodb.put({
        TableName: TABLE_NAME,
        Item: finalDeck,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(finalDeck),
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
