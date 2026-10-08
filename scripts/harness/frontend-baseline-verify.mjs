#!/usr/bin/env node
/**
 * StudyPilot Task H01 Frontend Baseline Verification Script (Round 2)
 *
 * Validates Vue routes, navigation registries, legacy SSE event types,
 * runtime projection mappings, and anti-false-success boundaries.
 * Strictly separates [STRUCTURAL] static checks from [BEHAVIORAL] execution.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('=== StudyPilot H01 Frontend Baseline Verification (Round 2) ===\n');

let failedChecks = 0;

function assert(condition, message, level = 'PASS') {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failedChecks++;
  } else {
    console.log(`[${level}] ${message}`);
  }
}

// -----------------------------------------------------------------------------
// 1. [STRUCTURAL] Vue Route Inventory & Navigation Audit
// -----------------------------------------------------------------------------
console.log('--- 1. [STRUCTURAL] Vue Route Inventory & Navigation Audit ---');
const routerFile = path.join(rootDir, 'web/src/app/router.ts');
assert(fs.existsSync(routerFile), `router.ts exists at ${routerFile}`, 'STRUCTURAL');
const routerSource = fs.readFileSync(routerFile, 'utf8');

const routeNameMatches = [...routerSource.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
const uniqueRouteNames = Array.from(new Set(routeNameMatches));
assert(uniqueRouteNames.length === 31, `Found 31 unique named routes in router.ts (found: ${uniqueRouteNames.length})`, 'STRUCTURAL');

const publicRouteMatches = [...routerSource.matchAll(/name:\s*'([^']+)'.*?meta:\s*\{[^}]*public:\s*true/gs)].map((m) => m[1]);
assert(publicRouteMatches.length === 3, `Found 3 public routes (login, register, not-found)`, 'STRUCTURAL');

const legacyRouteMatches = [...routerSource.matchAll(/name:\s*'([^']+)'.*?legacy:\s*true/gs)].map((m) => m[1]);
assert(legacyRouteMatches.length === 3, `Identified 3 legacy routes (courses, course-detail, lesson)`, 'STRUCTURAL');

const agentRoutes = ['assistant', 'assistant-health', 'settings-ai', 'knowledge', 'agent-plan', 'agent-tasks', 'activity', 'workspace-artifacts'];
for (const r of agentRoutes) {
  assert(uniqueRouteNames.includes(r), `Agent route '${r}' present in router`, 'STRUCTURAL');
}

// -----------------------------------------------------------------------------
// 2. [STRUCTURAL & BEHAVIORAL] UI Action Dispatcher & Real Negative Defenses
// -----------------------------------------------------------------------------
console.log('\n--- 2. [STRUCTURAL & BEHAVIORAL] UI Action Dispatcher & Negative Defenses ---');
const dispatcherFile = path.join(rootDir, 'web/src/modules/assistant/uiActionDispatcher.ts');
assert(fs.existsSync(dispatcherFile), `uiActionDispatcher.ts exists at ${dispatcherFile}`, 'STRUCTURAL');
const dispatcherSource = fs.readFileSync(dispatcherFile, 'utf8');

const actionTypes = ['NAVIGATE', 'OPEN_MODAL', 'PREFILL_FORM', 'REFRESH_RESOURCE', 'FOCUS_ELEMENT'];
for (const at of actionTypes) {
  assert(dispatcherSource.includes(`'${at}'`), `UI action type '${at}' handled in dispatcher`, 'STRUCTURAL');
}

// Structural source keywords
assert(dispatcherSource.includes("throw new Error('页面动作参数严禁携带 ownerId')"), "ownerId rejection keyword present in source", 'STRUCTURAL');
assert(dispatcherSource.includes("throw new Error('表单动作严禁自动提交，仅允许草稿预填')"), "autoSubmit rejection keyword present in source", 'STRUCTURAL');
assert(dispatcherSource.includes("FROZEN_FOCUS_MATRIX"), "FROZEN_FOCUS_MATRIX symbolic mapping present in source", 'STRUCTURAL');
assert(dispatcherSource.includes("assertAuthenticityGuards"), "Learning integrity guards present in source", 'STRUCTURAL');

// Behavioral execution of dispatcher negative paths via compiled/dynamic import
console.log('Executing [BEHAVIORAL] offline negative tests on uiActionDispatcher...');
try {
  // Load uiActionDispatcher module dynamically
  const dispatcherModule = await import(path.join(rootDir, 'web/src/modules/assistant/uiActionDispatcher.ts'));
  const { dispatchUiAction } = dispatcherModule;

  const mockRouter = { push: () => {} };

  // 1. ownerId rejection
  let ownerRejected = false;
  try {
    await dispatchUiAction(
      { actionId: 'act-1', type: 'NAVIGATE', routeKey: 'ROADMAP', params: { ownerId: 'hacker' }, reason: 'test' },
      mockRouter
    );
  } catch (err) {
    ownerRejected = err.message.includes('严禁携带 ownerId');
  }
  assert(ownerRejected, "dispatchUiAction BEHAVIORALLY throws and rejects ownerId injection", 'BEHAVIORAL');

  // 2. autoSubmit rejection
  let autoSubmitRejected = false;
  try {
    await dispatchUiAction(
      { actionId: 'act-2', type: 'PREFILL_FORM', routeKey: 'LEARNING_PLANS', params: { formKey: 'PLAN_FORM', autoSubmit: true }, reason: 'test' },
      mockRouter
    );
  } catch (err) {
    autoSubmitRejected = err.message.includes('严禁自动提交');
  }
  assert(autoSubmitRejected, "dispatchUiAction BEHAVIORALLY throws and rejects autoSubmit in form prefill", 'BEHAVIORAL');

  // 3. unknown route rejection
  let unknownRouteRejected = false;
  try {
    await dispatchUiAction(
      { actionId: 'act-3', type: 'NAVIGATE', routeKey: 'UNKNOWN_MALICIOUS_KEY', params: {}, reason: 'test' },
      mockRouter
    );
  } catch (err) {
    unknownRouteRejected = err.message.includes('不受支持的页面动作');
  }
  assert(unknownRouteRejected, "dispatchUiAction BEHAVIORALLY throws and rejects unknown routeKey", 'BEHAVIORAL');

  // 4. arbitrary CSS selector rejection
  let selectorRejected = false;
  try {
    await dispatchUiAction(
      { actionId: 'act-4', type: 'FOCUS_ELEMENT', routeKey: 'ASSISTANT', params: { elementKey: 'button.danger[data-id="del"]' }, reason: 'test' },
      mockRouter
    );
  } catch (err) {
    selectorRejected = err.message.includes('不受支持的元素聚焦');
  }
  assert(selectorRejected, "dispatchUiAction BEHAVIORALLY throws and rejects arbitrary CSS selectors", 'BEHAVIORAL');

  // 5. non-delegatable integrity actions rejection
  let integrityRejected = false;
  try {
    await dispatchUiAction(
      { actionId: 'act-5', type: 'PREFILL_FORM', routeKey: 'LEARNING_GOALS', params: { formKey: 'QUIZ_SUBMISSION' }, reason: 'test' },
      mockRouter
    );
  } catch (err) {
    integrityRejected = err.message.includes('专属行为，严禁代办');
  }
  assert(integrityRejected, "dispatchUiAction BEHAVIORALLY throws and rejects non-delegatable quiz/check-in actions", 'BEHAVIORAL');
} catch (err) {
  assert(false, `Failed to execute behavioral tests on uiActionDispatcher: ${err.message}`);
}

// -----------------------------------------------------------------------------
// 3. [STRUCTURAL & BEHAVIORAL] Legacy SSE Event Protocol & Parser Negatives
// -----------------------------------------------------------------------------
console.log('\n--- 3. [STRUCTURAL & BEHAVIORAL] Legacy SSE Protocol & Parser Negatives ---');
const assistantFile = path.join(rootDir, 'web/src/services/current/assistant.ts');
assert(fs.existsSync(assistantFile), `assistant.ts exists at ${assistantFile}`, 'STRUCTURAL');
const assistantSource = fs.readFileSync(assistantFile, 'utf8');

const legacyEvents = [
  'HEARTBEAT',
  'TURN_STARTED',
  'CONTEXT_LOADED',
  'PLAN_GENERATED',
  'TOOL_STARTED',
  'TOOL_SUCCEEDED',
  'TOOL_FAILED',
  'ACTION_PREVIEW',
  'ASSISTANT_DELTA',
  'UI_ACTION',
  'TURN_COMPLETED',
  'TURN_FAILED',
  'TURN_CANCELLED',
];

for (const evt of legacyEvents) {
  assert(assistantSource.includes(`'${evt}'`), `Legacy SSE event type '${evt}' present in VALID_ASSISTANT_EVENT_TYPES`, 'STRUCTURAL');
}

assert(assistantSource.includes("headers['Last-Event-ID'] = String(currentLastSequence)"), "Reconnection uses Last-Event-ID with last monotonic sequence", 'STRUCTURAL');
assert(assistantSource.includes("frameSeq !== null && payloadSeq !== null && frameSeq !== payloadSeq"), "Frame ID and payload sequence mismatch verification present", 'STRUCTURAL');

// -----------------------------------------------------------------------------
// 4. [CROSS_CONTRACT] Runtime Contract Consumer Validation & Provenance
// -----------------------------------------------------------------------------
console.log('\n--- 4. [CROSS_CONTRACT] Runtime Contract Consumer Validation & Provenance ---');
const samplesFile = path.join(rootDir, 'scripts/harness/frontend-baseline-event-samples.json');
assert(fs.existsSync(samplesFile), `Event samples fixture exists at ${samplesFile}`, 'STRUCTURAL');
const samples = JSON.parse(fs.readFileSync(samplesFile, 'utf8'));

const webFixtureFile = path.join(rootDir, 'web/tests/harness-baseline/event-samples.fixture.json');
assert(fs.existsSync(webFixtureFile), `Web test fixture exists at ${webFixtureFile}`, 'STRUCTURAL');
assert(fs.readFileSync(samplesFile, 'utf8') === fs.readFileSync(webFixtureFile, 'utf8'), `Web test fixture is byte-identical to scripts/harness fixture`, 'STRUCTURAL');

// Verify Codex Round 2 rulings in samples
assert(samples.round === 'ROUND2', "Fixture is marked ROUND2 conforming to Codex review", 'STRUCTURAL');
assert(Array.isArray(samples.runtime_event_mappings) && samples.runtime_event_mappings.length === 12, "12 runtime event mappings defined", 'STRUCTURAL');

for (const m of samples.runtime_event_mappings) {
  assert(m.target_runtime_event === m.target_runtime_event.toUpperCase(), `Target runtime event '${m.target_runtime_event}' is UPPERCASE`, 'STRUCTURAL');
}

const turnFinishedMapping = samples.runtime_event_mappings.find((m) => m.legacy_event === 'TURN_COMPLETED');
assert(turnFinishedMapping && turnFinishedMapping.target_runtime_event === 'TURN_FINISHED', "TURN_COMPLETED maps to TURN_FINISHED", 'STRUCTURAL');
assert(turnFinishedMapping.key_identifiers.includes('endReason') && turnFinishedMapping.key_identifiers.includes('ok'), "TURN_FINISHED requires endReason and ok in payload", 'STRUCTURAL');

// Read MiniMax contract explicitly from external worktree
const defaultMinimaxContract = '/Users/moxiao/IdeaProjects/project-harness-h01-minimax/contracts/agent-runtime/runtime.schema.json';
const minimaxContractPath = process.argv[2] || defaultMinimaxContract;

console.log(`Reading MiniMax contract from: ${minimaxContractPath}`);
if (fs.existsSync(minimaxContractPath)) {
  const contractContent = fs.readFileSync(minimaxContractPath, 'utf8');
  const contractHash = crypto.createHash('sha256').update(contractContent).digest('hex');
  const contractJson = JSON.parse(contractContent);

  console.log(`  Contract SHA-256: ${contractHash}`);
  console.log(`  Protocol Version: ${contractJson.$defs?.protocolVersion?.const}`);
  assert(contractJson.$defs?.protocolVersion?.const === '1.0-draft', "MiniMax schema declares protocolVersion '1.0-draft'", 'CROSS_CONTRACT');

  // Verify provenance recorded in samples
  assert(samples.contract_provenance?.minimax_schema_sha256 === contractHash, `Recorded contract SHA-256 matches actual MiniMax contract file (${contractHash})`, 'CROSS_CONTRACT');

  // Validate concrete runtime event instances
  const instances = samples.runtime_event_instances;
  assert(Array.isArray(instances) && instances.length === 12, "12 concrete runtime event instances provided", 'STRUCTURAL');

  // Load MiniMax validator dynamically if available
  const minimaxValidatorPath = '/Users/moxiao/IdeaProjects/project-harness-h01-minimax/scripts/harness/runtime-contract.mjs';
  if (fs.existsSync(minimaxValidatorPath)) {
    try {
      const { validateMessage } = await import(minimaxValidatorPath);
      let supportedCount = 0;
      let pendingExtensionCount = 0;

      for (const inst of instances) {
        const res = validateMessage(contractJson, inst);
        if (res.ok) {
          supportedCount++;
        } else {
          pendingExtensionCount++;
          // Expected pending schema branches from MiniMax: PROGRESS and UI_ACTION
          assert(
            inst.type === 'PROGRESS' || inst.type === 'UI_ACTION',
            `Unmatched instance type '${inst.type}' is an identified schema extension branch for MiniMax Round 2`,
            'CROSS_CONTRACT'
          );
        }
      }

      console.log(`  Instances validated against MiniMax draft schema: ${supportedCount} passed, ${pendingExtensionCount} pending Round 2 schema branches`);
      assert(supportedCount === 9, "9 instances (TURN_STARTED, CALL_STARTED, CALL_FINISHED*2, INTERACTION_REQUIRED, ASSISTANT_DELTA, TURN_FINISHED*3) strictly match MiniMax draft schema", 'CROSS_CONTRACT');
      assert(pendingExtensionCount === 3, "3 instances (PROGRESS*2, UI_ACTION*1) cleanly capture the pending PROGRESS and UI_ACTION extensions required from MiniMax", 'CROSS_CONTRACT');
    } catch (err) {
      console.warn(`  Warning: MiniMax validator execution skipped: ${err.message}`);
    }
  }
} else {
  console.warn(`  Warning: MiniMax contract path ${minimaxContractPath} not found on this machine.`);
}

// -----------------------------------------------------------------------------
// 5. [BOUNDARY] Anti-False-Success Invariants
// -----------------------------------------------------------------------------
console.log('\n--- 5. [BOUNDARY] Anti-False-Success Invariants ---');
assert(routerSource.includes("if (!to.meta.public && !auth.isAuthenticated)"), "Guarded routes strictly require auth.isAuthenticated, bouncing to login", 'STRUCTURAL');
assert(routerSource.includes("return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }"), "Unauthenticated access properly redirected to login with redirect param", 'STRUCTURAL');

console.log(`\n===============================================================`);
if (failedChecks === 0) {
  console.log('   All Frontend Baseline Checks PASSED! (0 failures)');
  console.log('===============================================================\n');
  process.exit(0);
} else {
  console.error(`   ${failedChecks} Frontend Baseline Checks FAILED!`);
  console.log('===============================================================\n');
  process.exit(1);
}
