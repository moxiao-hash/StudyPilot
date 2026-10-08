#!/usr/bin/env node
// H02 capability semantic validator (DeepSeek Harness owner file).
//
// Validates contracts/agent-capabilities/metadata.yaml — the supplemental
// *semantic* metadata keyed by the real Java wire names — and the human
// positive/negative fixtures in agent-service/tests/fixtures/capability-semantics.json.
//
// What this proves (machine-checkable):
//   * every registered wire name is covered exactly once, and nothing else is;
//   * the metadata never duplicates or overrides a Java descriptor fact
//     (effect / risk / scope / idempotency / schemas), and never carries an
//     owner, authorization or credential field;
//   * each `authoritative_facts[].fact` really exists in that tool's output
//     schema field list;
//   * each example input satisfies that tool's real input schema and never
//     includes ownerId;
//   * exposure follows the H02 shared boundary, and confirmation follows the
//     actual governance rule read from AgentGovernanceService;
//   * the declared red lines are structurally present.
//
// What this does NOT prove (human review required):
//   * that the prose is a *good* description, or that the stated boundary is
//     phrased well enough to steer a model. Keyword presence is structural
//     evidence only, never behavioural evidence.
//
// Offline only: no network, no model, no service, no database. Read-only with
// respect to the Java tree.
//
// Usage:
//   node scripts/harness/capability-semantics.mjs [--json]
//   node scripts/harness/capability-semantics.mjs --check   # frozen Java digests vs live source

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

import { collectCapabilityFacts, REPO_ROOT } from './capability-semantics-extract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_METADATA = join(REPO_ROOT, 'contracts', 'agent-capabilities', 'metadata.yaml');
export const DEFAULT_FIXTURE = join(REPO_ROOT, 'agent-service', 'tests', 'fixtures', 'capability-semantics.json');

class SemanticError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const IS_SHA256 = /^[0-9a-f]{64}$/;

function fail(code, message) {
  throw new SemanticError(code, message);
}

// ---------------------------------------------------------------------------
// Restricted YAML subset loader
// ---------------------------------------------------------------------------

/** Strip a trailing ` # comment` that is not inside quotes. */
function stripComment(line) {
  let single = false;
  let double = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single) double = !double;
    else if (char === '#' && !single && !double && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index);
    }
  }
  return line;
}

/** Index of the first ":" that is outside quotes, or -1. */
function keyColonIndex(text) {
  let single = false;
  let double = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single) double = !double;
    else if (char === ':' && !single && !double) return index;
  }
  return -1;
}

function parseScalar(raw) {
  const text = raw.trim();
  if (text === '' || text === '~' || text === 'null') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  if (/^-?\d+\.\d+$/.test(text)) return Number(text);
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      return JSON.parse(text.replace(/\\'/g, "'"));
    } catch {
      fail('E_YAML', `ambiguous double-quoted scalar (escape inner quotes): ${text.slice(0, 80)}`);
    }
  }
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

/** Split a flow collection body on commas at depth 0. */
function splitFlow(body) {
  const parts = [];
  let depth = 0;
  let single = false;
  let double = false;
  let current = '';
  for (const char of body) {
    if (char === "'" && !double) single = !single;
    else if (char === '"' && !single) double = !double;
    if (!single && !double) {
      if ('{[('.includes(char)) depth += 1;
      else if ('}])'.includes(char)) depth -= 1;
      else if (char === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }
    current += char;
  }
  if (current.trim() !== '') parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

function parseInline(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const out = {};
    for (const part of splitFlow(trimmed.slice(1, -1))) {
      const colon = part.indexOf(':');
      if (colon < 0) fail('E_YAML', `invalid flow mapping entry: ${part}`);
      const key = part.slice(0, colon).trim().replace(/^["']|["']$/g, '');
      out[key] = parseInline(part.slice(colon + 1));
    }
    return out;
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return splitFlow(trimmed.slice(1, -1)).map((part) => parseInline(part));
  }
  return parseScalar(trimmed);
}

/**
 * Parse the documented YAML subset. Supports block mappings, block sequences,
 * `- key: value` items, flow `{}`/`[]`, quoted and plain scalars, comments and
 * `|`/`>` block scalars. Anchors, aliases and multi-document streams are
 * rejected explicitly rather than silently mis-parsed.
 */
export function parseYamlSubset(text) {
  // A JSON document is a legal YAML subset, so accept it directly before the
  // line-oriented parser sees it.
  if (text.trim().startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch {
      // fall through for flow-style YAML
    }
  }
  if (/^\s*---/m.test(text) || /\n\s*---\s*\n/.test(text)) {
    fail('E_YAML', 'multi-document streams are not supported');
  }
  if (/(^|\s)[&*][A-Za-z0-9_]/.test(text)) {
    fail('E_YAML', 'anchors and aliases are not supported');
  }

  const rawLines = text.split('\n');
  const lines = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const content = stripComment(rawLines[index]).replace(/\t/g, '    ');
    if (content.trim() === '') continue;
    lines.push({ indent: content.length - content.trimStart().length, text: content.trim(), number: index + 1 });
  }

  let cursor = 0;
  const peek = () => lines[cursor];

  const parseBlockScalar = (indent, folded) => {
    const collected = [];
    while (cursor < lines.length && lines[cursor].indent > indent) {
      collected.push(lines[cursor].text);
      cursor += 1;
    }
    return folded ? collected.join(' ') : collected.join('\n');
  };

  const parseValueAfterKey = (rest, indent) => {
    const trimmed = rest.trim();
    if (trimmed === '|' || trimmed === '|-' || trimmed === '>-' || trimmed === '>') {
      return parseBlockScalar(indent, trimmed.startsWith('>'));
    }
    if (trimmed === '') {
      const next = peek();
      if (next && next.indent > indent) return parseBlock(next.indent);
      if (next && next.indent === indent && next.text.startsWith('- ')) return parseBlock(indent);
      return null;
    }
    return parseInline(trimmed);
  };

  const parseSequence = (indent) => {
    const items = [];
    while (cursor < lines.length) {
      const line = peek();
      if (line.indent !== indent || !line.text.startsWith('-')) break;
      cursor += 1;
      const rest = line.text.replace(/^-\s?/, '');
      if (rest === '') {
        const next = peek();
        items.push(next && next.indent > indent ? parseBlock(next.indent) : null);
        continue;
      }
      const colon = keyColonIndex(rest);
      const isMapping = colon > 0 && !rest.startsWith('{') && !rest.startsWith('[');
      if (isMapping) {
        const item = {};
        const key = rest.slice(0, colon).trim();
        item[key] = parseValueAfterKey(rest.slice(colon + 1), indent + 2);
        // Remaining keys of the same item are indented deeper than the dash.
        while (cursor < lines.length) {
          const following = peek();
          if (following.indent <= indent || following.text.startsWith('- ')) break;
          // Strict alignment: after "- key: value" the mapping column is
          // indent + 2, and every sibling key must sit exactly there.
          if (following.indent !== indent + 2) {
            fail(
              'E_YAML',
              `line ${following.number}: sibling key must align at column ${indent + 2} (found ${following.indent})`,
            );
          }
          const innerColon = keyColonIndex(following.text);
          if (innerColon < 0) fail('E_YAML', `line ${following.number}: expected "key: value"`);
          cursor += 1;
          const innerKey = following.text.slice(0, innerColon).trim();
          item[innerKey] = parseValueAfterKey(following.text.slice(innerColon + 1), following.indent);
        }
        items.push(item);
      } else {
        items.push(parseInline(rest));
      }
    }
    return items;
  };

  const parseBlock = (indent) => {
    const line = peek();
    if (line && line.text.startsWith('- ') && line.indent === indent) return parseSequence(indent);
    const map = {};
    while (cursor < lines.length) {
      const current = peek();
      if (current.indent !== indent || current.text.startsWith('- ')) break;
      const colon = keyColonIndex(current.text);
      if (colon < 0) fail('E_YAML', `line ${current.number}: expected "key: value"`);
      cursor += 1;
      const key = current.text.slice(0, colon).trim();
      map[key] = parseValueAfterKey(current.text.slice(colon + 1), indent);
    }
    return map;
  };

  if (lines.length === 0) return {};
  return parseBlock(lines[0].indent);
}

export function loadMetadata(path = DEFAULT_METADATA) {
  if (!existsSync(path)) fail('E_METADATA_MISSING', `metadata file not found: ${path}`);
  const text = readFileSync(path, 'utf8');
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    doc = parseYamlSubset(text);
  }
  if (typeof doc !== 'object' || doc === null) fail('E_YAML', 'metadata must be a mapping');
  return doc;
}

// ---------------------------------------------------------------------------
// Policies derived from Java facts
// ---------------------------------------------------------------------------

export function expectedExposure(tool, policy) {
  for (const rule of policy.rules) {
    const effect = rule.when.match(/effect == (\w+)/)?.[1];
    const categories = rule.when.match(/category in \[([^\]]+)\]/)?.[1]?.split(',').map((v) => v.trim());
    const notCategories = rule.when.match(/category not in \[([^\]]+)\]/)?.[1]?.split(',').map((v) => v.trim());
    if (effect && tool.effect !== effect) continue;
    if (categories && !categories.includes(tool.category)) continue;
    if (notCategories && notCategories.includes(tool.category)) continue;
    return rule;
  }
  return null;
}

