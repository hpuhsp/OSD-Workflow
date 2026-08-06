import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const schemaRoot = join(dirname(fileURLToPath(import.meta.url)), "..", ".ai", "schemas");

function typeMatches(value, type) {
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function validate(value, schema, path, errors) {
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${path} must be ${schema.type}.`);
    return;
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} must equal ${JSON.stringify(schema.const)}.`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(", ")}.`);
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${path} must not be empty.`);
    if (schema.pattern && !(new RegExp(schema.pattern, "u")).test(value)) errors.push(`${path} has invalid format.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${path} must not be empty.`);
    value.forEach((item, index) => validate(item, schema.items ?? {}, `${path}[${index}]`, errors));
  }
  if (schema.type === "object" && value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const field of schema.required ?? []) if (!(field in value)) errors.push(`${path}.${field} is required.`);
    if (schema.additionalProperties === false) {
      for (const field of Object.keys(value)) if (!(field in (schema.properties ?? {}))) errors.push(`${path}.${field} is not allowed.`);
    }
    for (const [field, child] of Object.entries(schema.properties ?? {})) if (field in value) validate(value[field], child, `${path}.${field}`, errors);
  }
}

export function validateDocument(schemaFile, value) {
  const schema = JSON.parse(readFileSync(join(schemaRoot, schemaFile), "utf8"));
  const errors = [];
  validate(value, schema, "$", errors);
  return errors;
}
