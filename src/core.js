export const TOOL_VERSION = "0.1.0";
export const RULES_VERSION = "2026-09-09";
export const SOURCE_COMMIT = "c3bf44e6e7e811bc861454e837cc653572d43b08";

export const APPRAISAL_ACTIONS = ["keep", "sample", "discard", "transfer", "review_further"];

export const CSV_HEADERS = [
  "reference",
  "title",
  "proposed_action",
  "policy_basis",
  "material_summary",
  "appraisal_rationale",
  "risks_to_verify",
  "reviewer",
  "review_date",
  "signoff_status",
  "missing_facts"
];

export const FIELD_LIMITS = {
  title: 300,
  reference: 160,
  materialSummary: 4000,
  collectionPolicy: 4000,
  appraisalCriteria: 4000,
  evidentialValue: 3000,
  informationalValue: 3000,
  legalAdministrativeValue: 3000,
  researchValue: 3000,
  duplication: 3000,
  condition: 3000,
  formatRisk: 3000,
  donorTerms: 3000,
  rightsAccessPrivacy: 3000,
  proposedAction: 32,
  rationale: 4000,
  risksToVerify: 3000,
  reviewer: 160,
  reviewDate: 80,
  signoffStatus: 160,
  suppliedNotes: 12000
};

const FIELD_LABELS = {
  title: "title",
  reference: "reference",
  materialSummary: "material summary",
  collectionPolicy: "collection policy",
  appraisalCriteria: "appraisal criteria",
  evidentialValue: "evidential value",
  informationalValue: "informational value",
  legalAdministrativeValue: "legal/administrative value",
  researchValue: "research value",
  duplication: "duplication",
  condition: "condition",
  formatRisk: "format risk",
  donorTerms: "donor terms",
  rightsAccessPrivacy: "rights/access/privacy issues",
  proposedAction: "proposed action",
  rationale: "appraisal rationale",
  risksToVerify: "risks to verify",
  reviewer: "reviewer",
  reviewDate: "review date",
  signoffStatus: "sign-off status",
  suppliedNotes: "supplied notes"
};

export const INPUT_TEMPLATE = Object.freeze({
  title: "",
  reference: "",
  materialSummary: "",
  collectionPolicy: "",
  appraisalCriteria: "",
  evidentialValue: "",
  informationalValue: "",
  legalAdministrativeValue: "",
  researchValue: "",
  duplication: "",
  condition: "",
  formatRisk: "",
  donorTerms: "",
  rightsAccessPrivacy: "",
  proposedAction: "",
  rationale: "",
  risksToVerify: "",
  reviewer: "",
  reviewDate: "",
  signoffStatus: "",
  suppliedNotes: ""
});

