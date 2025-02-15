/* eslint-disable no-console */
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";

import { authService } from "../services/auth";

const ddb = DynamoDBDocument.from(new DynamoDB({}));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export const syncDeck: APIGatewayProxyHandler = async (event) => {
  try {
    // Handle preflight requests
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: "",
      };
    }

    // Verify auth token
    const token = event.headers.Authorization?.split(" ")[1];

    if (!token) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "No authorization token provided" }),
      };
    }

    const user = await authService.verifyToken(token);

    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Invalid token" }),
      };
    }

    const deck = JSON.parse(event.body || "");

    if (!deck) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: "No deck data provided" }),
      };
    }

    // Add user info and timestamps
    const updatedDeck = {
      ...deck,
      userId: user.userId,
      updatedAt: new Date().toISOString(),
      createdAt: deck.createdAt || new Date().toISOString(),
    };

    // Save to DynamoDB
    await ddb.put({
      TableName: process.env.DECKS_TABLE || "",
      Item: updatedDeck,
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(updatedDeck),
    };
  } catch (error: any) {
    console.error("Error in syncDeck handler:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Failed to sync deck",
        error: process.env.STAGE === "dev" ? error.message : undefined,
      }),
    };
  }
};
