/* eslint-disable no-console */
import {
  IAMClient,
  CreateRoleCommand,
  PutRolePolicyCommand,
  GetRoleCommand,
} from "@aws-sdk/client-iam";

import { CONFIG } from "../config/aws";

const iam = new IAMClient({
  region: "ap-southeast-2",
  profile: "flashcards-dev",
});

export const iamService = {
  async createLambdaRole() {
    const roleName = `flashcards-${CONFIG.STAGE}-lambda-role`;

    try {
      // Try to get existing role first
      const existingRole = await iam.send(
        new GetRoleCommand({ RoleName: roleName }),
      );

      console.log("Found existing role:", roleName);

      return existingRole.Role?.Arn;
    } catch (error: any) {
      // Only proceed with creation if role doesn't exist
      if (error.name !== "NoSuchEntity") {
        throw error;
      }
    }

    try {
      // Create new role if it doesn't exist
      console.log("Creating new role:", roleName);
      const { Role } = await iam.send(
        new CreateRoleCommand({
          RoleName: roleName,
          AssumeRolePolicyDocument: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: { Service: "lambda.amazonaws.com" },
                Action: "sts:AssumeRole",
              },
            ],
          }),
        }),
      );

      if (!Role?.Arn) {
        throw new Error("Failed to create role: ARN is undefined");
      }

      console.log("Attaching policy to role:", roleName);
      await iam.send(
        new PutRolePolicyCommand({
          RoleName: roleName,
          PolicyName: `${roleName}-policy`,
          PolicyDocument: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Action: [
                  "dynamodb:GetItem",
                  "dynamodb:Scan",
                  "dynamodb:Query",
                  "dynamodb:PutItem",
                  "dynamodb:UpdateItem",
                  "dynamodb:DeleteItem",
                ],
                Resource: `arn:aws:dynamodb:${CONFIG.REGION}:*:table/${CONFIG.DECKS_TABLE}`,
              },
              {
                Effect: "Allow",
                Action: [
                  "logs:CreateLogGroup",
                  "logs:CreateLogStream",
                  "logs:PutLogEvents",
                  "logs:DescribeLogGroups",
                  "logs:DescribeLogStreams",
                  "logs:GetLogEvents",
                  "apigateway:*",
                ],
                Resource: [
                  `arn:aws:logs:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:log-group:/aws/lambda/flashcards-${CONFIG.STAGE}-*:*`,
                  `arn:aws:logs:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:log-group:/aws/lambda/flashcards-${CONFIG.STAGE}-*:*:*`,
                  `arn:aws:logs:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:log-group:/aws/apigateway/flashcards-${CONFIG.STAGE}-*:*`,
                  `arn:aws:logs:${CONFIG.REGION}:${CONFIG.AWS_ACCOUNT_ID}:log-group:/aws/apigateway/*`,
                ],
              },
            ],
          }),
        }),
      );

      // Wait for role to propagate
      console.log("Waiting for role to propagate...");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      return Role.Arn;
    } catch (error: any) {
      if (error.name === "EntityAlreadyExists") {
        // Double check to get the ARN if role was created in between our checks
        const existingRole = await iam.send(
          new GetRoleCommand({ RoleName: roleName }),
        );

        return existingRole.Role?.Arn;
      }
      throw error;
    }
  },
};
