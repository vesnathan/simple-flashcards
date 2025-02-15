/* eslint-disable no-console */
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
      // Check if user pool exists
      const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

      if (userPoolId && clientId) {
        try {
          await cognito.send(
            new DescribeUserPoolCommand({
              UserPoolId: userPoolId,
            }),
          );
          console.log("Using existing Cognito User Pool");

          return { userPoolId, clientId };
        } catch {
          console.log(
            "Existing pool not found or not accessible, creating new one",
          );
        }
      }

      // Create new User Pool
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
