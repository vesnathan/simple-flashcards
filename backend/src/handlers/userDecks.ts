/* eslint-disable no-console */
import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { CognitoJwtVerifier } from "aws-jwt-verify";

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));
const TABLE_NAME = process.env.DECKS_TABLE || "";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID || "",
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID || "",
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,GET",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
};

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.log("User decks request:", {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers,
  });

  // Handle OPTIONS request first
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  // Handle GET request
  if (event.httpMethod === "GET") {
    const auth = event.headers.Authorization || event.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
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
      console.error("Error:", error);

      if (error instanceof Error && error.name === "JWTVerificationFailed") {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ message: "Invalid token" }),
        };
      }

      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Failed to fetch user decks" }),
      };
    }
  }

  // Handle unsupported methods
  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ message: "Method not allowed" }),
  };
};

export default handler;
