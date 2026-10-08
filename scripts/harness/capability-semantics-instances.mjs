#!/usr/bin/env node
// H02 typed-fixture generator (DeepSeek Harness owner file).
//
// Reads a descriptor export (MiniMax's `generated/descriptors.json`, passed
// explicitly with --descriptors so no other worktree path is hard-coded) and
// produces, for every tool, a SYNTHETIC instance that actually satisfies the
// registered output schema: every declared property is populated recursively,
// nullable branches take their non-null form, and arrays carry one generated
// element. Values are deliberately synthetic markers or neutral zeros — no real
// business data, no model output, no database read.
//
// It also reports, with JSON-pointer evidence:
//   * malformed schemas (a `type` keyword that is neither a string nor an array
//     of strings),
//   * schema keywords outside the subset the validator implements, so nothing is
//     validated silently;
//   * tools for which no instance could be produced.
//
// Read-only with respect to the descriptor file. Offline: no network, no model,
// no service, no database.
//
// Usage:
//   node scripts/harness/capability-semantics-instances.mjs --descriptors <path> [--summary]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { validateAgainstSchema, schemaUnsupportedKeywords } from './capability-semantics.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every declared property is populated, so `required` is always satisfied. */
export function generateInstance(schema, name = 'value') {
  if (!schema || typeof schema !== 'object') return null;
  const declared = schema.type === undefined
    ? null
    : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  const pick = (candidates) => candidates.find((candidate) => (declared ?? []).includes(candidate));
  if (declared && !declared.some((type) => type !== 'null')) return null;

  const chosen = declared
    ? (pick(['object', 'array', 'string', 'integer', 'number', 'boolean']) ?? declared[0])
    : (schema.properties ? 'object' : schema.items ? 'array' : 'string');

  switch (chosen) {
    case 'object': {
      const out = {};
      for (const [key, child] of Object.entries(schema.properties ?? {})) {
        out[key] = generateInstance(child, key);
      }
      return out;
    }
    case 'array':
      return schema.items ? [generateInstance(schema.items, name)] : [];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'null':
      return null;
    default:
      // Synthetic, self-labelling string: no enum/pattern/format constraint is
      // present in the Java contracts, so any string conforms.
      return `synthetic-${name}`;
  }
}

/** A `type` keyword must be a string or an array of strings. */
function malformedTypes(schema, pointer, out = []) {
  if (!schema || typeof schema !== 'object') return out;
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => malformedTypes(item, `${pointer}/${index}`, out));
    return out;
  }
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && !(typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string')))) {
      out.push(`${pointer}/type = ${JSON.stringify(value)}`);
    }
    if (key === 'properties' && value && typeof value === 'object') {
      for (const [prop, child] of Object.entries(value)) malformedTypes(child, `${pointer}/properties/${prop}`, out);
    } else if (key === 'items') {
      malformedTypes(value, `${pointer}/items`, out);
    }
  }
  return out;
}

export function buildTypedFixtures(descriptors, { source = {} } = {}) {
  const schemas = {};
  const instances = {};
  const malformed = [];
  const unsupported = {};
  const failed = [];

  for (const descriptor of descriptors) {
    const name = descriptor.name;
    for (const [side, schema] of [['input', descriptor.inputSchema], ['output', descriptor.outputSchema]]) {
      const issues = malformedTypes(schema, `${name}/${side}`);
      if (issues.length > 0) malformed.push(...issues);
    }
    const extra = [
      ...schemaUnsupportedKeywords(descriptor.inputSchema, `${name}/input`),
      ...schemaUnsupportedKeywords(descriptor.outputSchema, `${name}/output`),
    ];
    if (extra.length > 0) unsupported[name] = extra;

    schemas[name] = { inputSchema: descriptor.inputSchema, outputSchema: descriptor.outputSchema };
    try {
      const instance = generateInstance(descriptor.outputSchema, 'result');
      const violations = validateAgainstSchema(descriptor.outputSchema, instance);
      if (violations.length > 0) {
        failed.push({ name, violations });
      } else {
        instances[name] = instance;
      }
    } catch (error) {
      failed.push({ name, violations: [error.message] });
    }
  }

  return {
    generatorVersion: '1.0.0',
    source,
    descriptorCount: descriptors.length,
    malformed,
    unsupportedKeywords: unsupported,
    generatorFailures: failed,
    schemas,
    instances,
  };
}

function summarize(report) {
  const lines = [];
  lines.push(`descriptors        ${report.descriptorCount}`);
  lines.push(`instances          ${Object.keys(report.instances).length}`);
  lines.push(`malformed schemas  ${report.malformed.length}`);
  for (const item of report.malformed) lines.push(`  ${item}`);
  lines.push(`generator failures ${report.generatorFailures.length}`);
  for (const item of report.generatorFailures) lines.push(`  ${item.name}: ${item.violations.join('; ')}`);
  const withExtra = Object.entries(report.unsupportedKeywords);
  lines.push(`tools using schema keywords outside the validator subset: ${withExtra.length}`);
  for (const [name, keywords] of withExtra) lines.push(`  ${name}: ${keywords.join(', ')}`);
  return lines.join('\n');
}

function main(argv) {
  const index = argv.indexOf('--descriptors');
  if (index < 0 || !argv[index + 1]) {
    process.stderr.write('usage: capability-semantics-instances.mjs --descriptors <descriptors.json> [--summary]\n');
    return 2;
  }
  const path = resolve(argv[index + 1]);
  let descriptors;
  try {
    descriptors = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    process.stderr.write(`ERROR  cannot read descriptors at ${path}: ${error.message}\n`);
    return 2;
  }
  if (!Array.isArray(descriptors)) {
    process.stderr.write('ERROR  descriptors file must contain a JSON array\n');
    return 2;
  }
  const report = buildTypedFixtures(descriptors, { source: { file: 'generated/descriptors.json' } });
  const outIndex = argv.indexOf('--out');
  if (outIndex >= 0 && argv[outIndex + 1]) {
    writeFileSync(resolve(argv[outIndex + 1]), `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(argv.includes('--summary') ? `${summarize(report)}\n` : `${JSON.stringify(report, null, 2)}\n`);
  return report.malformed.length > 0 || report.generatorFailures.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
