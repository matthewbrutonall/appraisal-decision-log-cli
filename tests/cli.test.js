import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.dirname(here);
const cli = path.join(project, "bin/appraisal-decision-log.js");

function run(args, input) {
  return spawnSync(process.execPath, [cli, ...args], { cwd: project, input, encoding: "utf8" });
}

test("draft creates the complete output package without changing input", () => {
  const input = path.join(here, "fixtures/appraisal-input.json");
  const before = fs.readFileSync(input, "utf8");
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-draft-")), "record");
  const result = run(["draft", "--input", input, "--output-dir", output]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Created 4 files/);
  assert.deepEqual(fs.readdirSync(output).sort(), [
    "appraisal-decision-report.json",
    "appraisal-decision-summary.json",
    "appraisal-decision.csv",
    "appraisal-decision.md"
  ]);
  assert.equal(fs.readFileSync(input, "utf8"), before);
  const report = JSON.parse(fs.readFileSync(path.join(output, "appraisal-decision-report.json"), "utf8"));
  assert.equal(report.input.proposedAction, "sample");
  assert.equal(report.missingFacts.length, 0);
  const summary = fs.readFileSync(path.join(output, "appraisal-decision-summary.json"), "utf8");
  assert.doesNotMatch(summary, /Governance newsletter|ABC\/APP\/1|A\. Archivist/);
});

test("draft supports standard input", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-stdin-")), "record");
  const result = run(["draft", "--input", "-", "--output-dir", output], JSON.stringify({ title: "Item" }));
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(output, "appraisal-decision-report.json"), "utf8"));
  assert.equal(report.source.input, "stdin");
});

test("draft refuses to overwrite any existing result", () => {
  const input = path.join(here, "fixtures/appraisal-input.json");
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-overwrite-"));
  assert.equal(run(["draft", "--input", input, "--output-dir", output]).status, 0);
  const second = run(["draft", "--input", input, "--output-dir", output]);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /Refusing to overwrite/);
});

test("template writes valid blank JSON and refuses overwrite", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-template-")), "input.json");
  const first = run(["template", "--output", output]);
  assert.equal(first.status, 0, first.stderr);
  const template = JSON.parse(fs.readFileSync(output, "utf8"));
  assert.equal(template.title, "");
  const second = run(["template", "--output", output]);
  assert.equal(second.status, 1);
  assert.match(second.stderr, /Refusing to overwrite/);
});

test("template can print to standard output", () => {
  const result = run(["template", "--output", "-"]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).proposedAction, "");
});

test("invalid JSON and unknown options fail clearly", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-invalid-")), "record");
  const invalid = run(["draft", "--input", "-", "--output-dir", output], "{not-json}");
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /not valid JSON/);
  const unknown = run(["draft", "--input", "-", "--output-dir", output, "--approve", "yes"], "{}");
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown option/);
});

test("help and version are available", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /proposed actions remain proposals/i);
  assert.equal(run(["--version"]).stdout.trim(), "0.1.0");
});
