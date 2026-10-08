#!/usr/bin/env node
// H02 read-only capability-source extractor (DeepSeek Harness owner file).
//
// Emits the *factual* half of the capability catalog by reading the real Java
// registration source: tool names, categories, effects, risk levels, required
// scopes, idempotency requirements, timeouts, declared input properties and
// required sets, handler-service bindings, output-schema shape and the
// navigation route table.
//
// Read-only: it only reads files under the backend source tree. It performs no
// network access, starts nothing, touches no database and never invokes a
// handler. Nothing is written unless --out is given.
//
// IMPORTANT scope note: this extractor is a *drift and completeness cross-check*
// for the semantic metadata. It is NOT the authoritative catalog export — that
// is MiniMax's descriptor export from the running registry. A static parse can
// never prove registration completeness; it can only show that the frozen
// metadata still matches the source it claims to come from.
//
// Usage:
//   node scripts/harness/capability-semantics-extract.mjs            # JSON to stdout
//   node scripts/harness/capability-semantics-extract.mjs --summary  # human summary
//   node scripts/harness/capability-semantics-extract.mjs --check <facts.json>

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');

export const SOURCE_FILES = {
  registry: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolRegistry.java',
  descriptor: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolDescriptor.java',
  readConfig: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentReadToolConfiguration.java',
  writeConfig: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentWriteToolConfiguration.java',
  navigation: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/NavigationToolHandler.java',
  outputs: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolOutputSchemas.java',
  governance: 'backend/src/main/java/com/moxiao/studypilot/agent/application/AgentGovernanceService.java',
  actionService: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolActionService.java',
  effects: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolEffect.java',
  risks: 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolRiskLevel.java',
  scopes: 'backend/src/main/java/com/moxiao/studypilot/agent/domain/AgentScope.java',
  matrix: 'docs/agent-capability-matrix-v2.md',
};

function readSource(root, relative) {
  const path = join(root, relative);
  if (!existsSync(path)) {
    const error = new Error(`missing capability source file: ${relative}`);
    error.code = 'SOURCE_MISSING';
    throw error;
  }
  return readFileSync(path, 'utf8');
}

/** Byte-offset to 1-based line number. */
function lineAt(text, offset) {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === '\n') line += 1;
  }
  return line;
}

/** Extract the balanced-paren argument text starting at the '(' index. */
function balanced(text, openIndex) {
  let depth = 0;
  let inString = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, index);
    }
  }
  return null;
}

