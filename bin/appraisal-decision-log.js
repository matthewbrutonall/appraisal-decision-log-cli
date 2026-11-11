#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildAppraisalReport, INPUT_TEMPLATE, TOOL_VERSION } from "../src/core.js";
import { buildOutputFiles, writeNewFile, writeOutputFiles } from "../src/output.js";

const HELP = `Appraisal Decision Log CLI ${TOOL_VERSION}

Usage:
  appraisal-decision-log template --output <path|->
  appraisal-decision-log draft --input <path|-> --output-dir <directory>

Commands:
  template   Create a blank JSON input template; - writes to standard output
  draft      Validate supplied evidence and create CSV, Markdown and JSON records

General:
  --help
  --version

Existing outputs are never overwritten. Proposed actions remain proposals for
professional review and do not authorise retention, disposal, transfer,
destruction or sale.`;

function parseArguments(argv) {
  const command = argv[0];
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option --${name} requires a value.`);
    if (name in options) throw new Error(`Option --${name} was supplied more than once.`);
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function requireOption(options, name) {
  if (!options[name]) throw new Error(`Missing required option --${name}.`);
  return options[name];
}

function rejectUnknown(options, allowed) {
  const unknown = Object.keys(options).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`Unknown option${unknown.length === 1 ? "" : "s"}: ${unknown.map((key) => `--${key}`).join(", ")}.`);
}

function readJson(inputPath) {
  let text;
  try {
    text = inputPath === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(path.resolve(inputPath), "utf8");
  } catch (error) {
    throw new Error(`Cannot read input JSON: ${error.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Input is not valid JSON: ${error.message}`);
  }
}

function runTemplate(options) {
  rejectUnknown(options, ["output"]);
  const output = requireOption(options, "output");
  const content = `${JSON.stringify(INPUT_TEMPLATE, null, 2)}\n`;
  if (output === "-") {
    process.stdout.write(content);
    return null;
  }
  return writeNewFile(output, content);
}

function runDraft(options) {
  rejectUnknown(options, ["input", "output-dir"]);
  const inputPath = requireOption(options, "input");
  const outputDirectory = requireOption(options, "output-dir");
  const raw = readJson(inputPath);
  const report = buildAppraisalReport(raw, {
    source: { type: "json", input: inputPath === "-" ? "stdin" : path.resolve(inputPath) }
  });
  return writeOutputFiles(outputDirectory, buildOutputFiles(report));
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help")) {
    process.stdout.write(`${HELP}\n`);
    return;
  }
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`${TOOL_VERSION}\n`);
    return;
  }

  const { command, options } = parseArguments(argv);
  if (command === "template") {
    const output = runTemplate(options);
    if (output) process.stdout.write(`Created ${output}\n`);
    return;
  }
  if (command === "draft") {
    const result = runDraft(options);
    process.stdout.write(`Created ${result.paths.length} files in ${result.outputDirectory}\n`);
    for (const outputPath of result.paths) process.stdout.write(`- ${outputPath}\n`);
    return;
  }
  throw new Error(`Unknown command: ${command}. Use --help for usage.`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exitCode = 1;
}
