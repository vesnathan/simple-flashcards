/* eslint-disable no-console */
import { CognitoIdentityProvider } from "@aws-sdk/client-cognito-identity-provider";

import { CONFIG } from "../config/aws";

const cognito = new CognitoIdentityProvider({ region: CONFIG.REGION });

export const authService = {
  async verifyToken(token: string) {
    try {
      const response = await cognito.getUser({
        AccessToken: token,
      });

      return {
        userId: response.Username,
        email: response.UserAttributes?.find((attr) => attr.Name === "email")
          ?.Value,
      };
    } catch (error) {
      console.error("Token verification failed:", error);

      return null;
    }
  },
};
