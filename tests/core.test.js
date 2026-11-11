import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  APPRAISAL_ACTIONS,
  buildAppraisalCsv,
  buildAppraisalMarkdown,
  buildAppraisalReport,
  buildPrivacySummary,
  CSV_HEADERS,
  FIELD_LIMITS,
  identifyMissingFacts,
  INPUT_TEMPLATE,
  parseAppraisalInput
} from "../src/core.js";

const here = path.dirname(fileURLToPath(import.meta.url));

test("requires a starter title, reference or supplied notes", () => {
  assert.throws(() => parseAppraisalInput({}), /Provide a title/);
  assert.equal(parseAppraisalInput({ suppliedNotes: "Box requires appraisal." }).suppliedNotes, "Box requires appraisal.");
  assert.equal(parseAppraisalInput({ input: { title: "Box list" } }).title, "Box list");
});

test("strict validation rejects unknown fields, invalid types, actions and silent truncation", () => {
  assert.throws(() => parseAppraisalInput({ title: "Item", inventedApproval: true }), /Unknown input field/);
  assert.throws(() => parseAppraisalInput({ input: { title: "Item" }, approved: true }), /Unknown wrapper field/);
  assert.throws(() => parseAppraisalInput({ title: 42 }), /must be text/);
  assert.throws(() => parseAppraisalInput({ title: "Item", proposedAction: "destroy" }), /must be one of/);
  assert.throws(() => parseAppraisalInput({ title: "x".repeat(FIELD_LIMITS.title + 1) }), /exceeds 300/);
  assert.throws(() => parseAppraisalInput({ title: "invalid\0title" }), /null characters/);
});

test("blank strings remain missing and all documented actions are accepted", () => {
  const blank = parseAppraisalInput({ title: "Item", proposedAction: "   " });
  assert.equal(blank.proposedAction, undefined);
  for (const action of APPRAISAL_ACTIONS) {
    assert.equal(parseAppraisalInput({ title: "Item", proposedAction: action }).proposedAction, action);
  }
});

test("missing facts never become a completed decision", () => {
  const input = parseAppraisalInput({ title: "Photographic prints" });
  const missing = identifyMissingFacts(input);
  assert.ok(missing.includes("collection policy or appraisal criteria"));
  assert.ok(missing.includes("proposed action"));
  const report = buildAppraisalReport(input, { generatedAt: "2026-01-01T00:00:00.000Z" });
  const markdown = buildAppraisalMarkdown(report);
  assert.match(markdown, /proposed action: Not supplied/);
  assert.match(markdown, /not authority to act/i);
  assert.doesNotMatch(markdown, /proposed action: Keep/);
});

test("CSV keeps the documented schema and labels only the proposed action", () => {
  const report = buildAppraisalReport({
    title: "Keep file",
    reference: "AB/APP/2",
    appraisalCriteria: "Keep unique governance evidence.",
    materialSummary: "keep",
    proposedAction: "keep",
    rationale: "keep",
    rightsAccessPrivacy: "Review required."
  });
  const csv = buildAppraisalCsv(report);
  const [header, row] = csv.trimEnd().split("\n");
  assert.equal(header, CSV_HEADERS.join(","));
  assert.match(row, /,Keep,/);
  assert.match(row, /,keep,keep,/);
});

test("CSV neutralises spreadsheet formulas while JSON retains supplied text", () => {
  const title = '=HYPERLINK("malicious.example","open")';
  const report = buildAppraisalReport({ title });
  assert.match(buildAppraisalCsv(report), /'=HYPERLINK/);
  assert.equal(report.input.title, title);
});

test("Markdown escapes structural and HTML-like supplied text", () => {
  const report = buildAppraisalReport({ title: "A | B\n<script>" });
  const markdown = buildAppraisalMarkdown(report);
  assert.match(markdown, /A \\\| B\\n&lt;script&gt;/);
  assert.doesNotMatch(markdown, /<script>/);
});

test("Markdown renders supplied notes literally rather than as report structure", () => {
  const report = buildAppraisalReport({ suppliedNotes: "# APPROVED\n- Destroy immediately\n<script>" });
  const markdown = buildAppraisalMarkdown(report);
  assert.match(markdown, /    # APPROVED\n    - Destroy immediately\n    <script>/);
  assert.doesNotMatch(markdown, /^# APPROVED$/m);
  assert.doesNotMatch(markdown, /^- Destroy immediately$/m);
});

test("privacy summary omits narrative evidence and identifiers", () => {
  const report = buildAppraisalReport({
    title: "Named client files",
    reference: "SECRET/1",
    donorTerms: "Private address at 1 Private Road.",
    rightsAccessPrivacy: "Named health information.",
    proposedAction: "review_further"
  });
  const summary = JSON.stringify(buildPrivacySummary(report));
  assert.doesNotMatch(summary, /Named client|SECRET|Private Road|health information/);
  assert.match(summary, /review_further/);
  assert.match(summary, /donorTermsSupplied/);
});

test("complete fixture matches golden CSV and Markdown", () => {
  const input = JSON.parse(fs.readFileSync(path.join(here, "fixtures/appraisal-input.json"), "utf8"));
  const report = buildAppraisalReport(input, { generatedAt: "2026-11-11T12:00:00.000Z" });
  assert.equal(buildAppraisalCsv(report), fs.readFileSync(path.join(here, "golden/appraisal-decision.csv"), "utf8"));
  assert.equal(buildAppraisalMarkdown(report), fs.readFileSync(path.join(here, "golden/appraisal-decision.md"), "utf8"));
});

test("template contains every supported field with no invented values", () => {
  assert.deepEqual(Object.keys(INPUT_TEMPLATE), Object.keys(FIELD_LIMITS));
  assert.ok(Object.values(INPUT_TEMPLATE).every((value) => value === ""));
});
