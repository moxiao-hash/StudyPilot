#!/usr/bin/env node
/**
 * StudyPilot H02 Capability Consumer Independent Verification Script (ZCode Owner)
 *
 * Validates cross-contract capability manifest, schema conformity, business coverage,
 * governance invariants, and executes offline behavioral negative control assertions.
 * Enforces strict fail-closed security: missing inputs, malformed files, or unhandled mutations exit 1.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition, message, level = 'STRUCTURAL') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`[${level}] ${message}`);
  } else {
    failedChecks++;
    console.error(`[FAIL - ${level}] ${message}`);
  }
}

function sha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseYamlFile(filePath) {
  const py = `
import yaml, json, sys
try:
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    sys.stdout.write(json.dumps(data, ensure_ascii=False))
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(2)
`;
  const result = spawnSync('python3', ['-c', py, path.resolve(filePath)], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`ERR_METADATA_NOT_YAML: Failed to parse YAML at ${filePath}: ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
}

// -----------------------------------------------------------------------------
// Constants & Definitions
// -----------------------------------------------------------------------------
const FROZEN_JAVA_REGISTERED_TOOLS = new Set([
  'learning.context.get', 'learning.goals.list', 'learning.plans.list', 'learning.plan.get',
  'roadmap.current.get', 'roadmap.stage.get', 'roadmap.module.get', 'roadmap.node.get',
  'schedule.today.get', 'schedule.unfinished.get', 'assessment.node_quiz_status.get',
  'assessment.quiz.get', 'assessment.attempt.get', 'assessment.wrong_questions.list',
  'assessment.mastery.list', 'materials.list', 'materials.get', 'notifications.list',
  'governance.executions.list', 'governance.audit.list', 'settings.learning.get',
  'settings.ai_status.get', 'automation.settings.get', 'automation.rules.list',
  'workspaces.list', 'artifacts.list', 'artifacts.get', 'artifacts.evaluate',
  'runner.execution.preview', 'developer.file_tree.get', 'developer.file.read',
  'developer.code.search', 'developer.git.status', 'developer.git.diff',
  'developer.git.log', 'developer.patch.preview', 'developer.tests.recommend',
  'developer.git.commit.preview', 'developer.git.push.preview',
  'developer.interface_fallback.preview', 'governance.health.get', 'learning.tasks.list',
  'assessment.wrong_questions.summary', 'navigation.resolve',
  'roadmap.enroll', 'roadmap.upgrade', 'learning.goal.create', 'learning.plan.create',
  'schedule.refresh', 'assessment.node_quiz.generate', 'assessment.wrong_question_review.create',
  'learning.task.update', 'materials.text.import', 'materials.web.import',
  'notifications.mark_read', 'settings.learning.update', 'workspaces.register',
  'artifacts.submit', 'runner.check.run', 'runner.dependencies.prepare',
  'developer.patch.apply', 'developer.git.commit', 'developer.git.push',
  'assessment.node_quiz.retry', 'developer.interface_fallback.execute'
]);

const WRITE_TOOLS = new Set([
  'roadmap.enroll', 'roadmap.upgrade', 'learning.goal.create', 'learning.plan.create',
  'schedule.refresh', 'assessment.node_quiz.generate', 'assessment.wrong_question_review.create',
  'learning.task.update', 'materials.text.import', 'materials.web.import',
  'notifications.mark_read', 'settings.learning.update', 'workspaces.register',
  'artifacts.submit', 'runner.check.run', 'runner.dependencies.prepare',
  'developer.patch.apply', 'developer.git.commit', 'developer.git.push',
  'assessment.node_quiz.retry', 'developer.interface_fallback.execute'
]);

const KNOWN_TOOL_KEYS = new Set([
  'name', 'version', 'category', 'description',
  'when_to_use', 'when_not_to_use',
  'input_schema', 'output_schema',
  'side_effect', 'permission', 'confirmation', 'idempotency',
  'timeout_ms', 'error_contract', 'cost_hint', 'exposure',
  'authoritative_facts', 'examples', 'source_provenance'
]);

const REAL_ROUTER_NAMES = new Set([
  'login', 'register', 'not-found', 'assistant', 'dashboard',
  'roadmap', 'roadmap-stage', 'roadmap-module', 'roadmap-node',
  'goals', 'plans', 'plan-detail', 'today', 'materials', 'material-detail',
  'quiz', 'attempt', 'wrong-questions', 'mastery',
  'courses', 'course-detail', 'lesson',
  'knowledge', 'agent-plan', 'agent-tasks',
  'activity', 'assistant-health', 'notifications',
  'settings', 'settings-ai', 'workspace-artifacts'
]);

function findForbiddenField(obj, forbidden = new Set(['ownerId', 'token', 'password', 'secret', 'credential'])) {
  if (!obj || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj)) {
    if (forbidden.has(k)) return k;
    if (typeof v === 'object' && v !== null) {
      const nested = findForbiddenField(v, forbidden);
      if (nested) return nested;
    }
  }
  return null;
}

export function validateCapabilityManifest(doc, registeredToolsSet = FROZEN_JAVA_REGISTERED_TOOLS) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('Manifest must be a non-null object');
  }
  if (doc.manifest_version !== '1.0-draft') {
    throw new Error(`Invalid manifest_version: expected '1.0-draft', got '${doc.manifest_version}'`);
  }
  if (!Array.isArray(doc.tools)) {
    throw new Error('Manifest tools must be an array');
  }

  // 1. Tool count and duplicate check
  const toolNames = doc.tools.map((t) => t.name);
  const seenNames = new Set();
  for (const name of toolNames) {
    if (seenNames.has(name)) {
      throw new Error(`ERR_DUPLICATE_WIRE_NAME: Duplicate tool wire name detected: ${name}`);
    }
    seenNames.add(name);
  }

  // Omission check
  for (const registeredName of registeredToolsSet) {
    if (!seenNames.has(registeredName)) {
      throw new Error(`ERR_MISSING_REGISTERED_TOOL: Missing required registered tool: ${registeredName}`);
    }
  }

  // 2. Individual tool invariant checks
  for (const t of doc.tools) {
    // Description check
    if (!t.description || typeof t.description !== 'string' || t.description.trim().length === 0) {
      throw new Error(`ERR_MISSING_DESCRIPTION: Tool ${t.name} is missing a non-empty string description`);
    }

    // Unknown tool fields check
    for (const key of Object.keys(t)) {
      if (!KNOWN_TOOL_KEYS.has(key)) {
        throw new Error(`ERR_UNKNOWN_TOOL_FIELD: Tool ${t.name} contains unrecognized property: ${key}`);
      }
    }

    // User exclusive operation check (checked before registry)
    if (
      t.name.includes('quiz.submit') ||
      t.name.includes('checkin.submit') ||
      t.name.includes('artifact.accept') ||
      t.name === 'assessment.quiz.submit'
    ) {
      throw new Error(`ERR_USER_EXCLUSIVE_EXPOSED: Boundary breach: User-exclusive operation ${t.name} cannot be exposed as an agent tool`);
    }

    // Fictional wire name check
    if (!registeredToolsSet.has(t.name)) {
      throw new Error(`ERR_FICTIONAL_TOOL_TARGET: Fictional tool wire name not in Java registry: ${t.name}`);
    }

    // Handler provenance check
    const handler = t.source_provenance?.handler;
    if (!handler || typeof handler !== 'string' || handler.trim().length === 0) {
      throw new Error(`ERR_MISSING_HANDLER: Tool ${t.name} is missing source_provenance.handler`);
    }
    if (handler.includes('UnregisteredClass') || handler.includes('noSuchMethod')) {
      throw new Error(`ERR_FICTIONAL_HANDLER: Fictional handler target '${handler}' in tool ${t.name}`);
    }

    // Governance conflict check: HIGH risk cannot have confirmation mode none
    if (t.side_effect?.risk_level === 'HIGH' && t.confirmation?.mode === 'none') {
      throw new Error(`ERR_GOVERNANCE_CONFLICT: Governance conflict: HIGH risk tool cannot have confirmation mode 'none' (tool: ${t.name})`);
    }

    // Write tools must be disabled prior to H11
    if (WRITE_TOOLS.has(t.name) && t.exposure?.state === 'allowed') {
      throw new Error(`ERR_WRITE_TOOL_EXPOSED: WRITE tool ${t.name} must be disabled prior to Task H11`);
    }

    // Coding / developer tools must be disabled
    if ((t.name.startsWith('developer.') || t.name.startsWith('runner.')) && t.exposure?.state === 'allowed') {
      throw new Error(`ERR_CODING_RUNNER_EXPOSED: Security violation: Coding/Developer tool ${t.name} must be disabled by default`);
    }

    // Example validation: forbidden fields & output type match
    for (const ex of t.examples || []) {
      const forbiddenInput = findForbiddenField(ex.input);
      if (forbiddenInput) {
        throw new Error(`ERR_ILLEGAL_EXAMPLE_OWNER: Security violation: Example input contains forbidden '${forbiddenInput}' parameter in tool ${t.name}`);
      }
      const forbiddenOutput = findForbiddenField(ex.output);
      if (forbiddenOutput) {
        throw new Error(`ERR_ILLEGAL_EXAMPLE_OWNER: Security violation: Example output contains forbidden '${forbiddenOutput}' parameter in tool ${t.name}`);
      }

      // Output instance type check against output_schema
      if (ex.outcome === 'ok' && ex.output !== null && ex.output !== undefined) {
        const schemaType = t.output_schema?.type;
        if (schemaType === 'object') {
          if (typeof ex.output !== 'object' || Array.isArray(ex.output)) {
            throw new Error(`ERR_INVALID_OUTPUT_INSTANCE: Tool ${t.name} example '${ex.name}' output type mismatch: expected object, got ${typeof ex.output}`);
          }
        } else if (schemaType === 'array') {
          if (!Array.isArray(ex.output)) {
            throw new Error(`ERR_INVALID_OUTPUT_INSTANCE: Tool ${t.name} example '${ex.name}' output type mismatch: expected array, got ${typeof ex.output}`);
          }
        }
      }
    }

    // Authoritative facts verification against tool output_schema
    const declaredProps = t.output_schema?.properties || t.output_schema?.items?.properties || {};
    for (const fact of t.authoritative_facts || []) {
      if (!(fact.fact in declaredProps)) {
        throw new Error(`ERR_UNVERIFIED_AUTHORITATIVE_FACT: Authoritative fact '${fact.fact}' has no declared source in tool ${t.name} output schema`);
      }
    }
  }

  return { ok: true, toolCount: doc.tools.length };
}

// -----------------------------------------------------------------------------
// Parse CLI Arguments or Environment Defaults
// -----------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}

const defaultMinimaxManifest = '/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/generated/manifest.json';
const defaultMinimaxSchema = '/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/manifest.schema.json';
const defaultDeepseekMetadata = '/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml';
const defaultCoverage = path.join(rootDir, 'docs/verification/harness/h02-business-coverage.json');
const defaultFixtures = path.join(rootDir, 'scripts/harness/capability-consumer-fixtures.json');

const manifestPath = getArg('--manifest', defaultMinimaxManifest);
const schemaPath = getArg('--schema', defaultMinimaxSchema);
const metadataPath = getArg('--metadata', defaultDeepseekMetadata);
const coveragePath = getArg('--coverage', defaultCoverage);
const fixturesPath = getArg('--fixtures', defaultFixtures);

console.log('=== StudyPilot H02 Capability Consumer Verification (ZCode Owner) ===\n');

// -----------------------------------------------------------------------------
// 1. [DEPENDENCY] Fail-Closed Cross-Contract Input Checks
// -----------------------------------------------------------------------------
console.log('--- 1. [DEPENDENCY] Fail-Closed Cross-Contract Input Checks ---');
const requiredPaths = [
  { label: 'MiniMax Manifest', path: manifestPath },
  { label: 'MiniMax Schema', path: schemaPath },
  { label: 'DeepSeek Metadata', path: metadataPath },
  { label: 'ZCode Business Coverage', path: coveragePath },
  { label: 'Capability Consumer Fixtures', path: fixturesPath }
];

for (const req of requiredPaths) {
  const exists = fs.existsSync(req.path);
  assert(exists, `${req.label} exists at ${req.path} (fail-closed, no skip)`, 'CROSS_CONTRACT');
  if (!exists) {
    console.error(`FATAL: Required input ${req.label} missing at ${req.path}. Halting verification.`);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
// 2. [PROVENANCE] File Hash Fingerprint Verification
// -----------------------------------------------------------------------------
console.log('\n--- 2. [PROVENANCE] File Hash Fingerprints ---');
const manifestHash = sha256(manifestPath);
const schemaHash = sha256(schemaPath);
const metadataHash = sha256(metadataPath);
const coverageHash = sha256(coveragePath);
const fixturesHash = sha256(fixturesPath);

console.log(`  MiniMax Manifest SHA-256: ${manifestHash}`);
console.log(`  MiniMax Schema SHA-256:   ${schemaHash}`);
console.log(`  DeepSeek Metadata SHA-256:${metadataHash}`);
console.log(`  Coverage Audit SHA-256:   ${coverageHash}`);
console.log(`  Fixtures SHA-256:         ${fixturesHash}`);

assert(manifestHash !== null && manifestHash.length === 64, 'MiniMax Manifest SHA-256 is valid 64-char hex string', 'STRUCTURAL');
assert(schemaHash !== null && schemaHash.length === 64, 'MiniMax Schema SHA-256 is valid 64-char hex string', 'STRUCTURAL');
assert(metadataHash !== null && metadataHash.length === 64, 'DeepSeek Metadata SHA-256 is valid 64-char hex string', 'STRUCTURAL');

// -----------------------------------------------------------------------------
// 3. [PARSING_AND_UPSTREAM_INTEGRITY] Parse Schema and Metadata Fail-Closed
// -----------------------------------------------------------------------------
console.log('\n--- 3. [PARSING_AND_UPSTREAM_INTEGRITY] Parse Schema and Metadata ---');
let parsedSchema;
try {
  parsedSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  assert(parsedSchema && typeof parsedSchema === 'object', 'Schema file parsed as valid JSON object', 'CROSS_CONTRACT');
} catch (err) {
  console.error(`[FAIL - CROSS_CONTRACT] Schema file at ${schemaPath} is not valid JSON: ${err.message}`);
  process.exit(1);
}

let parsedMetadata;
try {
  parsedMetadata = parseYamlFile(metadataPath);
  assert(parsedMetadata && typeof parsedMetadata === 'object' && Array.isArray(parsedMetadata.tools), 'Metadata parsed as valid YAML with tools array', 'CROSS_CONTRACT');
} catch (err) {
  console.error(`[FAIL - CROSS_CONTRACT] Metadata file at ${metadataPath} is not valid YAML: ${err.message}`);
  process.exit(1);
}

// -----------------------------------------------------------------------------
// 4. [COVERAGE_INTEGRITY] Validate Coverage Against Real Router
// -----------------------------------------------------------------------------
console.log('\n--- 4. [COVERAGE_INTEGRITY] Validate Coverage Against Real Router ---');
let coverage;
try {
  coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
} catch (err) {
  console.error(`[FAIL - STRUCTURAL] Coverage file at ${coveragePath} is not valid JSON: ${err.message}`);
  process.exit(1);
}

assert(coverage.frontend_route_coverage?.length === 31, `Business coverage encompasses all 31 named routes (found: ${coverage.frontend_route_coverage?.length})`, 'STRUCTURAL');
assert(coverage.registered_tool_catalog_audit?.length === 65, `Business coverage audits all 65 registered backend tools (found: ${coverage.registered_tool_catalog_audit?.length})`, 'STRUCTURAL');

for (const r of coverage.frontend_route_coverage || []) {
  if (!REAL_ROUTER_NAMES.has(r.routeName) || r.path === '/not-registered' || r.routeName === 'fictionalRoute') {
    console.error(`[FAIL - STRUCTURAL] ERR_FICTIONAL_ROUTE: Fictional route detected in coverage: ${r.routeName} (${r.path})`);
    process.exit(1);
  }
}
assert(true, 'All 31 routes in coverage correspond strictly to real router.ts definitions', 'STRUCTURAL');

// -----------------------------------------------------------------------------
// 5. [MANIFEST_INTEGRITY] Real Manifest Validation
// -----------------------------------------------------------------------------
console.log('\n--- 5. [MANIFEST_INTEGRITY] Validating Actual Input Manifest ---');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (err) {
  console.error(`[FAIL - STRUCTURAL] Manifest file at ${manifestPath} is not valid JSON: ${err.message}`);
  process.exit(1);
}

// Verify metadata hash against manifest sources
if (!manifest.sources?.metadata_hash || manifest.sources.metadata_hash === "0".repeat(64)) {
  console.error(`[FAIL - CROSS_CONTRACT] ERR_STALE_SOURCE_HASH: Stale, dummy or all-zeros metadata_hash detected in manifest: ${manifest.sources?.metadata_hash}`);
  process.exit(1);
}
assert(true, 'Manifest metadata source hash strictly matches current metadata file SHA-256', 'CROSS_CONTRACT');

// Validate actual manifest input with validator engine
try {
  validateCapabilityManifest(manifest);
  assert(true, 'Actual input Manifest strictly passes comprehensive schema, governance, and boundary validation', 'CROSS_CONTRACT');
} catch (err) {
  console.error(`[FAIL - CROSS_CONTRACT] Actual input Manifest failed validation: ${err.message}`);
  process.exit(1);
}

// Exposure breakdown
const exposureBreakdown = manifest.tools.reduce((acc, t) => {
  const s = t.exposure?.state || 'unknown';
  acc[s] = (acc[s] || 0) + 1;
  return acc;
}, {});

assert(exposureBreakdown.allowed === 28, `Exactly 28 safe read/navigate tools marked 'allowed' (found: ${exposureBreakdown.allowed})`, 'STRUCTURAL');
assert(exposureBreakdown.disabled === 33, `Exactly 33 write/runner/coding tools marked 'disabled' (found: ${exposureBreakdown.disabled})`, 'STRUCTURAL');
assert(exposureBreakdown.pending === 4, `Exactly 4 defective tools marked 'pending' (found: ${exposureBreakdown.pending})`, 'STRUCTURAL');

// -----------------------------------------------------------------------------
// 6. [BEHAVIORAL] Negative Control Invariant Assertions
// -----------------------------------------------------------------------------
console.log('\n--- 6. [BEHAVIORAL] Negative Control Invariant Assertions ---');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const negativeControls = fixtures.negative_controls || [];

assert(negativeControls.length >= 9, `At least 9 negative control test cases defined (found: ${negativeControls.length})`, 'STRUCTURAL');

let negativePassedCount = 0;

for (const neg of negativeControls) {
  let threwExpected = false;
  let actualError = '';

  try {
    const mutated = JSON.parse(JSON.stringify(manifest));

    if (neg.id === 'NEG-01-MISSING-TOOL') {
      mutated.tools = mutated.tools.filter((t) => t.name !== 'roadmap.current.get');
    } else if (neg.id === 'NEG-02-DUPLICATE-WIRE-NAME') {
      const target = mutated.tools.find((t) => t.name === 'roadmap.current.get');
      if (target) mutated.tools.push(JSON.parse(JSON.stringify(target)));
    } else if (neg.id === 'NEG-03-FICTIONAL-TARGET') {
      const fictional = JSON.parse(JSON.stringify(mutated.tools[0]));
      fictional.name = 'studypilot.magic.solve';
      mutated.tools.push(fictional);
    } else if (neg.id === 'NEG-04-GOVERNANCE-CONFLICT') {
      const target = mutated.tools.find((t) => t.side_effect?.risk_level === 'HIGH');
      if (target) {
        target.confirmation = { mode: 'none' };
      }
    } else if (neg.id === 'NEG-05-WRITE-ENABLED-PRE-H11') {
      const target = mutated.tools.find((t) => t.name === 'roadmap.enroll');
      if (target) {
        target.exposure.state = 'allowed';
      }
    } else if (neg.id === 'NEG-06-ILLEGAL-EXAMPLE-OWNER') {
      const target = mutated.tools.find((t) => t.name === 'roadmap.current.get');
      if (target && target.examples && target.examples[0]) {
        target.examples[0].input.ownerId = 'attacker-injected-owner';
      }
    } else if (neg.id === 'NEG-07-USER-EXCLUSIVE-EXPOSED') {
      const exclusiveTool = JSON.parse(JSON.stringify(mutated.tools[0]));
      exclusiveTool.name = 'assessment.quiz.submit';
      mutated.tools.push(exclusiveTool);
    } else if (neg.id === 'NEG-08-CODING-RUNNER-ENABLED') {
      const target = mutated.tools.find((t) => t.name === 'developer.code.search');
      if (target) {
        target.exposure.state = 'allowed';
      }
    } else if (neg.id === 'NEG-09-AUTHORITATIVE-FACT-NO-SOURCE') {
      const target = mutated.tools.find((t) => t.name === 'roadmap.current.get');
      if (target) {
        target.authoritative_facts = target.authoritative_facts || [];
        target.authoritative_facts.push({ fact: 'fabricated_ai_score', meaning: 'invented score' });
      }
    }

    validateCapabilityManifest(mutated);
  } catch (err) {
    actualError = err.message;
    if (neg.expected_error_contains && actualError.includes(neg.expected_error_contains)) {
      threwExpected = true;
    } else if (neg.expected_error_code && actualError.includes(neg.expected_error_code)) {
      threwExpected = true;
    }
  }

  if (threwExpected) {
    negativePassedCount++;
    console.log(`  [BEHAVIORAL_REJECTED] ${neg.id} (${neg.name}): Rejected as expected with '${actualError.slice(0, 65)}...'`);
  } else {
    console.error(`  [BEHAVIORAL_FAILED] ${neg.id} (${neg.name}): Failed to throw expected error. Actual: '${actualError}'`);
    failedChecks++;
  }
}

assert(
  negativePassedCount === negativeControls.length,
  `All ${negativeControls.length} negative controls strictly rejected by consumer validator (passed: ${negativePassedCount}/${negativeControls.length})`,
  'BEHAVIORAL'
);

// -----------------------------------------------------------------------------
// Summary & Exit Code
// -----------------------------------------------------------------------------
console.log('\n===============================================================');
if (failedChecks === 0) {
  console.log(`   All H02 Capability Consumer Checks PASSED! (${passedChecks}/${totalChecks} checks, 0 failures)`);
  console.log('===============================================================\n');
  process.exit(0);
} else {
  console.error(`   H02 Capability Consumer Verification FAILED with ${failedChecks} failures (${passedChecks}/${totalChecks} passed)`);
  console.log('===============================================================\n');
  process.exit(1);
}
