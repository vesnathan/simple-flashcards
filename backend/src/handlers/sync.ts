/* eslint-disable no-console */
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const ddb = DynamoDBDocument.from(new DynamoDB({}));
const TABLE_NAME = process.env.DECKS_TABLE || "";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID || "",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

// Export with the name Lambda expects
export const syncDeck = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  // Handle preflight requests
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    // Verify auth token
    const token = event.headers.Authorization?.split(" ")[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "No authorization token provided" }),
      };
    }

    const payload = await verifier.verify(token);
    const userId = payload.sub;

    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "No deck data provided" }),
      };
    }

    const deck = JSON.parse(event.body || "{}");

    if (!deck.title || !deck.id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Deck title and ID are required" }),
      };
    }

    // Use the existing local ID from the deck
    const timestamp = Date.now();
    const updatedDeck = {
      ...deck,
      userId,
      createdAt: deck.createdAt || timestamp,
      lastModified: timestamp,
    };

    // Log the deck being saved
    console.log("Saving deck:", {
      id: updatedDeck.id,
      userId: updatedDeck.userId,
      title: updatedDeck.title,
      cardCount: updatedDeck.cards?.length || 0,
    });

    // Save to DynamoDB
    await ddb.put({
      TableName: TABLE_NAME,
      Item: updatedDeck,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(updatedDeck),
    };
  } catch (error) {
    console.error("Error in sync handler:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Failed to sync deck",
        error: process.env.STAGE === "dev" ? String(error) : undefined,
      }),
    };
  }
};

// Also export as default for consistency
export default syncDeck;
