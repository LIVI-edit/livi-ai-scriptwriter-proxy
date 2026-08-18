"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(?:^|[_-])(authorization|cookie|set-cookie|openai_api_key|api_key|access_token|refresh_token|runtime_token|github(?:[_-]?token)?|vercel(?:[_-]?token)?|secret|password)(?:$|[_-])/i;
const BEARER_VALUE = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const OPENAI_SECRET_VALUE = /\bsk-[A-Za-z0-9_-]{12,}\b/g;
const GITHUB_PAT_VALUE = /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;
const GENERIC_ASSIGNMENT = /\b(?:OPENAI_API_KEY|api_key|access_token|refresh_token|runtime_token|GITHUB_TOKEN|VERCEL_TOKEN|secret|password)\s*[:=]\s*[^\s,;]+/gi;

function redactString(value) {
  return String(value)
    .replace(BEARER_VALUE, "Bearer [REDACTED]")
    .replace(OPENAI_SECRET_VALUE, REDACTED)
    .replace(GITHUB_PAT_VALUE, REDACTED)
    .replace(GENERIC_ASSIGNMENT, (match) => {
      const separator = match.includes(":") ? ":" : "=";
      const key = match.split(/[:=]/, 1)[0];
      return `${key}${separator}${REDACTED}`;
    });
}

function redactSecrets(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, seen));
  }

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(String(key))) {
      output[key] = REDACTED;
    } else {
      output[key] = redactSecrets(child, seen);
    }
  }
  return output;
}

function serializeSanitized(value) {
  return JSON.stringify(redactSecrets(value), null, 2);
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeSanitizedJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${serializeSanitized(value)}\n`, "utf8");
}

function writeSanitizedText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${redactString(value)}\n`, "utf8");
}

function writeSanitizedNdjson(filePath, values) {
  ensureDir(path.dirname(filePath));
  const rows = Array.isArray(values) ? values : [];
  const content = rows.map((value) => JSON.stringify(redactSecrets(value))).join("\n");
  fs.writeFileSync(filePath, content ? `${content}\n` : "", "utf8");
}

function extractProviderModelOutputText(providerPayload) {
  if (!providerPayload || typeof providerPayload !== "object") return "";
  return (
    providerPayload.output_text ||
    (Array.isArray(providerPayload.output)
      ? providerPayload.output
          .flatMap((item) => item.content || [])
          .filter((item) => item.type === "output_text" && item.text)
          .map((item) => item.text)
          .join("\n")
      : "")
  );
}

function providerModelOutputArtifactName(callIndex, surface) {
  const index = String(Number(callIndex) || 0).padStart(2, "0");
  const safeSurface = String(surface || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_") || "unknown";
  return `provider_model_output_${index}_${safeSurface}.json`;
}

async function captureProviderModelOutput({ response, callIndex, surface, artifactDir }) {
  const diagnostic = {
    call_index: Number(callIndex) || 0,
    http_status: Number(response && response.status) || 0,
    surface: surface ? String(surface) : null,
    model_output_text: null,
    model_output_json: null,
    parse_error: null,
  };

  try {
    if (!response || typeof response.clone !== "function") {
      throw Object.assign(new Error("Provider Response.clone() is unavailable"), { code: "PROVIDER_RESPONSE_CLONE_UNAVAILABLE" });
    }
    const providerPayload = await response.clone().json();
    const modelOutputText = extractProviderModelOutputText(providerPayload);
    if (!modelOutputText) {
      diagnostic.parse_error = {
        code: "MODEL_OUTPUT_TEXT_MISSING",
        message: "Provider response contained no extractable model output text.",
      };
    } else {
      diagnostic.model_output_text = modelOutputText;
      try {
        diagnostic.model_output_json = JSON.parse(modelOutputText);
      } catch (error) {
        diagnostic.parse_error = {
          code: "MODEL_OUTPUT_JSON_PARSE_FAILED",
          name: error && error.name ? String(error.name) : "Error",
          message: error && error.message ? String(error.message) : "Model output JSON parse failed.",
        };
      }
    }
  } catch (error) {
    diagnostic.parse_error = {
      code: error && error.code ? String(error.code) : "PROVIDER_RESPONSE_JSON_PARSE_FAILED",
      name: error && error.name ? String(error.name) : "Error",
      message: error && error.message ? String(error.message) : "Provider response diagnostic capture failed.",
    };
  }

  const fileName = providerModelOutputArtifactName(callIndex, surface);
  writeSanitizedJson(path.join(path.resolve(artifactDir), fileName), diagnostic);
  return { ...diagnostic, artifact_file: fileName };
}

function createTraceRecorder(options = {}) {
  const artifactDir = path.resolve(options.artifactDir || "tests/live/artifacts/proxy");
  const events = [];
  const startedAt = new Date().toISOString();

  function record(type, details = {}) {
    events.push({
      at: new Date().toISOString(),
      type: String(type || "event"),
      details: redactSecrets(details),
    });
  }

  function flush(metadata = {}) {
    ensureDir(artifactDir);
    writeSanitizedJson(path.join(artifactDir, "trace.json"), events);
    writeSanitizedJson(path.join(artifactDir, "run_metadata.json"), {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      ...redactSecrets(metadata),
    });
  }

  return Object.freeze({ artifactDir, events, record, flush });
}

module.exports = Object.freeze({
  REDACTED,
  redactSecrets,
  serializeSanitized,
  writeSanitizedJson,
  writeSanitizedText,
  writeSanitizedNdjson,
  extractProviderModelOutputText,
  providerModelOutputArtifactName,
  captureProviderModelOutput,
  createTraceRecorder,
});
