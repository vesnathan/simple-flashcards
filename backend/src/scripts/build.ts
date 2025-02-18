/* eslint-disable no-console */
import { mkdir, rm, readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

import esbuild from "esbuild";
import JSZip from "jszip";

async function zipDirectory(sourcePath: string, outPath: string) {
  const zip = new (JSZip as any)(); // Type assertion to handle constructor
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      const filePath = join(sourcePath, entry.name);
      const content = await readFile(filePath);

      zip.file(entry.name, content);
    }
  }

  const zipContent = await zip.generateAsync({ type: "nodebuffer" });

  await writeFile(outPath, zipContent);
}

async function build() {
  const distPath = join(__dirname, "../../dist");

  await rm(distPath, { recursive: true, force: true });
  await mkdir(distPath);

  // Bundle handlers with explicit names
  await esbuild.build({
    entryPoints: {
      sync: join(__dirname, "../handlers/sync.ts"),
      decks: join(__dirname, "../handlers/decks.ts"),
      userDecks: join(__dirname, "../handlers/userDecks.ts"),
    },
    bundle: true,
    minify: true,
    platform: "node",
    target: "node18",
    outdir: distPath,
    format: "cjs",
    outExtension: { ".js": ".js" },
    external: ["aws-sdk"],
  });

  // Create ZIP
  await zipDirectory(distPath, join(distPath, "functions.zip"));
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
