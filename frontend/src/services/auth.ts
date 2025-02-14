import { Amplify } from "aws-amplify";
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from "aws-amplify/auth";

Amplify.configure({
  Auth: {
    Cognito: {
      region: "ap-southeast-2",
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
      oauth: {
        domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "",
        scopes: ["email", "openid", "profile"],
        redirectSignIn:
          typeof window !== "undefined" ? window.location.origin : "",
        redirectSignOut:
          typeof window !== "undefined" ? window.location.origin : "",
        responseType: "code",
      },
    },
  },
});

export const authService = {
  async signIn(email: string, password: string) {
    return signIn({ username: email, password });
  },

  async signUp(email: string, password: string) {
    return signUp({
      username: email,
      password,
      options: {
        userAttributes: { email },
      },
    });
  },

  async signOut() {
    return signOut();
  },

  async getCurrentUser() {
    return getCurrentUser();
  },

  async getToken() {
    const session = await fetchAuthSession();

    return session.tokens?.idToken?.toString();
  },
};
