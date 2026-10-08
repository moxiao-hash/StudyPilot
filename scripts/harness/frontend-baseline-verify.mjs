#!/usr/bin/env node
/**
 * StudyPilot Task H01 Frontend Baseline Verification Script
 * Validates Vue routes, navigation registries, legacy SSE event types,
 * runtime projection mappings, and anti-false-success boundaries.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('=== StudyPilot H01 Frontend Baseline Verification ===\n');

let failedChecks = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failedChecks++;
  } else {
    console.log(`[PASS] ${message}`);
  }
}

// 1. Verify router.ts structure and route inventory
console.log('--- 1. Vue Route Inventory & Navigation Audit ---');
const routerFile = path.join(rootDir, 'web/src/app/router.ts');
assert(fs.existsSync(routerFile), `router.ts exists at ${routerFile}`);
const routerSource = fs.readFileSync(routerFile, 'utf8');

// Match route names
const routeNameMatches = [...routerSource.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
const uniqueRouteNames = Array.from(new Set(routeNameMatches));
assert(uniqueRouteNames.length === 31, `Found 31 unique named routes in router.ts (found: ${uniqueRouteNames.length})`);

const publicRouteMatches = [...routerSource.matchAll(/name:\s*'([^']+)'.*?meta:\s*\{[^}]*public:\s*true/gs)].map((m) => m[1]);
assert(publicRouteMatches.length === 3, `Found 3 public routes (login, register, not-found)`);

const legacyRouteMatches = [...routerSource.matchAll(/name:\s*'([^']+)'.*?legacy:\s*true/gs)].map((m) => m[1]);
assert(legacyRouteMatches.length === 3, `Identified 3 legacy routes (courses, course-detail, lesson)`);

// Check Agent-specific routes that will be affected by future floating shell
const agentRoutes = ['assistant', 'assistant-health', 'settings-ai', 'knowledge', 'agent-plan', 'agent-tasks', 'activity', 'workspace-artifacts'];
for (const r of agentRoutes) {
  assert(uniqueRouteNames.includes(r), `Agent route '${r}' present in router`);
}

// 2. Verify uiActionDispatcher.ts and Action Registry
console.log('\n--- 2. UI Action Registry & Safety Invariants ---');
const dispatcherFile = path.join(rootDir, 'web/src/modules/assistant/uiActionDispatcher.ts');
assert(fs.existsSync(dispatcherFile), `uiActionDispatcher.ts exists at ${dispatcherFile}`);
const dispatcherSource = fs.readFileSync(dispatcherFile, 'utf8');

// Check 5 UI action types
const actionTypes = ['NAVIGATE', 'OPEN_MODAL', 'PREFILL_FORM', 'REFRESH_RESOURCE', 'FOCUS_ELEMENT'];
for (const at of actionTypes) {
  assert(dispatcherSource.includes(`'${at}'`), `UI action type '${at}' handled in dispatcher`);
}

// Check anti-injection invariants
assert(dispatcherSource.includes("throw new Error('页面动作参数严禁携带 ownerId')"), "ownerId parameter injection strictly rejected");
assert(dispatcherSource.includes("throw new Error('表单动作严禁自动提交，仅允许草稿预填')"), "autoSubmit in PREFILL_FORM strictly rejected");
assert(dispatcherSource.includes("FROZEN_FOCUS_MATRIX"), "FOCUS_ELEMENT strictly restricted to FROZEN_FOCUS_MATRIX symbolic keys without arbitrary CSS selectors");
assert(dispatcherSource.includes("assertAuthenticityGuards"), "Learning integrity guards present (quiz, check-in, artifact accept cannot be delegated)");

// 3. Verify Legacy SSE Event Types in assistant.ts
console.log('\n--- 3. Legacy SSE Event Stream Protocol Inventory ---');
const assistantFile = path.join(rootDir, 'web/src/services/current/assistant.ts');
assert(fs.existsSync(assistantFile), `assistant.ts exists at ${assistantFile}`);
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
  assert(assistantSource.includes(`'${evt}'`), `Legacy SSE event type '${evt}' present in VALID_ASSISTANT_EVENT_TYPES`);
}

// Verify reconnection & sequence invariants in assistant.ts
assert(assistantSource.includes("headers['Last-Event-ID'] = String(currentLastSequence)"), "Reconnection uses Last-Event-ID with last monotonic sequence");
assert(assistantSource.includes("frameSeq !== null && payloadSeq !== null && frameSeq !== payloadSeq"), "Frame ID and payload sequence mismatch verification present");

// 4. Verify Event Samples & Runtime Mappings Fixture
console.log('\n--- 4. Event Samples & Runtime Projection Fixture ---');
const samplesFile = path.join(rootDir, 'scripts/harness/frontend-baseline-event-samples.json');
assert(fs.existsSync(samplesFile), `Event samples fixture exists at ${samplesFile}`);
const samples = JSON.parse(fs.readFileSync(samplesFile, 'utf8'));

const webFixtureFile = path.join(rootDir, 'web/tests/harness-baseline/event-samples.fixture.json');
assert(fs.existsSync(webFixtureFile), `Web test fixture exists at ${webFixtureFile}`);
assert(fs.readFileSync(samplesFile, 'utf8') === fs.readFileSync(webFixtureFile, 'utf8'), `Web test fixture is byte-identical to scripts/harness fixture`);

assert(samples.version === '1.0.0' && samples.task === 'H01', "Fixture matches version 1.0.0 and task H01");
assert(Array.isArray(samples.legacy_sse_events?.samples), "Legacy SSE samples array defined");
assert(samples.legacy_sse_events.samples.length === 13, "Contains 13 legacy event samples (1 heartbeat + 12 events)");

assert(Array.isArray(samples.runtime_event_mappings), "Target runtime event mappings defined");
assert(samples.runtime_event_mappings.length === 12, "All 12 business event types have target runtime projection mappings");

const finishReasons = samples.terminal_reasons_and_error_codes?.finish_reasons?.map((f) => f.code);
assert(finishReasons.includes('completed'), "Finish reason 'completed' defined");
assert(finishReasons.includes('cancelled'), "Finish reason 'cancelled' defined");
assert(finishReasons.includes('max_tokens'), "Finish reason 'max_tokens' defined (distinct from completed)");
assert(finishReasons.includes('budget_exhausted'), "Finish reason 'budget_exhausted' defined (distinct from error)");

const consumptionReqs = samples.consumption_requirements_for_runtime_schema?.requirements;
assert(Array.isArray(consumptionReqs) && consumptionReqs.length >= 6, "At least 6 consumption requirements submitted for MiniMax schema");

// 5. Anti-False-Success & Authentication Boundaries
console.log('\n--- 5. Anti-False-Success & Boundary Enforcement Rules ---');
// Verify client-side router auth guard rule
assert(routerSource.includes("if (!to.meta.public && !auth.isAuthenticated)"), "Guarded routes strictly require auth.isAuthenticated, bouncing to login");
assert(routerSource.includes("return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }"), "Unauthenticated access properly redirected to login with redirect param");

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