export function expectedConfirmation(tool, policy) {
  if (tool.effect === 'WRITE') {
    return tool.riskLevel === 'HIGH' ? policy.rule.HIGH : policy.rule.LOW_ungranted;
  }
  return policy.rule.NONE;
}

/** Minimal input-schema check against the extracted declaration. */
/**
 * A legal OUTPUT instance must exist for every acceptable example and must agree
 * with the registered output contract at the level H02 can verify offline: the
 * container kind, and that no top-level key is outside the declared field list.
 * Per-field types, nested schemas and the required set need the upstream
 * manifest schema, which is not delivered yet, so they stay BLOCKED rather than
 * being asserted or silently skipped.
 */
/**
 * Validate a value against the subset of JSON Schema the Java output/input
 * contracts actually use: `type` (string or a nullable type array), `properties`,
 * `required`, `additionalProperties` and `items`. Returns a list of violations
 * (empty means conforming). Anything the subset does not cover is reported as
 * uncovered rather than silently accepted.
 */
export const SUPPORTED_SCHEMA_KEYWORDS = ['type', 'properties', 'required', 'additionalProperties', 'items'];
const UNSUPPORTED_SCHEMA_KEYWORDS = ['oneOf', 'anyOf', 'allOf', 'enum', 'const', 'pattern', 'format', 'minimum', 'maximum', 'minItems', 'maxItems', 'uniqueItems'];

export function schemaUnsupportedKeywords(schema, path = '$', out = []) {
  if (!schema || typeof schema !== 'object') return out;
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => schemaUnsupportedKeywords(item, `${path}[${index}]`, out));
    return out;
  }
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.includes(key)) out.push(`${path}.${key}`);
  }
  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    schemaUnsupportedKeywords(value, `${path}.properties.${key}`, out);
  }
  if (schema.items) schemaUnsupportedKeywords(schema.items, `${path}.items`, out);
  return out;
}

function jsonTypeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

export function validateAgainstSchema(schema, value, path = '$', violations = []) {
  if (!schema || typeof schema !== 'object') return violations;
  const declared = schema.type === undefined
    ? null
    : (Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (declared) {
    const actual = jsonTypeOf(value);
    const conforms = declared.includes(actual) || (actual === 'integer' && declared.includes('number'));
    if (!conforms) {
      violations.push(`${path}: expected ${declared.join('|')}, got ${actual}`);
      return violations;
    }
  }
  if (value === null) return violations;
  if (Array.isArray(value)) {
    if (schema.items) {
      value.forEach((item, index) => validateAgainstSchema(schema.items, item, `${path}[${index}]`, violations));
    }
    return violations;
  }
  if (typeof value === 'object') {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, required)) {
        violations.push(`${path}: missing required property "${required}"`);
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) violations.push(`${path}: undeclared property "${key}"`);
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key in properties) validateAgainstSchema(properties[key], child, `${path}.${key}`, violations);
    }
  }
  return violations;
}