function parseStringMap(block, call) {
  const marker = `${call}(`;
  const at = block.indexOf(marker);
  if (at < 0) return {};
  const inner = balanced(block, at + marker.length - 1);
  if (inner === null || inner.trim() === '') return {};
  const out = {};
  const pattern = /"([^"]+)"\s*,\s*"([^"]+)"/g;
  let match;
  while ((match = pattern.exec(inner)) !== null) out[match[1]] = match[2];
  return out;
}

function parseStringSet(block, call) {
  const marker = `${call}(`;
  const at = block.indexOf(marker);
  if (at < 0) return [];
  const inner = balanced(block, at + marker.length - 1);
  if (inner === null || inner.trim() === '') return [];
  return [...inner.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/** Source text of the brace-balanced body starting at the first `{` after `from`. */
function methodBody(text, from) {
  const open = text.indexOf('{', from);
  if (open < 0) return '';
  let depth = 0;
  let inString = false;
  let inChar = false;
  let inLineComment = false;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (inChar) {
      if (char === '\\') index += 1;
      else if (char === "'") inChar = false;
      continue;
    }
    if (char === '/' && next === '/') { inLineComment = true; index += 1; continue; }
    if (char === '"') { inString = true; continue; }
    if (char === "'") { inChar = true; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open, index + 1);
    }
  }
  return text.slice(open);
}

/**
 * The bean method that declares a registration, its injected service types, and
 * the symbols actually visible in that method. The symbol sets are what a
 * declared handler binding is checked against: a class or method that appears
 * nowhere in the tool's own registration context cannot be its real binding.
 */
function enclosingBeanMethod(text, offset) {
  const before = text.slice(0, offset);
  const match = /AgentToolHandler\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
  let found = null;
  let candidate;
  while ((candidate = match.exec(before)) !== null) found = candidate;
  if (!found) return { beanMethod: null, handlerServices: [], boundClasses: [], boundMethods: [] };
  const handlerServices = found[2]
    .split(',')
    .map((part) => part.trim())
    .map((part) => part.replace(/\s+/g, ' '))
    .filter((part) => part && !/ObjectMapper|AgentToolRequestValidator|AgentToolTimeoutGuard/.test(part))
    .map((part) => {
      // The injected TYPE (not the parameter variable name) is the binding
      // evidence, e.g. "com...AssistantHealthService service" -> AssistantHealthService.
      const tokens = part.split(' ').filter(Boolean);
      const type = tokens.length >= 2 ? tokens[tokens.length - 2] : tokens[tokens.length - 1];
      return type.replace(/<.*>$/, '').split('.').pop();
    });
  // `match` is the RegExp object here, not a match result: use found.index.
  // (Using match.index would be undefined -> NaN -> indexOf('{', NaN) === 0 and
  // the "body" would silently span the whole file.)
  const body = methodBody(text, found.index + found[0].length);
  const context = `${found[0]} ${body}`;
  const boundClasses = [...new Set([...context.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)].map((m) => m[1]))].sort();
  const boundMethods = [...new Set([
    found[1],
    ...[...context.matchAll(/\b([a-z][a-z0-9_]*)\s*\(/g)].map((m) => m[1]),
  ])].sort();

  // Receiver -> declared type, so a call can be paired with the type that
  // actually receives it. Declared parameters and the lambda parameters of the
  // registration helper both contribute.
  const varTypes = new Map();
  for (const raw of found[2].split(',')) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) continue;
    const name = tokens[tokens.length - 1];
    const type = tokens[tokens.length - 2].replace(/<.*>$/, '').split('.').pop();
    if (name) varTypes.set(name, type);
  }
  const biFunction = /Bi(?:Function|Consumer)<\s*([A-Za-z0-9_.]+)\s*,\s*([A-Za-z0-9_.]+)/.exec(text);
  const lambdaTypes = biFunction
    ? [biFunction[1].split('.').pop(), biFunction[2].split('.').pop()]
    : ['AgentToolContext', 'JsonNode'];
  for (const lambda of body.matchAll(/\(\s*([a-z][A-Za-z0-9_]*)\s*,\s*([a-z][A-Za-z0-9_]*)\s*\)\s*->/g)) {
    if (!varTypes.has(lambda[1])) varTypes.set(lambda[1], lambdaTypes[0]);
    if (!varTypes.has(lambda[2])) varTypes.set(lambda[2], lambdaTypes[1]);
  }

  // Verified receiver.method pairs: the receiver's declared type paired with the
  // method actually called on it. This is what makes a binding claim checkable —
  // a class name and a method name co-existing in the context is NOT a binding.
  const pairs = new Set();
  for (const call of body.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*([a-z][A-Za-z0-9_]*)\s*\(/g)) {
    const receiver = call[1];
    const method = call[2];
    const type = varTypes.get(receiver)
      ?? (receiver === 'this' ? found[1] : (/^[A-Z]/.test(receiver) ? receiver : null));
    if (type) pairs.add(`${type}#${method}`);
  }
  const boundPairs = [...pairs].sort();
  return { beanMethod: found[1], handlerServices, boundClasses, boundMethods, boundPairs, varTypes: Object.fromEntries(varTypes) };
}

