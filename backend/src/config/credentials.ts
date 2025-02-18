/* eslint-disable no-console */
import { fromIni } from "@aws-sdk/credential-providers";
import { Logger } from "@aws-sdk/types";

export function getCredentialConfig(profile = "flashcards-dev") {
  const logger: Logger = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  return {
    credentials: fromIni({ profile }),
    logger,
    region: process.env.REGION || "ap-southeast-2",
  };
}