export function checkExampleOutput(tool, output, fixtureKind, present = true) {
  // A MISSING output field is not the same as an explicit null: the first is an
  // absent fixture, the second is a legitimate result only where the registered
  // output is nullable. Deleting the field must therefore never pass.
  if (!present) {
    fail(
      'E_OUTPUT_INSTANCE',
      `${tool.name}: the example must declare an explicit output field (a missing result is not a null result)`,
    );
  }
  if (fixtureKind === 'contract_defect') {
    if (output !== null) {
      fail('E_OUTPUT_INSTANCE', `${tool.name}: a contract-defect example must declare an explicit null result`);
    }
    return;
  }
  const nullable = tool.nullableTopLevel === true;
  if (output === null) {
    // A registered nullable top-level output is the only legal null result.
    if (nullable) return;
    fail('E_OUTPUT_INSTANCE', `${tool.name}: an acceptable example must include an output instance (only a nullable-output tool may return null)`);
  }
  const container = tool.outputContainer;
  const declared = new Set(tool.outputFields ?? []);
  // The instance must actually satisfy the registered contract, not merely look
  // shaped: this is what makes the placeholder era unacceptable as a positive.
  if (tool.outputSchema) {
    const violations = validateAgainstSchema(tool.outputSchema, output);
    if (violations.length > 0) {
      fail('E_SCHEMA_INSTANCE', `${tool.name}: output violates the registered output_schema: ${violations.slice(0, 4).join('; ')}`);
    }
  }
  if (container === 'array') {
    if (!Array.isArray(output)) {
      fail('E_OUTPUT_INSTANCE', `${tool.name}: output must be a JSON array`);
    }
    for (const [index, item] of output.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        fail('E_OUTPUT_INSTANCE', `${tool.name}: output[${index}] must be an object`);
      }
      for (const key of Object.keys(item)) {
        if (!declared.has(key)) {
          fail('E_OUTPUT_INSTANCE', `${tool.name}: output[${index}] has undeclared field "${key}"`);
        }
      }
    }
    return;
  }
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    fail('E_OUTPUT_INSTANCE', `${tool.name}: output must be a JSON object`);
  }
  for (const key of Object.keys(output)) {
    if (!declared.has(key)) {
      fail('E_OUTPUT_INSTANCE', `${tool.name}: output has undeclared field "${key}"`);
    }
  }
}

/**
 * Recursively reject identity, authorization and credential keys at ANY depth.
 * The Java registry only rejects a top-level `ownerId` argument, so a nested
 * forged identity (for example navigation params.ownerId) would otherwise slip
 * through the metadata even though it can never be a legitimate argument.
 */
function assertNoInjectedIdentity(tool, value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoInjectedIdentity(tool, item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (OWNER_KEYS.includes(key)) {
      fail('E_OWNER_INJECTION', `${tool.name}: nested example argument ${path}.${key} forges the caller identity`);
    }
    if (AUTHORIZATION_KEYS.includes(key)) {
      fail('E_AUTHORIZATION_LEAK', `${tool.name}: nested example argument ${path}.${key} carries authorization`);
    }
    if (CREDENTIAL_KEYS.includes(key)) {
      fail('E_CREDENTIAL_INJECTION', `${tool.name}: nested example argument ${path}.${key} carries credential material`);
    }
    assertNoInjectedIdentity(tool, child, `${path}.${key}`);
  }
}

/**
 * The navigation tool has its own whitelist semantics: routeKey must be one of
 * the routes Java registers, params must match exactly the required set for that
 * route, and each value must satisfy the Java SAFE_IDENTIFIER pattern.
 */
function checkNavigationExample(tool, input) {
  const routes = tool.routes ?? {};
  const routeKey = input.routeKey;
  if (!Object.prototype.hasOwnProperty.call(routes, routeKey)) {
    fail('E_NAVIGATION_ROUTE', `${tool.name}: routeKey "${routeKey}" is not in the Java route whitelist`);
  }
  const required = routes[routeKey];
  const params = input.params;
  if (required.length === 0) {
    if (params !== undefined && params !== null && Object.keys(params).length > 0) {
      fail('E_NAVIGATION_PARAMS', `${tool.name}: route "${routeKey}" takes no params, got ${JSON.stringify(Object.keys(params))}`);
    }
    return;
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    fail('E_NAVIGATION_PARAMS', `${tool.name}: route "${routeKey}" requires params ${JSON.stringify(required)}`);
  }
  const keys = Object.keys(params).sort();
  const expected = [...required].sort();
  if (keys.join(',') !== expected.join(',')) {
    fail(
      'E_NAVIGATION_PARAMS',
      `${tool.name}: route "${routeKey}" params must be exactly ${JSON.stringify(expected)}, got ${JSON.stringify(keys)}`,
    );
  }
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) {
      fail('E_NAVIGATION_SAFE_IDENTIFIER', `${tool.name}: param "${key}" must match the Java safe-identifier pattern`);
    }
  }
}

export function checkExampleInput(tool, input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    fail('E_EXAMPLE_SCHEMA', `${tool.name}: example input must be a JSON object`);
  }
  assertNoInjectedIdentity(tool, input, 'input');
  for (const key of Object.keys(input)) {
    // Identity is injected by Java and is never a caller argument; a metadata
    // example that carries it would teach a model to forge it.
    if (OWNER_KEYS.includes(key)) {
      fail('E_OWNER_INJECTION', `${tool.name}: example input must not carry "${key}"; Java injects identity`);
    }
    if (AUTHORIZATION_KEYS.includes(key)) {
      fail('E_AUTHORIZATION_LEAK', `${tool.name}: example input must not carry the authorization field "${key}"`);
    }
    if (!(key in tool.inputProperties)) {
      fail('E_EXAMPLE_SCHEMA', `${tool.name}: example input uses undeclared argument "${key}"`);
    }
    const declared = tool.inputProperties[key];
    const value = input[key];
    const ok = {
      string: () => typeof value === 'string',
      integer: () => Number.isInteger(value),
      number: () => typeof value === 'number' && Number.isFinite(value),
      boolean: () => typeof value === 'boolean',
      object: () => typeof value === 'object' && value !== null && !Array.isArray(value),
      array: () => Array.isArray(value),
    }[declared];
    if (!ok) fail('E_EXAMPLE_SCHEMA', `${tool.name}: "${key}" declares an unsupported type "${declared}"`);
    if (!ok()) fail('E_EXAMPLE_SCHEMA', `${tool.name}: "${key}" must be ${declared}`);
  }
  for (const required of tool.inputRequired) {
    if (!(required in input) || input[required] === null) {
      fail('E_EXAMPLE_SCHEMA', `${tool.name}: example input is missing required argument "${required}"`);
    }
  }
  if (tool.routes) checkNavigationExample(tool, input);
}

const OWNER_KEYS = ['ownerId', 'owner_id'];
const AUTHORIZATION_KEYS = ['grant', 'grants', 'authorization', 'authorizations', 'permissions', 'scope', 'scopes'];
const CREDENTIAL_KEYS = ['secret', 'secrets', 'apiKey', 'api_key', 'token', 'accessToken', 'credential', 'credentials', 'password'];
/** NavigationToolHandler.SAFE_IDENTIFIER, verbatim from the Java source. */
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const COMPLETION_CLAIMS = [
  /AI\s*(Rubric\s*)?(通过|及格)[^。]{0,12}(即|就|视为)[^。]{0,8}(完成|成功)/i,
  /PENDING[^。]{0,8}(即|算|视为)[^。]{0,8}(成功|完成)/i,
  /(评分|评审)通过[^。]{0,8}(即|就)[^。]{0,6}(完成|视为完成)/,
  /无需确认/,
  /不必确认/,
];

