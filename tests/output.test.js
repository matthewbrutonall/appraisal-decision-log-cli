import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalPath, writeNewFile, writeOutputFiles } from "../src/output.js";

test("canonical path resolves an existing symbolic-link destination", (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-output-path-"));
  const target = path.join(parent, "target");
  const link = path.join(parent, "link");
  fs.mkdirSync(target);
  try {
    fs.symlinkSync(target, link);
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error.code)) {
      t.skip("Symbolic links are unavailable on this platform.");
      return;
    }
    throw error;
  }
  assert.equal(canonicalPath(link), fs.realpathSync(target));
  const result = writeOutputFiles(link, new Map([["result.txt", "result\n"]]));
  assert.equal(result.outputDirectory, fs.realpathSync(target));
  assert.equal(fs.readFileSync(path.join(target, "result.txt"), "utf8"), "result\n");
});

test("single-file output uses exclusive creation", () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "appraisal-output-file-")), "template.json");
  assert.equal(writeNewFile(output, "{}\n"), output);
  assert.throws(() => writeNewFile(output, "{}\n"), /Refusing to overwrite/);
});
