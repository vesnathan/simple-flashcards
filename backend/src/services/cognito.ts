/* eslint-disable no-console */
import { join } from "path";
import { existsSync, readFileSync } from "fs";

import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  DescribeUserPoolCommand,
} from "@aws-sdk/client-cognito-identity-provider";

import { CONFIG } from "../config/aws";

const cognito = new CognitoIdentityProviderClient({ region: CONFIG.REGION });

interface CognitoConfig {
  userPoolId: string;
  clientId: string;
}

export const cognitoService = {
  async setupAuth(): Promise<CognitoConfig> {
    const poolName = `flashcards-${CONFIG.STAGE}-users`;

    try {
      // First try to read from frontend .env
      const frontendEnvPath = join(__dirname, "../../../frontend/.env");

      if (existsSync(frontendEnvPath)) {
        const envContent = readFileSync(frontendEnvPath, "utf-8");
        const userPoolId = envContent.match(
          /NEXT_PUBLIC_COGNITO_USER_POOL_ID=(.*)/,
        )?.[1];
        const clientId = envContent.match(
          /NEXT_PUBLIC_COGNITO_CLIENT_ID=(.*)/,
        )?.[1];

        if (userPoolId && clientId) {
          try {
            await cognito.send(
              new DescribeUserPoolCommand({
                UserPoolId: userPoolId,
              }),
            );
            console.log("Using existing Cognito User Pool:", userPoolId);

            return { userPoolId, clientId };
          } catch {
            console.log(
              "Failed to validate existing user pool, will create new one",
            );
          }
        }
      }

      // If no valid existing pool found, create new one
      console.log("Creating new Cognito User Pool...");
      const userPoolResponse = await cognito.send(
        new CreateUserPoolCommand({
          PoolName: poolName,
          UsernameAttributes: ["email"],
          AutoVerifiedAttributes: ["email"],
          Policies: {
            PasswordPolicy: {
              MinimumLength: 8,
              RequireUppercase: true,
              RequireLowercase: true,
              RequireNumbers: true,
              RequireSymbols: true,
            },
          },
        }),
      );

      const newUserPoolId = userPoolResponse.UserPool?.Id;

      if (!newUserPoolId) throw new Error("Failed to create User Pool");

      // Create App Client
      const clientResponse = await cognito.send(
        new CreateUserPoolClientCommand({
          UserPoolId: newUserPoolId,
          ClientName: `flashcards-${CONFIG.STAGE}-client`,
          GenerateSecret: false,
          ExplicitAuthFlows: [
            "ALLOW_USER_SRP_AUTH",
            "ALLOW_USER_PASSWORD_AUTH",
            "ALLOW_REFRESH_TOKEN_AUTH",
          ],
        }),
      );

      const newClientId = clientResponse.UserPoolClient?.ClientId;

      if (!newClientId) throw new Error("Failed to create Client");

      return {
        userPoolId: newUserPoolId,
        clientId: newClientId,
      };
    } catch (error) {
      console.error("Failed to setup Cognito:", error);
      throw error;
    }
  },
};
