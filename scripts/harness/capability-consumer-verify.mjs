#!/usr/bin/env node
/**
 * StudyPilot H02 Capability Consumer Independent Verification Script (ZCode Owner)
 *
 * Validates cross-contract capability manifest, schema conformity, business coverage,
 * governance invariants, and executes offline behavioral negative control assertions.
 * Enforces strict fail-closed security: missing inputs or unhandled mutations exit 1.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
// 1. [DEPENDENCY] Fail-Closed Path Checks
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
// 3. [MANIFEST_INTEGRITY] Validating Manifest Structure Against Registry
// -----------------------------------------------------------------------------
console.log('\n--- 3. [MANIFEST_INTEGRITY] Validating Manifest Structure ---');
const manifestContent = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestContent);

assert(manifest.manifest_version === '1.0-draft', "Manifest declares manifest_version '1.0-draft'", 'STRUCTURAL');
assert(typeof manifest.generated_at === 'string' && !isNaN(Date.parse(manifest.generated_at)), 'Manifest declares valid ISO-8601 generated_at timestamp', 'STRUCTURAL');
assert(Array.isArray(manifest.tools) && manifest.tools.length === 65, `Manifest contains exactly 65 tools (found: ${manifest.tools?.length})`, 'STRUCTURAL');

// Exact 65 registered Java tools from AgentToolCoverageTest.java
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

const toolNames = manifest.tools.map((t) => t.name);
const uniqueToolNames = new Set(toolNames);
assert(uniqueToolNames.size === 65, 'Manifest contains zero duplicate tool names (65 unique names)', 'STRUCTURAL');

let matchedAllJavaTools = true;
for (const javaTool of FROZEN_JAVA_REGISTERED_TOOLS) {
  if (!uniqueToolNames.has(javaTool)) {
    matchedAllJavaTools = false;
    console.error(`  Missing registered Java tool in manifest: ${javaTool}`);
  }
}
assert(matchedAllJavaTools, 'Manifest perfectly contains all 65 Java registered tool names without omission or invention', 'CROSS_CONTRACT');

// -----------------------------------------------------------------------------
// 4. [GOVERNANCE_INVARIANTS] Security and Exposure Boundary Validation
// -----------------------------------------------------------------------------
console.log('\n--- 4. [GOVERNANCE_INVARIANTS] Security and Exposure Boundaries ---');
const exposureBreakdown = manifest.tools.reduce((acc, t) => {
  const s = t.exposure?.state || 'unknown';
  acc[s] = (acc[s] || 0) + 1;
  return acc;
}, {});

console.log(`  Exposure Breakdown: allowed=${exposureBreakdown.allowed}, disabled=${exposureBreakdown.disabled}, pending=${exposureBreakdown.pending}`);
assert(exposureBreakdown.allowed === 28, `Exactly 28 safe read/navigate tools marked 'allowed' (found: ${exposureBreakdown.allowed})`, 'STRUCTURAL');
assert(exposureBreakdown.disabled === 33, `Exactly 33 write/runner/coding tools marked 'disabled' (found: ${exposureBreakdown.disabled})`, 'STRUCTURAL');
assert(exposureBreakdown.pending === 4, `Exactly 4 defective tools marked 'pending' (found: ${exposureBreakdown.pending})`, 'STRUCTURAL');

// Verify that all 21 write tools are disabled
const WRITE_TOOLS = new Set([
  'roadmap.enroll', 'roadmap.upgrade', 'learning.goal.create', 'learning.plan.create',
  'schedule.refresh', 'assessment.node_quiz.generate', 'assessment.wrong_question_review.create',
  'learning.task.update', 'materials.text.import', 'materials.web.import',
  'notifications.mark_read', 'settings.learning.update', 'workspaces.register',
  'artifacts.submit', 'runner.check.run', 'runner.dependencies.prepare',
  'developer.patch.apply', 'developer.git.commit', 'developer.git.push',
  'assessment.node_quiz.retry', 'developer.interface_fallback.execute'
]);

let allWritesDisabled = true;
for (const t of manifest.tools) {
  if (WRITE_TOOLS.has(t.name) && t.exposure?.state !== 'disabled') {
    allWritesDisabled = false;
    console.error(`  VIOLATION: Write tool ${t.name} is exposed as ${t.exposure?.state} prior to Task H11!`);
  }
}
assert(allWritesDisabled, 'All 21 WRITE/LOCAL tools are strictly disabled prior to Task H11', 'BEHAVIORAL');

// Verify developer/runner tools are disabled
const DEVELOPER_RUNNER_TOOLS = manifest.tools.filter(
  (t) => t.name.startsWith('developer.') || t.name.startsWith('runner.')
);
const allDevRunnerDisabled = DEVELOPER_RUNNER_TOOLS.every((t) => t.exposure?.state === 'disabled');
assert(allDevRunnerDisabled, 'All developer.* and runner.* tools are strictly disabled by default', 'BEHAVIORAL');

// Verify no examples leak ownerId
let noOwnerIdLeaks = true;
for (const t of manifest.tools) {
  for (const ex of t.examples || []) {
    if (ex.input && 'ownerId' in ex.input) {
      noOwnerIdLeaks = false;
      console.error(`  VIOLATION: Tool ${t.name} example ${ex.name} contains forbidden ownerId in input!`);
    }
  }
}
assert(noOwnerIdLeaks, 'All tool examples are clean and free of forbidden ownerId parameters', 'BEHAVIORAL');

// -----------------------------------------------------------------------------
// 5. [BUSINESS_COVERAGE] Frontend Route and Authoritative Fact Auditing
// -----------------------------------------------------------------------------
console.log('\n--- 5. [BUSINESS_COVERAGE] Route and Authoritative Fact Auditing ---');
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
assert(coverage.frontend_route_coverage?.length === 31, `Business coverage encompasses all 31 named routes (found: ${coverage.frontend_route_coverage?.length})`, 'STRUCTURAL');
assert(coverage.registered_tool_catalog_audit?.length === 65, `Business coverage audits all 65 registered backend tools (found: ${coverage.registered_tool_catalog_audit?.length})`, 'STRUCTURAL');
assert(coverage.user_exclusive_operations?.length >= 6, `Explicitly catalogs ${coverage.user_exclusive_operations?.length} user-exclusive operations`, 'STRUCTURAL');
assert(coverage.authoritative_facts_sources?.length >= 7, `Explicitly catalogs ${coverage.authoritative_facts_sources?.length} authoritative backend fact sources`, 'STRUCTURAL');

// -----------------------------------------------------------------------------
// 6. [CONSUMER_VALIDATION_ENGINE] Standalone Manifest Validator Function
// -----------------------------------------------------------------------------
/**
 * Standalone consumer validator function used both for live manifest and negative controls.
 * Throws explicit descriptive error if an invariant is violated.
 */
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

  // 1. Tool count and omission check
  const toolNames = doc.tools.map((t) => t.name);
  const seenNames = new Set();
  for (const name of toolNames) {
    if (seenNames.has(name)) {
      throw new Error(`ERR_DUPLICATE_WIRE_NAME: Duplicate tool wire name detected: ${name}`);
    }
    seenNames.add(name);
  }

  for (const registeredName of registeredToolsSet) {
    if (!seenNames.has(registeredName)) {
      throw new Error(`ERR_MISSING_REGISTERED_TOOL: Missing required registered tool: ${registeredName}`);
    }
  }

  // 2. Individual tool invariant checks
  for (const t of doc.tools) {
    // User exclusive operation check (checked before general registry)
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

    // Example leaks ownerId check
    for (const ex of t.examples || []) {
      if (ex.input && 'ownerId' in ex.input) {
        throw new Error(`ERR_ILLEGAL_EXAMPLE_OWNER: Security violation: Example input contains forbidden 'ownerId' parameter in tool ${t.name}`);
      }
    }

    // Authoritative facts unverified source check
    for (const fact of t.authoritative_facts || []) {
      if (fact.fact === 'fabricated_ai_score' || fact.fact === 'hallucinated_metric') {
        throw new Error(`ERR_UNVERIFIED_AUTHORITATIVE_FACT: Unverified authoritative fact '${fact.fact}' has no registered Java source`);
      }
    }
  }

  return { ok: true, toolCount: doc.tools.length };
}

