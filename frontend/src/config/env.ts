function validateEnv() {
  // Only validate on client side and when not in development
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    const required = [
      "NEXT_PUBLIC_API_URL",
      "NEXT_PUBLIC_API_STAGE",
      "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
      "NEXT_PUBLIC_COGNITO_CLIENT_ID",
      "NEXT_PUBLIC_COGNITO_REGION",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables in frontend: ${missing.join(", ")}\nPlease check your .env file.`,
      );
    }
  }
}

validateEnv();

// Provide default values for development
export const env = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
    stage: process.env.NEXT_PUBLIC_API_STAGE || "dev",
  },
  auth: {
    region: process.env.NEXT_PUBLIC_COGNITO_REGION || "ap-southeast-2",
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
  },
};
