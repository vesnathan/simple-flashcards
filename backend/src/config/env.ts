/* eslint-disable no-console */
import { join } from "path";

import { config } from "dotenv";

// Load environment variables from .env file
const result = config({
  path: join(__dirname, "../../.env"),
});

if (result.error) {
  console.warn("No .env file found. Using process.env values.");
}

export const loadEnv = () => {
  // This function is called at the start of any script that needs env vars
  if (!process.env.AWS_ACCOUNT_ID) {
    throw new Error(
      "Required environment variables are missing. Please check your .env file.",
    );
  }
};
