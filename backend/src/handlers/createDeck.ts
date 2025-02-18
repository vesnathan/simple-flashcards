/* eslint-disable no-console */
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const ddb = DynamoDBDocument.from(new DynamoDB({}));
const TABLE_NAME = process.env.DECKS_TABLE || "";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID || "",
});

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const token = event.headers.Authorization?.split(" ")[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    const payload = await verifier.verify(token);
    const userId = payload.sub;
    const body = JSON.parse(event.body || "{}");
    const { title } = body;

    if (!title) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Title is required" }),
      };
    }

    const timestamp = Date.now();
    const deck = {
      userId, // Hash key
      id: `deck_${timestamp}`, // Range key
      title,
      cards: [],
      createdAt: timestamp,
      lastModified: timestamp,
      isPublic: false,
    };

    console.log("Creating deck:", {
      userId: deck.userId,
      id: deck.id,
      title: deck.title,
    });

    await ddb.put({
      TableName: TABLE_NAME,
      Item: deck,
      ConditionExpression:
        "attribute_not_exists(id) AND attribute_not_exists(userId)",
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(deck),
    };
  } catch (error) {
    console.error("Error creating deck:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Internal server error",
        error: process.env.STAGE === "dev" ? String(error) : undefined,
      }),
    };
  }
};