const CREDENTIAL_CLAIMS = [
  /可以读取[^。]{0,12}(Key|密钥|凭据)/i,
  /读取[^。]{0,8}明文/,
  /注入[^。]{0,10}(Key|密钥|凭据)/i,
  /代填[^。]{0,8}(Key|密钥|凭据)/i,
];

/**
 * Prohibition markers. A clause that forbids an action is the opposite of a
 * claim that permits it, so a keyword hit only counts when the clause is not a
 * prohibition. This keeps the check about the stated meaning rather than about
 * the mere presence of a word.
 */
const PROHIBITION = /不得|禁止|严禁|绝不|不能|不可|不允许|不得|never|must not|forbidden|not permitted/i;

/** Return the first clause that asserts a forbidden behaviour without forbidding it. */
function findPermissiveClaim(prose, patterns) {
  for (const clause of prose.split(/[。;；\n]/)) {
    for (const pattern of patterns) {
      if (pattern.test(clause) && !PROHIBITION.test(clause)) return { clause, pattern };
    }
  }
  return null;
}

/** Java class names available under backend/src/main/java, built once. */
let javaClassIndex = null;
/** Class simple name -> source text of the file declaring it (for method tracing). */
let javaClassSource = null;
function javaClasses() {
  if (javaClassIndex) return javaClassIndex;
  javaClassIndex = new Set();
  const root = join(REPO_ROOT, 'backend', 'src', 'main', 'java');
  if (!existsSync(root)) return javaClassIndex;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(directory, entry.name));
        continue;
      }
      if (!entry.name.endsWith('.java')) continue;
      const absolute = join(directory, entry.name);
      javaClassIndex.add(entry.name.slice(0, -'.java'.length));
      // Nested and secondary type declarations are real classes too (e.g. the
      // NavigationToolHandler.NavigationTarget record).
      const text = readFileSync(absolute, 'utf8');
      for (const declared of text.matchAll(/\b(?:class|interface|enum|record)\s+([A-Z][A-Za-z0-9_]*)/g)) {
        javaClassIndex.add(declared[1]);
      }
    }
  };
  walk(root);
  return javaClassIndex;
}

/** Source text per declared class name, so an unverified collaborator method can be traced. */
function javaClassSources() {
  if (javaClassSource) return javaClassSource;
  javaClassSource = new Map();
  const root = join(REPO_ROOT, 'backend', 'src', 'main', 'java');
  if (!existsSync(root)) return javaClassSource;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(directory, entry.name));
        continue;
      }
      if (!entry.name.endsWith('.java')) continue;
      const text = readFileSync(join(directory, entry.name), 'utf8');
      javaClassSource.set(entry.name.slice(0, -'.java'.length), text);
      for (const declared of text.matchAll(/\b(?:class|interface|enum|record)\s+([A-Z][A-Za-z0-9_]*)/g)) {
        javaClassSource.set(declared[1], text);
      }
    }
  };
  walk(root);
  return javaClassSource;
}

/**
 * Provenance must point at real source: the declared line range must exist and
 * must actually mention this wire name, and every class named in `handler` must
 * exist in the backend source tree. This is what stops a plausible-looking but
 * fabricated provenance string from passing.
 */
