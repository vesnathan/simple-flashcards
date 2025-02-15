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
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
  };

  try {
    // Handle OPTIONS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: ""
      };
    }

    const auth = event.headers.Authorization || event.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      console.log(`[${requestId}] Invalid auth header:`, auth);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid authorization header" })
      };
    }

    const token = auth.split(' ')[1];
    let payload;
    try {
      payload = await verifier.verify(token);
      console.log(`[${requestId}] Token verified for user:`, payload.sub);
    } catch (verifyError) {
      console.error(`[${requestId}] Token verification failed:`, verifyError);
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid token" })
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

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: finalDeck,
      ConditionExpression: existingDeck
        ? "lastModified <= :lastMod"
        : "attribute_not_exists(id)",
      ExpressionAttributeValues: {
        ":lastMod": deck.lastModified,
      },
    });

    console.log(`[${requestId}] Successfully saved deck`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Deck synchronized successfully",
        deck: finalDeck,
      }),
    };
  } catch (error: any) {
    console.error(`[${requestId}] Error:`, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: "Internal server error",
        error: error instanceof Error ? error.message : "Unknown error",
        requestId 
      })
    };
  }
};
