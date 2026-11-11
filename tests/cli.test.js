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

test("draft rejects file and standard-input JSON over 256 KiB", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-large-"));
  const output = path.join(workspace, "record");
  const oversized = JSON.stringify({ suppliedNotes: "x".repeat(256 * 1024) });
  const input = path.join(workspace, "oversized.json");
  fs.writeFileSync(input, oversized);

  for (const result of [
    run(["draft", "--input", input, "--output-dir", output]),
    run(["draft", "--input", "-", "--output-dir", output], oversized)
  ]) {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exceeds the 256 KiB limit/);
  }
  assert.equal(fs.existsSync(output), false);
});

test("draft rejects malformed UTF-8 from files and standard input", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-utf8-"));
  const output = path.join(workspace, "record");
  const malformed = Buffer.concat([Buffer.from('{"title":"bad '), Buffer.from([0xff]), Buffer.from('"}')]);
  const input = path.join(workspace, "malformed.json");
  fs.writeFileSync(input, malformed);

  for (const result of [
    run(["draft", "--input", input, "--output-dir", output]),
    run(["draft", "--input", "-", "--output-dir", output], malformed)
  ]) {
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not valid UTF-8/);
  }
  assert.equal(fs.existsSync(output), false);
});

test("draft rejects escaped unpaired surrogates without creating output", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-surrogate-")), "record");
  const result = run(["draft", "--input", "-", "--output-dir", output], '{"title":"bad \\ud800 title"}');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unpaired Unicode surrogates/);
  assert.equal(fs.existsSync(output), false);
});

test("draft rejects directory and named-pipe input paths", (t) => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-cli-special-"));
  const output = path.join(workspace, "record");
  const directory = run(["draft", "--input", workspace, "--output-dir", output]);
  assert.equal(directory.status, 1);
  assert.match(directory.stderr, /must be a regular file/);

  const fifo = path.join(workspace, "input.fifo");
  const created = spawnSync("mkfifo", [fifo], { encoding: "utf8" });
  if (created.error?.code === "ENOENT" || created.status !== 0) {
    t.skip("Named pipes are unavailable on this platform.");
    return;
  }
  const pipe = run(["draft", "--input", fifo, "--output-dir", output]);
  assert.equal(pipe.status, 1);
  assert.match(pipe.stderr, /must be a regular file/);
  assert.equal(fs.existsSync(output), false);
});

test("help and version are available", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /proposed actions remain proposals/i);
  assert.equal(run(["--version"]).stdout.trim(), "0.1.0");
});