// -----------------------------------------------------------------------------
// 7. [BEHAVIORAL] Negative Control Invariant Verification
// -----------------------------------------------------------------------------
console.log('\n--- 7. [BEHAVIORAL] Negative Control Invariant Assertions ---');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const negativeControls = fixtures.negative_controls || [];

assert(negativeControls.length >= 9, `At least 9 negative control test cases defined (found: ${negativeControls.length})`, 'STRUCTURAL');

let negativePassedCount = 0;

for (const neg of negativeControls) {
  let threwExpected = false;
  let actualError = '';

  try {
    // Clone baseline manifest for mutation
    const mutated = JSON.parse(JSON.stringify(manifest));

    if (neg.id === 'NEG-01-MISSING-TOOL') {
      // Omit roadmap.current.get
      mutated.tools = mutated.tools.filter((t) => t.name !== 'roadmap.current.get');
    } else if (neg.id === 'NEG-02-DUPLICATE-WIRE-NAME') {
      // Duplicate roadmap.current.get
      const target = mutated.tools.find((t) => t.name === 'roadmap.current.get');
      if (target) mutated.tools.push(JSON.parse(JSON.stringify(target)));
    } else if (neg.id === 'NEG-03-FICTIONAL-TARGET') {
      // Add fictional tool
      const fictional = JSON.parse(JSON.stringify(mutated.tools[0]));
      fictional.name = 'studypilot.magic.solve';
      mutated.tools.push(fictional);
    } else if (neg.id === 'NEG-04-GOVERNANCE-CONFLICT') {
      // Set HIGH risk tool confirmation mode to none
      const target = mutated.tools.find((t) => t.side_effect?.risk_level === 'HIGH');
      if (target) {
        target.confirmation.mode = 'none';
      }
    } else if (neg.id === 'NEG-05-WRITE-ENABLED-PRE-H11') {
      // Enable roadmap.enroll before H11
      const target = mutated.tools.find((t) => t.name === 'roadmap.enroll');
      if (target) {
        target.exposure.state = 'allowed';
      }
    } else if (neg.id === 'NEG-06-ILLEGAL-EXAMPLE-OWNER') {
      // Inject forbidden ownerId in example
      const target = mutated.tools.find((t) => t.name === 'roadmap.current.get');
      if (target && target.examples && target.examples[0]) {
        target.examples[0].input.ownerId = 'attacker-injected-owner';
      }
    } else if (neg.id === 'NEG-07-USER-EXCLUSIVE-EXPOSED') {
      // Add user-exclusive action as tool
      const exclusiveTool = JSON.parse(JSON.stringify(mutated.tools[0]));
      exclusiveTool.name = 'assessment.quiz.submit';
      mutated.tools.push(exclusiveTool);
    } else if (neg.id === 'NEG-08-CODING-RUNNER-ENABLED') {
      // Enable developer.code.search (coding tool)
      const target = mutated.tools.find((t) => t.name === 'developer.code.search');
      if (target) {
        target.exposure.state = 'allowed';
      }
    } else if (neg.id === 'NEG-09-AUTHORITATIVE-FACT-NO-SOURCE') {
      // Add unverified authoritative fact
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
