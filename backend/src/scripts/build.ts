/* eslint-disable no-console */
import { join } from "path";
import { writeFileSync, readFileSync, mkdirSync } from "fs";

import { build } from "esbuild";
import JSZip from "jszip";

async function buildAndZip() {
  try {
    // Ensure dist directory exists
    mkdirSync("dist", { recursive: true });

    // Build with esbuild
    await build({
      entryPoints: [
        "src/handlers/decks.ts",
        "src/handlers/sync.ts", // Add sync handler
      ],
      bundle: true,
      platform: "node",
      target: "node18",
      outdir: "dist",
      format: "cjs",
    });

    // Create zip file
    const zip = new JSZip();

    // Read the built file and add to zip
    const decksJs = readFileSync(
      join(__dirname, "../../dist/decks.js"),
      "utf-8",
    );

    zip.file("decks.js", decksJs);

    // Generate zip buffer
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    // Write zip file
    writeFileSync(join(__dirname, "../../dist/functions.zip"), zipBuffer);
    console.log("Build completed successfully");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

buildAndZip();
