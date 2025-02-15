import { Amplify } from "aws-amplify";
import {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignUp,
} from "aws-amplify/auth";

const cognitoErrorMessages: Record<string, string> = {
  UserNotFoundException: "Incorrect email or password",
  NotAuthorizedException: "Incorrect email or password",
  UsernameExistsException: "An account with this email already exists",
  InvalidPasswordException: "Password does not meet requirements",
  CodeMismatchException: "Invalid verification code",
  ExpiredCodeException:
    "Verification code has expired, please request a new one",
  LimitExceededException: "Too many attempts, please try again later",
  UserNotConfirmedException: "Please verify your email address first",
};

function getErrorMessage(error: any): string {
  const cognitoError = error?.name || error?.__type;

  return (
    cognitoErrorMessages[cognitoError] ||
    error.message ||
    "An unexpected error occurred"
  );
}

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
      signUpVerificationMethod: "code",
    },
  },
});

export const authService = {
  async signIn(email: string, password: string) {
    try {
      // First sign out any existing user
      await signOut();

      return await signIn({ username: email, password });
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
  },

  async signUp(email: string, password: string) {
    try {
      return await signUp({
        username: email,
        password,
        options: {
          userAttributes: { email },
        },
      });
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
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

  async confirmSignUp(email: string, code: string) {
    try {
      return await confirmSignUp({
        username: email,
        confirmationCode: code,
      });
    } catch (error: any) {
      throw new Error(getErrorMessage(error));
    }
  },
};
