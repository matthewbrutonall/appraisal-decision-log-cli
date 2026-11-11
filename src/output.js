import fs from "node:fs";
import path from "node:path";
import { buildAppraisalCsv, buildAppraisalMarkdown, buildPrivacySummary } from "./core.js";

export const OUTPUT_NAMES = {
  csv: "appraisal-decision.csv",
  markdown: "appraisal-decision.md",
  report: "appraisal-decision-report.json",
  summary: "appraisal-decision-summary.json"
};

export function buildOutputFiles(report) {
  return new Map([
    [OUTPUT_NAMES.csv, buildAppraisalCsv(report)],
    [OUTPUT_NAMES.markdown, buildAppraisalMarkdown(report)],
    [OUTPUT_NAMES.report, `${JSON.stringify(report, null, 2)}\n`],
    [OUTPUT_NAMES.summary, `${JSON.stringify(buildPrivacySummary(report), null, 2)}\n`]
  ]);
}

export function canonicalPath(value) {
  const missing = [];
  let existing = path.resolve(value);
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(fs.realpathSync(existing), ...missing);
}

export function writeNewFile(filePath, content) {
  const output = canonicalPath(filePath);
  if (fs.existsSync(output)) throw new Error(`Refusing to overwrite existing output: ${output}`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return output;
}

export function writeOutputFiles(outputDirectory, files) {
  const output = canonicalPath(outputDirectory);
  if (fs.existsSync(output) && !fs.statSync(output).isDirectory()) {
    throw new Error(`Output path is not a directory: ${output}`);
  }
  const conflicts = [...files.keys()].map((name) => path.join(output, name)).filter(fs.existsSync);
  if (conflicts.length) throw new Error(`Refusing to overwrite existing output: ${conflicts.join(", ")}`);

  fs.mkdirSync(output, { recursive: true });
  if (fs.realpathSync(output) !== output) throw new Error(`Output directory did not resolve to the expected location: ${output}`);
  for (const [name, content] of files) {
    fs.writeFileSync(path.join(output, name), content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  }
  return { outputDirectory: output, paths: [...files.keys()].map((name) => path.join(output, name)) };
}
