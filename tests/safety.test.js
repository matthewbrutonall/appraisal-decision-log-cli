import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(here);

test("runtime has no network clients, AI hooks or destructive filesystem calls", () => {
  const files = ["src/core.js", "src/output.js", "bin/appraisal-decision-log.js"];
  const source = files.map((file) => fs.readFileSync(path.join(project, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /https?:\/\/|fetch\(|XMLHttpRequest|WebSocket|node:https|node:http|openai|anthropic/i);
  assert.doesNotMatch(source, /unlink|rmSync|rmdir|renameSync|truncate/);
});

test("documentation preserves professional decision boundaries", () => {
  const readme = fs.readFileSync(path.join(project, "README.md"), "utf8");
  assert.match(readme, /proposed/i);
  assert.match(readme, /does not appraise material by itself/i);
  assert.match(readme, /never.*authority/i);
});