function scanRegistrations(text, kind) {
  const out = [];
  const pattern = new RegExp(`\\b${kind}\\(mapper, `, 'g');
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const openIndex = text.indexOf('(', match.index + kind.length);
    const block = balanced(text, openIndex);
    if (block === null) continue;
    const strings = [...block.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
    const name = strings[0];
    const category = strings[1];
    const { beanMethod, handlerServices, boundClasses, boundMethods, boundPairs } =
      enclosingBeanMethod(text, match.index);
    const entry = {
      name,
      category,
      beanMethod,
      handlerServices,
      boundClasses,
      boundMethods,
      boundPairs,
      registrationLine: lineAt(text, match.index),
      inputProperties: parseStringMap(block, 'Map.of'),
      inputRequired: parseStringSet(block, 'Set.of'),
    };
    if (kind === 'read') {
      entry.effect = 'READ';
      entry.riskLevel = 'NONE';
      entry.requiredScope = null;
      entry.idempotencyRequired = false;
      entry.timeoutMillis = 15000;
    } else {
      entry.effect = 'WRITE';
      const risk = /AgentToolRiskLevel\.([A-Z]+)/.exec(block);
      const scope = /"([A-Z_]+)",\s*ExecutionType\./.exec(block);
      const execution = /ExecutionType\.([A-Z_]+)/.exec(block);
      entry.riskLevel = risk ? risk[1] : null;
      entry.requiredScope = scope ? scope[1] : null;
      entry.executionType = execution ? execution[1] : null;
      entry.idempotencyRequired = true;
      entry.timeoutMillis = 120000;
      entry.validatedByBean = kind === 'writeValidated';
      if (kind === 'writeValidated') entry.effect = 'WRITE';
    }
    out.push(entry);
  }
  return out;
}

function scanNavigation(text) {
  const routes = {};
  const entries = /Map\.entry\("([A-Z_]+)",\s*Set\.of\(([^)]*)\)\)/g;
  let match;
  while ((match = entries.exec(text)) !== null) {
    routes[match[1]] = [...match[2].matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
  }
  return {
    name: 'navigation.resolve',
    category: 'NAVIGATION',
    effect: 'NAVIGATE',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    timeoutMillis: 15000,
    inputProperties: { routeKey: 'string', params: 'object' },
    inputRequired: ['routeKey'],
    routes,
    // Binding symbols for the navigation tool come from its own source file:
    // the descriptor is built in the constructor and invoke() is the entry point.
    boundClasses: [...new Set([...text.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)].map((m) => m[1]))].sort(),
    boundMethods: [...new Set([...text.matchAll(/\b([a-z][a-z0-9_]*)\s*\(/g)].map((m) => m[1]))].sort(),
    // The navigation tool IS the AgentToolHandler implementation (no bean
    // wrapper), so its own interface methods are the execution entry points.
    boundPairs: [...new Set([
      ...[...text.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*\.\s*([a-z][A-Za-z0-9_]*)\s*\(/g)].map((m) => `${m[1]}#${m[2]}`),
      ...[...text.matchAll(/\b(this)\s*\.\s*([a-z][A-Za-z0-9_]*)\s*\(/g)].map((m) => `NavigationToolHandler#${m[2]}`),
      'NavigationToolHandler#invoke',
      'NavigationToolHandler#descriptor',
    ])].sort(),
    registrationLine: lineAt(text, text.indexOf('new AgentToolDescriptor(')),
  };
}

/** Parse the output-schema catalog: tool -> spec expression tree. */
function parseOutputSchemas(text) {
  const specs = new Map();
  const declPattern = /private static final Spec ([A-Z0-9_]+)\s*=\s*([\s\S]*?);\n/g;
  let match;
  while ((match = declPattern.exec(text)) !== null) {
    specs.set(match[1], match[2].replace(/\s+/g, ' ').trim());
  }
  const catalog = new Map();
  const catalogStart = text.indexOf('static {');
  const catalogText = text.slice(catalogStart);
  const entryPattern = /\b(object|array)\("([^"]+)",\s*([A-Za-z0-9_]+(?:\([A-Za-z0-9_]+\))?)\)/g;
  let entry;
  while ((entry = entryPattern.exec(catalogText)) !== null) {
    const wrapper = /^([A-Za-z0-9_]+)\(([A-Za-z0-9_]+)\)$/.exec(entry[3]);
    catalog.set(entry[2], {
      container: entry[1],
      spec: wrapper ? wrapper[2] : entry[3],
      wrapper: wrapper ? wrapper[1] : null,
    });
  }

  /** Top-level field names of an object spec expression. */
  const fieldsOf = (specName, seen = new Set()) => {
    if (seen.has(specName)) return [];
    seen.add(specName);
    const expr = specs.get(specName);
    if (expr === undefined) return [];
    const objectAt = expr.indexOf('object(');
    if (objectAt < 0) {
      const inner = /^(?:nullable|array)\(([A-Za-z0-9_]+)\)$/.exec(expr);
      return inner ? fieldsOf(inner[1], seen) : [];
    }
    const inner = balanced(expr, objectAt + 'object'.length);
    if (inner === null) return [];
    const names = [];
    const pattern = /"([^"]+)"\s*,\s*/g;
    let field;
    while ((field = pattern.exec(inner)) !== null) names.push(field[1]);
    return names;
  };

  const result = {};
  for (const [tool, meta] of catalog.entries()) {
    const expr = specs.get(meta.spec) ?? '';
    // Only the CATALOG entry's own wrapper decides top-level nullability; nested
    // nullable(...) fields inside the spec must not leak into this flag.
    const nullable = meta.wrapper === 'nullable';
    let fields = fieldsOf(meta.spec);
    if (fields.length === 0 && meta.container === 'array') {
      const item = /array\(([A-Za-z0-9_]+)\)/.exec(expr);
      if (item) fields = fieldsOf(item[1]);
    }
    result[tool] = {
      container: meta.container,
      spec: meta.spec,
      nullableTopLevel: nullable,
      fields,
    };
  }
  return result;
}