export function parseAppraisalInput(raw) {
  let candidate = raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && Object.hasOwn(raw, "input")) {
    const wrapperFields = Object.keys(raw).filter((key) => key !== "input");
    if (wrapperFields.length) throw new Error(`Unknown wrapper field${wrapperFields.length === 1 ? "" : "s"}: ${wrapperFields.join(", ")}.`);
    candidate = raw.input;
  }
  if (candidate === null || Array.isArray(candidate) || typeof candidate !== "object") {
    throw new Error("Appraisal input must be a JSON object.");
  }

  const unknown = Object.keys(candidate).filter((key) => !Object.hasOwn(FIELD_LIMITS, key));
  if (unknown.length) throw new Error(`Unknown input field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);

  const input = {};
  for (const [key, max] of Object.entries(FIELD_LIMITS)) {
    const value = candidate[key];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") throw new Error(`Input field ${key} must be text.`);
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (trimmed.length > max) throw new Error(`Input field ${key} exceeds ${max} characters.`);
    if (trimmed.includes("\0")) throw new Error(`Input field ${key} cannot contain null characters.`);
    if ([...trimmed].some((character) => character.codePointAt(0) >= 0xd800 && character.codePointAt(0) <= 0xdfff)) {
      throw new Error(`Input field ${key} cannot contain unpaired Unicode surrogates.`);
    }
    input[key] = trimmed;
  }

  if (input.proposedAction && !APPRAISAL_ACTIONS.includes(input.proposedAction)) {
    throw new Error(`Input field proposedAction must be one of: ${APPRAISAL_ACTIONS.join(", ")}.`);
  }
  if (!input.title && !input.reference && !input.suppliedNotes) {
    throw new Error("Provide a title, reference or supplied notes.");
  }
  return input;
}

export function identifyMissingFacts(input) {
  const missing = [];
  if (!input.title && !input.reference) missing.push("title or reference");
  if (!input.materialSummary && !input.suppliedNotes) missing.push("material summary");
  if (!input.collectionPolicy && !input.appraisalCriteria) missing.push("collection policy or appraisal criteria");
  if (!input.proposedAction) missing.push("proposed action");
  if (!input.rationale) missing.push("appraisal rationale");
  if (!input.rightsAccessPrivacy) missing.push("rights/access/privacy issues");
  if (!input.signoffStatus) missing.push("sign-off status");
  return missing;
}

export function buildAppraisalReport(rawInput, { generatedAt = new Date().toISOString(), source = { type: "json" } } = {}) {
  const input = parseAppraisalInput(rawInput);
  const missingFacts = identifyMissingFacts(input);
  return {
    schemaVersion: "1.0",
    tool: {
      name: "appraisal-decision-log-cli",
      version: TOOL_VERSION,
      rulesVersion: RULES_VERSION,
      sourceCommit: SOURCE_COMMIT
    },
    generatedAt,
    source,
    input,
    summary: buildSummaryFields(input, missingFacts),
    missingFacts,
    caveats: appraisalCaveats()
  };
}

function buildSummaryFields(input, missingFacts) {
  return {
    suppliedFieldCount: Object.keys(input).length,
    proposedAction: input.proposedAction ?? null,
    policyOrCriteriaSupplied: Boolean(input.collectionPolicy || input.appraisalCriteria),
    rightsAccessPrivacySupplied: Boolean(input.rightsAccessPrivacy),
    donorTermsSupplied: Boolean(input.donorTerms),
    reviewerSupplied: Boolean(input.reviewer),
    signoffStatusSupplied: Boolean(input.signoffStatus),
    missingFactCount: missingFacts.length
  };
}

export function buildPrivacySummary(report) {
  return {
    schemaVersion: report.schemaVersion,
    tool: report.tool,
    generatedAt: report.generatedAt,
    summary: report.summary,
    missingFacts: report.missingFacts,
    caveats: report.caveats
  };
}

export function buildAppraisalCsv(report) {
  const input = report.input;
  const values = [
    input.reference ?? "",
    input.title ?? "",
    actionLabel(input.proposedAction ?? ""),
    [input.collectionPolicy, input.appraisalCriteria].filter(Boolean).join("\n\n"),
    input.materialSummary ?? "",
    input.rationale ?? "",
    input.risksToVerify ?? "",
    input.reviewer ?? "",
    input.reviewDate ?? "",
    input.signoffStatus ?? "",
    report.missingFacts.join("; ")
  ];
  return `${CSV_HEADERS.join(",")}\n${values.map(spreadsheetCsvCell).join(",")}\n`;
}

export function buildAppraisalMarkdown(report) {
  const input = report.input;
  const suppliedFields = Object.entries(FIELD_LABELS)
    .filter(([key]) => key !== "suppliedNotes")
    .map(([key, label]) => {
      const value = input[key] ?? "Not supplied";
      return `- ${label}: ${markdownInline(key === "proposedAction" ? actionLabel(value) : value)}`;
    });

  return [
    "# Draft Appraisal Decision Log",
    "",
    `Generated by appraisal-decision-log-cli ${TOOL_VERSION} using rules ${RULES_VERSION}. This draft records supplied evidence for professional review. It is not a completed appraisal, final disposal, transfer or destruction decision, and it is not authority to act on the material.`,
    "",
    "## Supplied Facts",
    "",
    ...suppliedFields,
    "",
    "## Supplied Notes",
    "",
    markdownLiteralBlock(input.suppliedNotes ?? "Not supplied"),
    "",
    "## Draft Decision Position For Review",
    "",
    `- proposed action: ${markdownInline(input.proposedAction ? actionLabel(input.proposedAction) : "Not supplied")}`,
    `- rationale: ${markdownInline(input.rationale ?? "Not supplied")}`,
    `- risks to verify: ${markdownInline(input.risksToVerify ?? "Not supplied")}`,
    `- sign-off status: ${markdownInline(input.signoffStatus ?? "Not supplied")}`,
    "",
    "## Missing Facts",
    "",
    ...(report.missingFacts.length ? report.missingFacts.map((fact) => `- ${fact}`) : ["- None recorded by this draft."]),
    "",
    "## Caveats",
    "",
    ...report.caveats.map((caveat) => `- ${caveat}`),
    ""
  ].join("\n");
}

export function appraisalCaveats() {
  return [
    "This record is a draft planning aid for professional review.",
    "Blank or missing facts are not treated as authority to retain, sample, discard, transfer, destroy or sell material.",
    "The tool does not invent institutional policy, donor agreements, statutory duties, duplicate holdings elsewhere, market value or sign-off.",
    "A proposed action remains a proposal until an authorised decision-maker approves it under institutional policy.",
    "Final appraisal and disposal decisions remain with the archivist, institution and authorised decision-maker."
  ];
}

export function actionLabel(value) {
  return {
    keep: "Keep",
    sample: "Sample",
    discard: "Discard",
    transfer: "Transfer",
    review_further: "Review further"
  }[value] ?? value;
}

function spreadsheetCsvCell(value) {
  const raw = String(value);
  const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  const escaped = safe.replace(/"/g, '""');
  return /[",\n\r]|^\s|\s$/.test(safe) ? `"${escaped}"` : escaped;
}

function markdownInline(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\/g, "\\\\")
    .replace(/([`*_\[\]|])/g, "\\$1")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function markdownLiteralBlock(value) {
  return String(value)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}
