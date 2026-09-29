import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const workerPath = resolve(root, "dist/server/index.js");
const manifestPath = resolve(root, "dist/.openai/hosting.json");
const [source, manifest] = await Promise.all([readFile(workerPath, "utf8"), readFile(manifestPath, "utf8")]);
JSON.parse(manifest);
const worker = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
assert.equal(typeof worker.default?.fetch, "function", "Worker must export default.fetch");
console.log("Artifact is valid");