function checkProvenance(entry, tool) {
  const provenance = entry.source_provenance;
  if (!provenance || typeof provenance !== 'object') {
    fail('E_REQUIRED_FIELD_MISSING', `${entry.name}: source_provenance must be a mapping`);
  }
  const registration = provenance.registration;
  if (typeof registration !== 'string') {
    fail('E_PROVENANCE', `${entry.name}: source_provenance.registration must be a string`);
  }
  const match = /^(.+?)#L(\d+)(?:-L(\d+))?$/.exec(registration);
  if (!match) {
    fail('E_PROVENANCE', `${entry.name}: registration must look like path#Lstart or path#Lstart-Lend`);
  }
  const [, relative, startRaw, endRaw] = match;
  const absolute = join(REPO_ROOT, relative);
  if (!existsSync(absolute)) {
    fail('E_PROVENANCE', `${entry.name}: registration file does not exist: ${relative}`);
  }
  const lines = readFileSync(absolute, 'utf8').split('\n');
  const start = Number(startRaw);
  const end = endRaw === undefined ? start : Number(endRaw);
  if (end < start || start < 1 || end > lines.length) {
    fail('E_PROVENANCE', `${entry.name}: registration line range ${start}-${end} is out of bounds`);
  }
  if (!lines.slice(start - 1, end).join('\n').includes(`"${entry.name}"`)) {
    fail('E_PROVENANCE', `${entry.name}: the declared registration lines do not mention this wire name`);
  }
  const handler = provenance.handler;
  if (typeof handler !== 'string' || handler.trim() === '') {
    fail('E_PROVENANCE', `${entry.name}: source_provenance.handler is required`);
  }
  // Execution binding: every `Class.method` pair in the handler must either be
  // visible in THIS tool's own registration context (the real binding), or be
  // declared as an unverified deeper collaborator that must nevertheless trace to
  // real source. A fabricated binding can therefore not pass, and a fabricated
  // method cannot be laundered through the unverified list.
  const pairs = [...handler.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*[.#]\s*([a-z][A-Za-z0-9_]*)/g)]
    .map((found) => ({ className: found[1], method: found[2] }));
  if (pairs.length === 0) {
    fail('E_PROVENANCE', `${entry.name}: source_provenance.handler must name at least one "Class.method"`);
  }
  // Binding is a receiver/method PAIR, never the cartesian product of a class
  // set and a method set: `service.evaluate(...)` binds
  // RoadmapArtifactService#evaluate, and says nothing about ObjectMapper#evaluate.
  const boundPairs = new Set(tool.boundPairs ?? []);
  const unverified = new Set(provenance.unverified_symbols ?? []);
  const verifiedPairs = pairs.filter((pair) => boundPairs.has(`${pair.className}#${pair.method}`));
  if (verifiedPairs.length === 0) {
    fail(
      'E_PROVENANCE',
      `${entry.name}: no "Class.method" in the handler is bound in this tool's registration context`,
    );
  }
  const sources = javaClassSources();
  for (const pair of pairs) {
    const isBound = boundPairs.has(`${pair.className}#${pair.method}`);
    if (isBound) continue;
    const label = `${pair.className}.${pair.method}`;
    if (!unverified.has(label)) {
      fail(
        'E_PROVENANCE',
        `${entry.name}: "${label}" is not bound to this tool's registration and is not declared in source_provenance.unverified_symbols`,
      );
    }
    const source = sources.get(pair.className);
    if (source === undefined) {
      fail('E_PROVENANCE', `${entry.name}: unverified symbol class "${pair.className}" does not exist`);
    }
    const methodPattern = new RegExp(`\\b${pair.method}\\s*\\(`);
    if (!methodPattern.test(source)) {
      fail(
        'E_PROVENANCE',
        `${entry.name}: unverified symbol "${label}" names a method that does not exist on "${pair.className}"`,
      );
    }
  }
  if (typeof provenance.output_schema !== 'string' || !existsSync(join(REPO_ROOT, provenance.output_schema))) {
    fail('E_PROVENANCE', `${entry.name}: source_provenance.output_schema must point at an existing file`);
  }
}

function proseOf(entry) {
  return [
    entry.description,
    ...(entry.when_to_use ?? []),
    ...(entry.when_not_to_use ?? []),
    ...(entry.error_contract ?? []),
    entry.cost_hint?.notes,
    entry.exposure?.reason,
    entry.confirmation?.notes,
  ]
    .filter((value) => typeof value === 'string')
    .join('\n');
}

function collectKeys(value, path = '$', out = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectKeys(item, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // Tool example inputs are validated by checkExampleInput, which reports
      // owner injection and authorization fields with their own codes.
      if (key === 'input' && path.includes('examples[')) continue;
      out.push({ key, path: `${path}.${key}` });
      collectKeys(child, `${path}.${key}`, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

/**
 * Validate a metadata document against the frozen Java facts and the fixture
 * policies. Throws SemanticError with a stable `code` on the first violation.
 */
export function validateMetadata(doc, fixture, tools) {
  const contract = fixture.metadataContract;
  const byName = new Map();
  for (const tool of tools) byName.set(tool.name, tool);
  const navigation = fixture.frozenFacts.navigation;

  // The typed fixtures are derived from the upstream descriptor export, so that
  // provenance and the contracts themselves must be frozen, not inferred.
  const provenance = fixture.frozenFacts.descriptorProvenance;
  if (!isPlainObject(provenance)) {
    fail('E_SCHEMA_INSTANCE', 'frozenFacts.descriptorProvenance is missing: the typed fixtures must record their source');
  }
  for (const field of ['artifact', 'artifactSha256', 'manifestSchema', 'manifestSchemaSha256', 'sourceCommit']) {
    if (!isNonEmptyString(provenance[field])) {
      fail('E_SCHEMA_INSTANCE', `frozenFacts.descriptorProvenance.${field} is required`);
    }
  }
  for (const field of ['artifactSha256', 'manifestSchemaSha256']) {
    if (!IS_SHA256.test(provenance[field])) {
      fail('E_SCHEMA_INSTANCE', `frozenFacts.descriptorProvenance.${field} must be a sha256 digest`);
    }
  }
  if (!/^[0-9a-f]{40}$/.test(provenance.sourceCommit)) {
    fail('E_SCHEMA_INSTANCE', 'frozenFacts.descriptorProvenance.sourceCommit must be a full commit hash');
  }
  const toolSchemas = fixture.frozenFacts.toolSchemas;
  if (!isPlainObject(toolSchemas) || Object.keys(toolSchemas).length === 0) {
    fail('E_SCHEMA_INSTANCE', 'frozenFacts.toolSchemas is missing: the registered contracts must be frozen for offline validation');
  }
  const all = [
    ...tools,
    {
      name: navigation.name,
      category: navigation.category,
      effect: navigation.effect,
      riskLevel: navigation.riskLevel,
      requiredScope: null,
      inputProperties: { routeKey: 'string', params: 'object' },
      inputRequired: ['routeKey'],
      outputFields: navigation.outputFields ?? [],
      boundClasses: navigation.boundClasses ?? [],
      boundMethods: navigation.boundMethods ?? [],
      boundPairs: navigation.boundPairs ?? [],
      routes: navigation.routes,
    },
  ];
  for (const tool of all) {
    const schemas = toolSchemas[tool.name];
    if (schemas) {
      tool.inputSchema = schemas.inputSchema;
      tool.outputSchema = schemas.outputSchema;
    } else {
      fail('E_SCHEMA_INSTANCE', `${tool.name}: no frozen input/output schema is recorded`);
    }
  }
  const expectedNames = new Set(all.map((tool) => tool.name));

  if (!Array.isArray(doc.tools)) fail('E_REQUIRED_FIELD_MISSING', 'metadata.tools must be a sequence');

  // --- coverage ------------------------------------------------------------
  const seen = new Set();
  for (const entry of doc.tools) {
    if (!entry || typeof entry.name !== 'string') {
      fail('E_REQUIRED_FIELD_MISSING', 'every metadata entry needs a string name');
    }
    if (seen.has(entry.name)) fail('E_DUPLICATE_TOOL', `duplicate metadata entry for "${entry.name}"`);
    seen.add(entry.name);
    if (!expectedNames.has(entry.name)) {
      fail('E_COVERAGE_UNKNOWN', `"${entry.name}" is not registered in the Java tool catalog`);
    }
  }
  for (const name of expectedNames) {
    if (!seen.has(name)) fail('E_COVERAGE_MISSING', `registered tool "${name}" has no metadata entry`);
  }

  // --- per tool ------------------------------------------------------------
  const descriptions = new Map();
  const boundarySets = new Map();
  for (const entry of doc.tools) {
    const tool = byName.get(entry.name)
      ?? all.find((candidate) => candidate.name === entry.name);

    for (const key of contract.requiredToolKeys) {
      if (!(key in entry)) {
        fail('E_REQUIRED_FIELD_MISSING', `${entry.name}: required metadata field "${key}" is missing`);
      }
    }
    for (const key of contract.forbiddenToolKeys) {
      if (key in entry) {
        fail('E_JAVA_FACT_OVERRIDE', `${entry.name}: metadata must not restate the Java fact "${key}"`);
      }
    }
    for (const { key, path } of collectKeys(entry)) {
      if (contract.forbiddenAnywhereKeys.includes(key)) {
        fail('E_AUTHORIZATION_LEAK', `${entry.name}: forbidden field "${key}" at ${path}`);
      }
    }

    checkProvenance(entry, tool);

    // semantic substance: no shared cliché standing in for real meaning
    if (typeof entry.description !== 'string' || entry.description.trim().length < 12) {
      fail('E_MISSING_SEMANTICS', `${entry.name}: description is missing or too short to be meaningful`);
    }
    if (descriptions.has(entry.description.trim())) {
      fail(
        'E_MISSING_SEMANTICS',
        `${entry.name}: description is identical to "${descriptions.get(entry.description.trim())}" (shared cliché)`,
      );
    }
    descriptions.set(entry.description.trim(), entry.name);

    if (!Array.isArray(entry.when_to_use) || entry.when_to_use.length === 0) {
      fail('E_MISSING_SEMANTICS', `${entry.name}: when_to_use must be a non-empty list`);
    }
    if (!Array.isArray(entry.when_not_to_use) || entry.when_not_to_use.length === 0) {
      fail('E_MISSING_SEMANTICS', `${entry.name}: when_not_to_use must be a non-empty list`);
    }
    const boundaryKey = JSON.stringify(entry.when_not_to_use);
    if (boundarySets.has(boundaryKey)) {
      fail(
        'E_MISSING_SEMANTICS',
        `${entry.name}: when_not_to_use is identical to "${boundarySets.get(boundaryKey)}" (shared cliché)`,
      );
    }
    boundarySets.set(boundaryKey, entry.name);

    // authoritative facts must exist in the real output schema
    if (!Array.isArray(entry.authoritative_facts) || entry.authoritative_facts.length === 0) {
      fail('E_REQUIRED_FIELD_MISSING', `${entry.name}: authoritative_facts must be a non-empty list`);
    }
    for (const fact of entry.authoritative_facts) {
      if (!fact || typeof fact.fact !== 'string') {
        fail('E_FABRICATED_FACT', `${entry.name}: authoritative_facts entries need a "fact" string`);
      }
      if (!tool.outputFields.includes(fact.fact)) {
        fail(
          'E_FABRICATED_FACT',
          `${entry.name}: authoritative fact "${fact.fact}" is not a field of this tool's output schema`,
        );
      }
    }

    // examples must declare their outcome, satisfy the real input schema when
    // they are acceptable, document why an illegal input is rejected, and carry
    // a legal output instance (or an explicit defect/error explanation).
    if (!Array.isArray(entry.examples) || entry.examples.length === 0) {
      fail('E_REQUIRED_FIELD_MISSING', `${entry.name}: examples must be a non-empty list`);
    }
    const contractDefect = (fixture.defectOverrides?.items ?? []).find((item) => item.tool === entry.name);
    // A tool with a verified defect has no success path, so it may not carry a
    // successful example at all. Checked before the per-example loop so the
    // reason is the defect, not a downstream kind mismatch.
    if (contractDefect && entry.examples.some((example) => example?.outcome === 'ok')) {
      fail(
        'E_OUTPUT_INSTANCE',
        `${entry.name}: a tool with verified defect ${contractDefect.defectId} must not claim a successful example`,
      );
    }

    for (const example of entry.examples) {
      const outcome = example?.outcome;
      if (!['ok', 'rejected', 'unavailable'].includes(outcome)) {
        fail('E_OUTPUT_INSTANCE', `${entry.name}: example outcome "${outcome}" must be ok|rejected|unavailable`);
      }
      const FIXTURE_KINDS = ['synthetic_typed', 'rejection', 'contract_defect', 'nullable_empty'];
      if (!FIXTURE_KINDS.includes(example.fixture_kind)) {
        fail('E_OUTPUT_INSTANCE', `${entry.name}: example fixture_kind "${example.fixture_kind}" is not recognised`);
      }
      if (typeof example.fixture_source !== 'string' || !existsSync(join(REPO_ROOT, example.fixture_source))) {
        fail('E_OUTPUT_INSTANCE', `${entry.name}: example fixture_source must point at an existing file`);
      }
      if (typeof example.expect !== 'string' || example.expect.trim() === '') {
        fail('E_OUTPUT_INSTANCE', `${entry.name}: example expect is required`);
      }
      // outcome and fixture_kind must agree: a schema-valid synthetic instance is
      // the only acceptable positive, an explicit null only for a nullable
      // contract, a rejection only for a provably illegal input, and a contract
      // defect only where the tool genuinely has no success path.
      const expectedKind = outcome === 'ok'
        ? (example.fixture_kind === 'nullable_empty' ? 'nullable_empty' : 'synthetic_typed')
        : (outcome === 'rejected' ? 'rejection' : 'contract_defect');
      if (example.fixture_kind !== expectedKind) {
        fail(
          'E_SCHEMA_INSTANCE',
          `${entry.name}: outcome "${outcome}" requires fixture_kind "${expectedKind}", got "${example.fixture_kind}"`,
        );
      }
      if (example.fixture_kind === 'synthetic_typed'
        && example.fixture_source !== 'scripts/harness/capability-semantics-instances.mjs') {
        fail('E_SCHEMA_INSTANCE', `${entry.name}: a synthetic instance must name its generator as fixture_source`);
      }
      if (example.fixture_kind === 'nullable_empty') {
        if (tool.nullableTopLevel !== true) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: nullable_empty used on a non-nullable output contract`);
        }
        if (!Object.prototype.hasOwnProperty.call(example, 'output') || example.output !== null) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: nullable_empty must declare an explicit null output`);
        }
        if (outcome !== 'ok') {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: nullable_empty describes a valid empty state, so outcome must be ok`);
        }
      }

      // Input legality: our own derived checks give the specific cause, and the
      // registered input_schema confirms it against the real contract.
      let inputError = null;
      try {
        checkExampleInput(tool, example.input);
      } catch (error) {
        if (!(error instanceof SemanticError)) throw error;
        inputError = error;
      }
      const inputViolations = tool.inputSchema ? validateAgainstSchema(tool.inputSchema, example.input) : [];
      const inputIllegal = Boolean(inputError) || inputViolations.length > 0;

      if (outcome === 'ok') {
        if (inputError) {
          // Propagate the specific cause (owner injection, route, params,
          // credentials) rather than flattening everything to a schema error.
          fail(inputError.code, `${entry.name}: outcome "ok" but the input is illegal (${inputError.message})`);
        }
        if (inputViolations.length > 0) {
          fail(
            'E_SCHEMA_INSTANCE',
            `${entry.name}: input violates the registered input_schema: ${inputViolations.slice(0, 4).join('; ')}`,
          );
        }
        checkExampleOutput(tool, example.output, example.fixture_kind, Object.prototype.hasOwnProperty.call(example, 'output'));
        if (example.error) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: an "ok" example must not declare an error`);
        }
      } else if (outcome === 'rejected') {
        if (!inputIllegal) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: outcome "rejected" but the input passes every rule`);
        }
        if (!example.error || typeof example.error.code !== 'string' || !example.error.message) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: a rejected example must declare error.code and error.message`);
        }
        if (example.output !== null && example.output !== undefined) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: a rejected example must not claim a result`);
        }
      } else {
        // unavailable: the input is legal but the tool cannot currently succeed.
        if (inputIllegal) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: outcome "unavailable" requires a legal input`);
        }
        if (!contractDefect) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: outcome "unavailable" needs a frozen contract defect`);
        }
        if (!example.error || typeof example.error.code !== 'string' || !example.error.message) {
          fail('E_OUTPUT_INSTANCE', `${entry.name}: an unavailable example must declare the real error`);
        }
        checkExampleOutput(tool, example.output, example.fixture_kind, Object.prototype.hasOwnProperty.call(example, 'output'));
      }
    }

    // exposure follows the H02 boundary, not the effect alone; a tool with a
    // verified contract defect cannot be `allowed` because it fails the
    // implementation condition, so the override wins over the category rule.
    const defectOverride = (fixture.defectOverrides?.items ?? []).find((item) => item.tool === entry.name);
    const exposureRule = expectedExposure(tool, fixture.exposurePolicy);
    if (!exposureRule) fail('E_EXPOSURE_POLICY', `${entry.name}: no exposure rule matches this tool`);
    const requiredState = defectOverride ? defectOverride.state : exposureRule.state;
    const actualState = entry.exposure?.state;
    if (!['allowed', 'disabled', 'pending'].includes(actualState)) {
      fail('E_EXPOSURE_POLICY', `${entry.name}: exposure.state "${actualState}" is not a valid state`);
    }
    if (actualState !== requiredState) {
      const source = defectOverride ? `verified defect ${defectOverride.defectId}` : `policy ${exposureRule.id}`;
      fail(
        'E_EXPOSURE_POLICY',
        `${entry.name}: exposure.state is "${actualState}" but ${source} requires "${requiredState}"`,
      );
    }
    if (typeof entry.exposure?.reason !== 'string' || entry.exposure.reason.trim() === '') {
      fail('E_EXPOSURE_POLICY', `${entry.name}: exposure.reason is required`);
    }
    if (defectOverride) {
      for (const token of defectOverride.reasonMustContain ?? []) {
        if (!entry.exposure.reason.includes(token)) {
          fail(
            'E_EXPOSURE_POLICY',
            `${entry.name}: the exposure reason for defect ${defectOverride.defectId} must name "${token}"`,
          );
        }
      }
    }

    // confirmation follows the real governance rule
    const confirmation = expectedConfirmation(tool, fixture.confirmationPolicy);
    if (tool.effect === 'WRITE') {
      if (entry.confirmation?.mode !== confirmation.mode) {
        fail(
          'E_CONFIRMATION_POLICY',
          `${entry.name}: confirmation.mode is "${entry.confirmation?.mode}" but the governance rule for risk ${tool.riskLevel} requires "${confirmation.mode}"`,
        );
      }
      if (entry.confirmation?.waiting_status !== confirmation.waitingStatus) {
        fail(
          'E_CONFIRMATION_POLICY',
          `${entry.name}: confirmation.waiting_status is "${entry.confirmation?.waiting_status}" but should be "${confirmation.waitingStatus}"`,
        );
      }
    } else if (entry.confirmation?.mode !== 'none') {
      fail('E_CONFIRMATION_POLICY', `${entry.name}: a non-write tool must not require confirmation`);
    }

    // cost_hint is structural, not prose-based: `local` and
    // `external_dependency` must agree exactly, so a non-local claim has to name
    // a concrete dependency instead of being justified by wording.
    if (typeof entry.cost_hint?.local !== 'boolean') {
      fail('E_COST_HINT', `${entry.name}: cost_hint.local must be a boolean`);
    }
    if (typeof entry.cost_hint?.notes !== 'string' || entry.cost_hint.notes.trim() === '') {
      fail('E_COST_HINT', `${entry.name}: cost_hint.notes is required`);
    }
    const external = entry.cost_hint.external_dependency;
    if (entry.cost_hint.local === false) {
      if (typeof external !== 'string' || external.trim() === '') {
        fail(
          'E_COST_HINT',
          `${entry.name}: cost_hint.local is false, so external_dependency must name the outbound or deferred dependency`,
        );
      }
    } else if (external !== null) {
      fail(
        'E_COST_HINT',
        `${entry.name}: cost_hint.local is true, so external_dependency must be null (got ${JSON.stringify(external)})`,
      );
    }

    // prose must not claim completion or credential access
    const prose = proseOf(entry);
    const completion = findPermissiveClaim(prose, COMPLETION_CLAIMS);
    if (completion) {
      fail(
        'E_FABRICATED_COMPLETION',
        `${entry.name}: prose claims completion or a skippable confirmation: "${completion.clause.trim()}"`,
      );
    }
    if (entry.name === 'settings.ai_status.get') {
      const credential = findPermissiveClaim(prose, CREDENTIAL_CLAIMS);
      if (credential) {
        fail(
          'E_REDLINE_CREDENTIAL',
          `${entry.name}: prose permits credential plaintext access: "${credential.clause.trim()}"`,
        );
      }
    }
  }

  // --- red lines -----------------------------------------------------------
  for (const item of fixture.redLines.items) {
    const targets = item.tools.includes('*') ? doc.tools : doc.tools.filter((entry) => item.tools.includes(entry.name));
    if (item.tools.includes('*')) continue; // enforced by forbiddenAnywhereKeys
    for (const entry of targets) {
      if (item.requireWhenNotToUseAnyOf.length === 0) continue;
      const boundary = (entry.when_not_to_use ?? []).join('\n');
      if (!item.requireWhenNotToUseAnyOf.some((token) => boundary.includes(token))) {
        fail(
          'E_REDLINE_UNSTATED',
          `${entry.name}: the "${item.id}" boundary is not stated in when_not_to_use (${item.why})`,
        );
      }
    }
  }

  return {
    ok: true,
    tools: doc.tools.length,
    allowed: doc.tools.filter((entry) => entry.exposure.state === 'allowed').length,
    disabled: doc.tools.filter((entry) => entry.exposure.state === 'disabled').length,
    pending: doc.tools.filter((entry) => entry.exposure.state === 'pending').length,
    confirmations: doc.tools.filter((entry) => entry.confirmation.mode === 'always_user_confirmation').length,
    conditional: doc.tools.filter((entry) => entry.confirmation.mode === 'conditional_scope_grant').length,
    authoritativeFacts: doc.tools.reduce((sum, entry) => sum + entry.authoritative_facts.length, 0),
    examples: doc.tools.reduce((sum, entry) => sum + entry.examples.length, 0),
  };
}

// ---------------------------------------------------------------------------
// Negative-case mutation runner
// ---------------------------------------------------------------------------

function applyOps(doc, ops) {
  const mutated = JSON.parse(JSON.stringify(doc));
  for (const op of ops) {
    const find = (name) => mutated.tools.find((entry) => entry.name === name);
    switch (op.op) {
      case 'remove_tool':
        mutated.tools = mutated.tools.filter((entry) => entry.name !== op.tool);
        break;
      case 'duplicate_tool': {
        const source = find(op.tool);
        mutated.tools.push(JSON.parse(JSON.stringify(source)));
        break;
      }
      case 'append_tool':
        mutated.tools.push(op.value);
        break;
      case 'set_tool_field': {
        const target = find(op.tool);
        const parts = op.field.split('.');
        let node = target;
        for (const part of parts.slice(0, -1)) node = node[part];
        node[parts[parts.length - 1]] = op.value;
        break;
      }
      case 'delete_tool_field': {
        const target = find(op.tool);
        delete target[op.field];
        break;
      }
      case 'add_tool_field': {
        const target = find(op.tool);
        target[op.field] = op.value;
        break;
      }
      case 'push_tool_array': {
        const target = find(op.tool);
        target[op.field].push(op.value);
        break;
      }
      case 'set_example_input': {
        const target = find(op.tool);
        target.examples[op.index].input = op.value;
        break;
      }
      case 'delete_example_field': {
        const target = find(op.tool);
        for (const example of target.examples) delete example[op.field];
        break;
      }
      case 'delete_all_example_field': {
        for (const entry of mutated.tools) {
          for (const example of entry.examples) delete example[op.field];
        }
        break;
      }
      case 'set_example_field': {
        const target = find(op.tool);
        target.examples[op.index][op.field] = op.value;
        break;
      }
      case 'set_example_output': {
        const target = find(op.tool);
        target.examples[op.index].output = op.value;
        break;
      }
      case 'copy_tool_field': {
        const source = find(op.fromTool);
        const target = find(op.toTool);
        target[op.field] = source[op.field];
        break;
      }
      default:
        fail('E_FIXTURE', `unknown fixture operation "${op.op}"`);
    }
  }
  return mutated;
}

export function runNegativeCases(doc, fixture, tools) {
  const results = [];
  for (const testCase of fixture.negativeCases) {
    const mutated = applyOps(doc, testCase.ops);
    let actualCode = null;
    try {
      validateMetadata(mutated, fixture, tools);
    } catch (error) {
      if (!(error instanceof SemanticError)) throw error;
      actualCode = error.code;
    }
    results.push({
      id: testCase.id,
      intent: testCase.intent,
      expectErrorCode: testCase.expectErrorCode,
      actualErrorCode: actualCode,
      rejected: actualCode !== null,
      matchedExpectedCode: actualCode === testCase.expectErrorCode,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function runValidation({ metadataPath = DEFAULT_METADATA, fixturePath = DEFAULT_FIXTURE } = {}) {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const tools = fixture.frozenFacts.tools;
  const doc = loadMetadata(metadataPath);
  const report = validateMetadata(doc, fixture, tools);
  const negatives = runNegativeCases(doc, fixture, tools);
  const allRejected = negatives.every((entry) => entry.matchedExpectedCode);
  return {
    ...report,
    ok: report.ok && allRejected,
    negativeCases: negatives.length,
    negativeRejected: negatives.filter((entry) => entry.rejected).length,
    negativeMatchedExpectedCode: negatives.filter((entry) => entry.matchedExpectedCode).length,
    failures: negatives.filter((entry) => !entry.matchedExpectedCode),
  };
}

function main(argv) {
  const json = argv.includes('--json');

  if (argv.includes('--check')) {
    const fixture = JSON.parse(readFileSync(DEFAULT_FIXTURE, 'utf8'));
    const live = collectCapabilityFacts();
    const drift = [];
    for (const [relative, digest] of Object.entries(fixture.frozenFacts.javaSourceDigests ?? {})) {
      if (live.sourceDigests[relative] !== digest) drift.push(`source changed: ${relative}`);
    }
    if (live.toolCount !== fixture.frozenFacts.toolCount) {
      drift.push(`tool count changed: ${fixture.frozenFacts.toolCount} -> ${live.toolCount}`);
    }
    for (const tool of fixture.frozenFacts.tools) {
      const now = live.tools.find((candidate) => candidate.name === tool.name);
      if (!now) {
        drift.push(`registered tool disappeared: ${tool.name}`);
        continue;
      }
      for (const field of ['effect', 'riskLevel', 'requiredScope']) {
        if ((now[field] ?? null) !== (tool[field] ?? null)) {
          drift.push(`${tool.name}: ${field} ${tool[field]} -> ${now[field]}`);
        }
      }
    }
    if (drift.length === 0) {
      process.stdout.write('MATCH  frozen H02 capability facts still match the Java source\n');
      return 0;
    }
    for (const item of drift) process.stderr.write(`DRIFT  ${item}\n`);
    return 1;
  }

  try {
    const report = runValidation();
    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(
        [
          `PASS  ${report.tools} metadata entries (allowed ${report.allowed}, disabled ${report.disabled}, pending ${report.pending})`,
          `      confirmations: ${report.confirmations} always, ${report.conditional} conditional`,
          `      ${report.authoritativeFacts} authoritative facts, ${report.examples} examples`,
          `      negative fixtures ${report.negativeMatchedExpectedCode}/${report.negativeCases} rejected with the expected code`,
        ].join('\n') + '\n',
      );
    }
    return report.ok ? 0 : 1;
  } catch (error) {
    if (error instanceof SemanticError) {
      if (json) process.stdout.write(`${JSON.stringify({ ok: false, code: error.code, error: error.message }, null, 2)}\n`);
      else process.stderr.write(`FAIL  [${error.code}] ${error.message}\n`);
      return 1;
    }
    process.stderr.write(`ERROR  ${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}

