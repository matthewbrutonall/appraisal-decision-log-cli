# Appraisal Decision Log CLI

![An appraisal decision log marked Proposed, with approval awaiting sign-off](assets/appraisal-decision-log.png)

Archival appraisal is the structured assessment of records against collecting policy, evidential and informational value, legal or administrative requirements, research value, duplication, condition, format risks and other supplied evidence.

This command-line tool turns that evidence into a consistent draft decision log. It is useful for archivists and records managers who need to document why material is being considered for retention, sampling, transfer, further review or disposal—and which facts or approvals are still missing.

The tool records a **proposed** action. It does not appraise material by itself and never turns that proposal into approval, sign-off or authority to retain, destroy, sell or transfer records.

## Requirements

- Node.js 20 or later
- No package dependencies

## Create an input template

```bash
node bin/appraisal-decision-log.js template \
  --output appraisal-input.json
```

## Create a draft decision log

```bash
node bin/appraisal-decision-log.js draft \
  --input appraisal-input.json \
  --output-dir appraisal-record
```

Use `-` instead of a path to read JSON from standard input or print the template to standard output. A JSON input path must point to a regular file; use standard input for a pipe.

## Outputs

- `appraisal-decision.csv` — one-row summary decision record; the detailed supplied evidence remains in Markdown and JSON
- `appraisal-decision.md` — human-readable draft log
- `appraisal-decision-report.json` — complete machine-readable record
- `appraisal-decision-summary.json` — privacy-conscious summary without supplied narrative details

Existing result files are never overwritten. The input remains unchanged. CSV exports neutralise values that spreadsheet software could interpret as formulas; the JSON report retains the validated supplied values, with surrounding whitespace removed. Input JSON is limited to 256 KiB.

Missing facts remain visible. The tool does not invent institutional policy, appraisal criteria, donor terms, statutory duties, duplicate holdings, market value, reviewer identity, dates or sign-off.

## Test

```bash
npm test
npm run check
```