function parseEnums(text) {
  const body = text.slice(text.indexOf('{') + 1, text.lastIndexOf('}'));
  return [...body.matchAll(/([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]);
}

export function collectCapabilityFacts(root = REPO_ROOT) {
  const source = {};
  for (const [key, relative] of Object.entries(SOURCE_FILES)) {
    source[key] = readSource(root, relative);
  }

  const readTools = scanRegistrations(source.readConfig, 'read');
  const writeTools = scanRegistrations(source.writeConfig, 'write')
    .concat(scanRegistrations(source.writeConfig, 'writeValidated'));
  const navigation = scanNavigation(source.navigation);
  const outputs = parseOutputSchemas(source.outputs);
  navigation.outputShape = outputs[navigation.name] ?? null;

  const tools = [...readTools, ...writeTools].map((entry) => ({
    ...entry,
    outputShape: outputs[entry.name] ?? null,
  }));
  tools.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

  const declaredScopes = parseEnums(source.scopes);
  const scopeUsage = {};
  for (const tool of tools) {
    if (tool.requiredScope) scopeUsage[tool.requiredScope] = (scopeUsage[tool.requiredScope] ?? 0) + 1;
  }

  const governanceRule = {
    highRiskStatus: /riskLevel\(\)\s*==\s*RiskLevel\.HIGH[\s\S]{0,80}?ExecutionStatus\.(\w+)/.exec(source.governance)?.[1] ?? null,
    ungrantedStatus: /else if \(!granted\)[\s\S]{0,80}?ExecutionStatus\.(\w+)/.exec(source.governance)?.[1] ?? null,
    grantedStatus: /else \{[\s\S]{0,80}?ExecutionStatus\.(\w+)/.exec(source.governance)?.[1] ?? null,
    scopeGrantActive: /isActiveAt\(now\)\s*&&\s*scopes\.contains\(scope\)/.test(source.governance.replace(/\s+/g, ' '))
      || /isActiveAt\(now\) && scopes\.contains\(scope\)/.test(readSource(root, 'backend/src/main/java/com/moxiao/studypilot/agent/infrastructure/AgentGrantEntity.java')),
    confirmationTtlMinutes: Number(/(\d+)\)\s*;?\s*\/\*\* Task 30：执行租约/.exec(source.actionService)?.[1])
      || Number(/CONFIRMATION_TTL\s*=\s*Duration\.ofMinutes\((\d+)\)/.exec(source.actionService)?.[1] ?? 0),
    leaseMinutes: Number(/LEASE_DURATION\s*=\s*Duration\.ofMinutes\((\d+)\)/.exec(source.actionService)?.[1] ?? 0),
  };

  return {
    extractorVersion: '1.0.0',
    readOnly: true,
    tools,
    navigation,
    toolCount: tools.length + 1,
    byEffect: {
      READ: tools.filter((tool) => tool.effect === 'READ').length,
      WRITE: tools.filter((tool) => tool.effect === 'WRITE').length,
      NAVIGATE: 1,
      LOCAL: tools.filter((tool) => tool.effect === 'LOCAL').length,
    },
    declaredScopes,
    scopeUsage,
    unusedScopes: declaredScopes.filter((scope) => !(scope in scopeUsage)),
    outputSchemasRegistered: Object.keys(outputs).length,
    outputSchemasMissing: tools.filter((tool) => !outputs[tool.name]).map((tool) => tool.name),
    governanceRule,
    sourceDigests: Object.fromEntries(
      Object.entries(SOURCE_FILES).map(([key, relative]) => [
        relative,
        createHash('sha256').update(source[key]).digest('hex'),
      ]),
    ),
  };
}

function summarize(facts) {
  const lines = [];
  lines.push(`tools          ${facts.toolCount} (READ ${facts.byEffect.READ}, WRITE ${facts.byEffect.WRITE}, NAVIGATE ${facts.byEffect.NAVIGATE}, LOCAL ${facts.byEffect.LOCAL})`);
  lines.push(`output schemas ${facts.outputSchemasRegistered} registered, ${facts.outputSchemasMissing.length} missing`);
  lines.push(`scopes used    ${Object.keys(facts.scopeUsage).length} of ${facts.declaredScopes.length}; unused: ${facts.unusedScopes.join(', ') || '-'}`);
  lines.push(`governance     HIGH->${facts.governanceRule.highRiskStatus}, LOW+ungranted->${facts.governanceRule.ungrantedStatus}, LOW+granted->${facts.governanceRule.grantedStatus}`);
  lines.push(`ttl/lease      ${facts.governanceRule.confirmationTtlMinutes}min / ${facts.governanceRule.leaseMinutes}min`);
  lines.push(`nav routes     ${Object.keys(facts.navigation.routes).length}`);
  if (facts.outputSchemasMissing.length > 0) {
    lines.push(`MISSING OUTPUT SCHEMA: ${facts.outputSchemasMissing.join(', ')}`);
  }
  return lines.join('\n');
}

function main(argv) {
  const checkIndex = argv.indexOf('--check');
  try {
    const facts = collectCapabilityFacts();
    if (checkIndex >= 0) {
      const path = argv[checkIndex + 1];
      const frozen = JSON.parse(readFileSync(path, 'utf8'));
      const drift = [];
      if (frozen.toolCount !== facts.toolCount) drift.push(`toolCount ${frozen.toolCount} -> ${facts.toolCount}`);
      for (const [relative, digest] of Object.entries(frozen.sourceDigests ?? {})) {
        if (facts.sourceDigests[relative] !== digest) drift.push(`source changed: ${relative}`);
      }
      if (drift.length === 0) {
        process.stdout.write('MATCH  frozen capability facts still match the Java source\n');
        return 0;
      }
      for (const item of drift) process.stderr.write(`DRIFT  ${item}\n`);
      return 1;
    }
    process.stdout.write(
      argv.includes('--summary') ? `${summarize(facts)}\n` : `${JSON.stringify(facts, null, 2)}\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`ERROR  ${error.message}\n`);
    return error.code === 'SOURCE_MISSING' ? 2 : 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
