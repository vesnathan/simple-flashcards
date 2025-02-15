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
  const handlerPath = join(distPath, "handlers");

  await rm(distPath, { recursive: true, force: true });
  await mkdir(distPath);
  await mkdir(handlerPath);

  // Bundle handlers
  await esbuild.build({
    entryPoints: [
      join(__dirname, "../handlers/sync.ts"),
      join(__dirname, "../handlers/decks.ts"),
    ],
    bundle: true,
    minify: true,
    platform: "node",
    target: "node18",
    outdir: handlerPath,
    format: "cjs",
  });

  // Create ZIP
  await zipDirectory(handlerPath, join(distPath, "functions.zip"));
}

build().catch((error) => {
  console.error("Build failed:", error);
  process.exit(1);
});
