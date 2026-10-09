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
import { spawnSync, execFileSync } from 'node:child_process';
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

const FALLBACK_HANDLER_BINDINGS = {
  'artifacts.evaluate': 'RoadmapArtifactService.evaluate',
  'artifacts.get': 'RoadmapArtifactService.artifact',
  'artifacts.list': 'RoadmapArtifactService.artifacts',
  'artifacts.submit': 'RoadmapArtifactService.submit',
  'assessment.attempt.get': 'QuizService.getAttempt',
  'assessment.mastery.list': 'QuizService.listMastery',
  'assessment.node_quiz.generate': 'RoadmapLearningLoopService.retryQuiz',
  'assessment.node_quiz.retry': 'RoadmapLearningLoopService.retryQuiz',
  'assessment.node_quiz_status.get': 'RoadmapLearningLoopService.quiz',
  'assessment.quiz.get': 'QuizService.get',
  'assessment.wrong_question_review.create': 'WrongQuestionReviewService.create',
  'assessment.wrong_questions.list': 'WrongQuestionService.list',
  'assessment.wrong_questions.summary': 'WrongQuestionService.summary',
  'automation.rules.list': 'AssistantAutomationService.list',
  'automation.settings.get': 'AssistantAutomationService.settings',
  'developer.code.search': 'WorkspaceDeveloperService.searchCode',
  'developer.file.read': 'WorkspaceDeveloperService.readFile',
  'developer.file_tree.get': 'WorkspaceDeveloperService.getFileTree',
  'developer.git.commit': 'WorkspaceDeveloperService.commitConfirmed',
  'developer.git.commit.preview': 'WorkspaceDeveloperService.previewGitCommit',
  'developer.git.diff': 'WorkspaceDeveloperService.getGitDiff',
  'developer.git.log': 'WorkspaceDeveloperService.getGitLog',
  'developer.git.push': 'WorkspaceDeveloperService.pushConfirmed',
  'developer.git.push.preview': 'WorkspaceDeveloperService.previewGitPush',
  'developer.git.status': 'WorkspaceDeveloperService.getGitStatus',
  'developer.interface_fallback.execute': 'LocalInterfaceFallbackService.execute',
  'developer.interface_fallback.preview': 'InterfaceFallbackPolicy.preview',
  'developer.patch.apply': 'WorkspaceDeveloperService.applyConfirmedPatch',
  'developer.patch.preview': 'WorkspaceDeveloperService.previewPatch',
  'developer.tests.recommend': 'WorkspaceDeveloperService.recommendTests',
  'governance.audit.list': 'AgentGovernanceService.listAuditLogs',
  'governance.executions.list': 'AgentGovernanceService.listExecutions',
  'governance.health.get': 'AssistantHealthService.summarize',
  'learning.context.get': 'AgentLearningContextService.get',
  'learning.goal.create': 'CreateLearningGoalService.create',
  'learning.goals.list': 'CreateLearningGoalService.list',
  'learning.plan.create': 'LearningPlanService.create',
  'learning.plan.get': 'LearningPlanService.requireOwnedPlan',
  'learning.plans.list': 'LearningPlanService.list',
  'learning.task.update': 'LearningTaskService.changeStatusIdempotently',
  'learning.tasks.list': 'LearningTaskService.list',
  'materials.get': 'MaterialService.get',
  'materials.list': 'MaterialService.list',
  'materials.text.import': 'MaterialService.createText',
  'materials.web.import': 'MaterialService.createWeb',
  'navigation.resolve': 'NavigationToolHandler.invoke',
  'notifications.list': 'NotificationService.list',
  'notifications.mark_read': 'NotificationService.markRead',
  'roadmap.current.get': 'RoadmapQueryService.currentMapIfPresent',
  'roadmap.enroll': 'RoadmapEnrollmentService.enroll',
  'roadmap.module.get': 'RoadmapQueryService.currentModule',
  'roadmap.node.get': 'RoadmapQueryService.currentNode',
  'roadmap.stage.get': 'RoadmapQueryService.currentStage',
  'roadmap.upgrade': 'RoadmapUpgradeService.confirm',
  'runner.check.run': 'RunnerGovernanceService.submitExecution',
  'runner.dependencies.prepare': 'RunnerGovernanceService.submitExecution',
  'runner.execution.preview': 'RunnerGovernanceService.preview',
  'schedule.refresh': 'RoadmapScheduleService.refresh',
  'schedule.today.get': 'RoadmapScheduleService.getOrCreate',
  'schedule.unfinished.get': 'RoadmapScheduleService.getOrCreate',
  'settings.ai_status.get': 'AiCredentialService.settings',
  'settings.learning.get': 'UserSettingsService.get',
  'settings.learning.update': 'UserSettingsService.save',
  'workspaces.list': 'RoadmapArtifactService.workspaces',
  'workspaces.register': 'RoadmapArtifactService.createWorkspace'
};

export function extractBindingsFromJavaSource(backendDir) {
  const bindings = new Map();
  bindings.set('navigation.resolve', 'NavigationToolHandler.invoke');

  function parseFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const blocks = content.split('@Bean').slice(1);
    const toolRegex = /return\s+(?:read|write|writeValidated)\s*\([^,]+,\s*"([^"]+)"/;
    const paramRegex = /(?:[a-zA-Z0-9_.]+\.)?([A-Za-z0-9_]+(?:Service|Policy))\s+(\w+)/g;

    for (const block of blocks) {
      const tm = block.match(toolRegex);
      if (!tm) continue;
      const toolName = tm[1];

      let callMatch = null;
      let pm;
      paramRegex.lastIndex = 0;
      while ((pm = paramRegex.exec(block)) !== null) {
        const svcType = pm[1];
        const varName = pm[2];
        const methodRegex = new RegExp(`\\b${varName}\\.([A-Za-z0-9_]+)\\s*\\(`, 'g');
        let mm;
        let lastMethod = null;
        while ((mm = methodRegex.exec(block)) !== null) {
          lastMethod = mm[1];
        }
        if (lastMethod) {
          callMatch = `${svcType}.${lastMethod}`;
          break;
        }
      }
      if (callMatch) {
        bindings.set(toolName, callMatch);
      }
    }
  }

  parseFile(path.join(backendDir, 'src/main/java/com/moxiao/studypilot/agent/tool/AgentReadToolConfiguration.java'));
  parseFile(path.join(backendDir, 'src/main/java/com/moxiao/studypilot/agent/tool/AgentWriteToolConfiguration.java'));
  return bindings;
}

export function extractRouterRoutes(routerPath) {
  const content = fs.readFileSync(routerPath, 'utf8');
  const routes = new Map();
  const routeBlockRegex = /\{\s*path:\s*['"]([^'"]*)['"](?:,\s*name:\s*['"]([^'"]+)['"]|\s*,\s*[^}]+name:\s*['"]([^'"]+)['"])/g;
  let m;
  while ((m = routeBlockRegex.exec(content)) !== null) {
    let p = m[1];
    const name = m[2] || m[3];
    if (name) {
      if (p === '') p = '/';
      else if (!p.startsWith('/')) p = '/' + p;
      routes.set(name, p);
    }
  }
  return routes;
}

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

/* ------------------------------------------------------------------ *
 * Recursive JSON Schema Validator (Draft 2020-12 subset)
 * ------------------------------------------------------------------ */
function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref supported: ${ref}`);
  let current = root;
  for (const part of ref.slice(2).split('/')) {
    current = current?.[part];
    if (current === undefined) throw new Error(`Unresolvable $ref: ${ref}`);
  }
  return current;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'number';
  return typeof value;
}

function matchesType(value, expected, allowPlaceholder = false) {
  if (allowPlaceholder && value === '<shape-placeholder>') return true;
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

export function validateNodeAgainstSchema(rootSchema, schema, value, path = '$', errors = [], allowShapePlaceholder = false) {
  if (!schema || typeof schema !== 'object') return;

  if (schema.$ref && typeof schema.$ref === 'string') {
    validateNodeAgainstSchema(rootSchema, resolveRef(rootSchema, schema.$ref), value, path, errors, allowShapePlaceholder);
    return;
  }

  // allOf
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) {
      validateNodeAgainstSchema(rootSchema, sub, value, path, errors, allowShapePlaceholder);
    }
  }

  // anyOf
  if (Array.isArray(schema.anyOf)) {
    let matchCount = 0;
    for (const sub of schema.anyOf) {
      const subErrors = [];
      validateNodeAgainstSchema(rootSchema, sub, value, path, subErrors, allowShapePlaceholder);
      if (subErrors.length === 0) matchCount++;
    }
    if (matchCount === 0) {
      errors.push(`SCHEMA: ${path} must match at least one anyOf branch`);
    }
  }

  // oneOf
  if (Array.isArray(schema.oneOf)) {
    let matchCount = 0;
    for (const sub of schema.oneOf) {
      const subErrors = [];
      validateNodeAgainstSchema(rootSchema, sub, value, path, subErrors, allowShapePlaceholder);
      if (subErrors.length === 0) matchCount++;
    }
    if (matchCount !== 1) {
      errors.push(`SCHEMA: ${path} must match exactly one oneOf branch, matched ${matchCount}`);
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`SCHEMA: ${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`SCHEMA: ${path} value ${JSON.stringify(value)} not in allowed enum [${schema.enum.join(', ')}]`);
  }

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((one) => matchesType(value, one, allowShapePlaceholder))) {
      errors.push(`SCHEMA: ${path} type must be ${expected.join('|')}, got ${typeOf(value)}`);
      return;
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`SCHEMA: ${path} value (${value}) < minimum (${schema.minimum})`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`SCHEMA: ${path} value (${value}) > maximum (${schema.maximum})`);
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      errors.push(`SCHEMA: ${path} value (${value}) <= exclusiveMinimum (${schema.exclusiveMinimum})`);
    }
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
      errors.push(`SCHEMA: ${path} value (${value}) >= exclusiveMaximum (${schema.exclusiveMaximum})`);
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`SCHEMA: ${path} length < ${schema.minLength}`);
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push(`SCHEMA: ${path} length > ${schema.maxLength}`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push(`SCHEMA: ${path} does not match pattern ${schema.pattern}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`SCHEMA: ${path} items count (${value.length}) < ${schema.minItems}`);
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`SCHEMA: ${path} items count (${value.length}) > ${schema.maxItems}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const repr = JSON.stringify(item);
        if (seen.has(repr)) {
          errors.push(`SCHEMA: ${path} contains duplicate items with uniqueItems: true (${repr})`);
          break;
        }
        seen.add(repr);
      }
    }
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((item, idx) => {
        validateNodeAgainstSchema(rootSchema, schema.items, item, `${path}[${idx}]`, errors, allowShapePlaceholder);
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value;
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(obj, req)) {
          errors.push(`SCHEMA: ${path} missing required property '${req}'`);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowedProps = new Set(Object.keys(schema.properties));
      for (const k of Object.keys(obj)) {
        if (!allowedProps.has(k)) {
          if (allowShapePlaceholder && obj[k] === '<shape-placeholder>') {
            continue;
          }
          errors.push(`SCHEMA: ${path} contains unexpected property '${k}'`);
        }
      }
    }
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [k, propSchema] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          validateNodeAgainstSchema(rootSchema, propSchema, obj[k], `${path}.${k}`, errors, allowShapePlaceholder);
        }
      }
    }
  }
}

export function validateCapabilityManifest(doc, registeredToolsSet = FROZEN_JAVA_REGISTERED_TOOLS, verifiedBindings = FALLBACK_HANDLER_BINDINGS) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('Manifest must be a non-null object');
  }
  if (doc.manifest_version !== '1.0-draft') {
    throw new Error(`Invalid manifest_version: expected '1.0-draft', got '${doc.manifest_version}'`);
  }

  // Root closedness check
  const KNOWN_ROOT_KEYS = new Set(['manifest_version', 'generated_at', 'sources', 'tools']);
  for (const k of Object.keys(doc)) {
    if (!KNOWN_ROOT_KEYS.has(k)) {
      throw new Error(`ERR_UNKNOWN_ROOT_FIELD: Manifest contains unrecognized root property: '${k}'`);
    }
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
    // 2.1 Description check
    if (!t.description || typeof t.description !== 'string' || t.description.trim().length === 0) {
      throw new Error(`ERR_MISSING_DESCRIPTION: Tool ${t.name} is missing a non-empty string description`);
    }

    // 2.2 Unknown tool fields check
    for (const key of Object.keys(t)) {
      if (!KNOWN_TOOL_KEYS.has(key)) {
        throw new Error(`ERR_UNKNOWN_TOOL_FIELD: Tool ${t.name} contains unrecognized property: ${key}`);
      }
    }

    // 2.3 when_to_use check
    if (!Array.isArray(t.when_to_use) || t.when_to_use.length === 0) {
      throw new Error(`ERR_MISSING_WHEN_TO_USE: Tool ${t.name} is missing when_to_use array or has 0 items`);
    }

    // 2.4 cost_hint closedness check
    if (t.cost_hint && typeof t.cost_hint === 'object') {
      const KNOWN_COST_KEYS = new Set(['local', 'external_dependency', 'notes']);
      for (const ck of Object.keys(t.cost_hint)) {
        if (!KNOWN_COST_KEYS.has(ck)) {
          throw new Error(`ERR_UNKNOWN_COST_FIELD: Tool ${t.name} cost_hint contains unrecognized property: '${ck}'`);
        }
      }
    }

    // 2.5 User-exclusive operation check (checked before registry)
    if (
      t.name.includes('quiz.submit') ||
      t.name.includes('checkin.submit') ||
      t.name.includes('artifact.accept') ||
      t.name === 'assessment.quiz.submit'
    ) {
      throw new Error(`ERR_USER_EXCLUSIVE_EXPOSED: Boundary breach: User-exclusive operation ${t.name} cannot be exposed as an agent tool`);
    }

    // 2.6 Fictional wire name check
    if (!registeredToolsSet.has(t.name)) {
      throw new Error(`ERR_FICTIONAL_TOOL_TARGET: Fictional tool wire name not in Java registry: ${t.name}`);
    }

    // 2.7 Exact handler pairing check against verified Java registrations
    const expectedBinding = verifiedBindings instanceof Map ? verifiedBindings.get(t.name) : verifiedBindings[t.name];
    if (!expectedBinding) {
      throw new Error(`ERR_UNREGISTERED_TOOL_BINDING: No registered Java handler binding for tool '${t.name}'`);
    }
    const declaredHandler = t.source_provenance?.handler || '';
    if (!declaredHandler.includes(expectedBinding)) {
      throw new Error(`ERR_HANDLER_BINDING_MISMATCH: Tool '${t.name}' declared handler '${declaredHandler}' does not match registered receiver/method '${expectedBinding}'`);
    }

    // 2.8 Confirmation mode validation
    const mode = t.confirmation?.mode;
    const ALLOWED_CONFIRMATION_MODES = new Set(['none', 'always_user_confirmation', 'conditional_scope_grant']);
    if (!mode || !ALLOWED_CONFIRMATION_MODES.has(mode)) {
      throw new Error(`ERR_INVALID_CONFIRMATION_MODE: Tool ${t.name} confirmation mode '${mode}' is invalid`);
    }

    // Governance conflict check: HIGH risk cannot have confirmation mode none
    if (t.side_effect?.risk_level === 'HIGH' && mode === 'none') {
      throw new Error(`ERR_GOVERNANCE_CONFLICT: Governance conflict: HIGH risk tool cannot have confirmation mode 'none' (tool: ${t.name})`);
    }

    // 2.9 Write tools must be disabled prior to H11
    if (WRITE_TOOLS.has(t.name) && t.exposure?.state === 'allowed') {
      throw new Error(`ERR_WRITE_TOOL_EXPOSED: WRITE tool ${t.name} must be disabled prior to Task H11`);
    }

    // 2.10 Coding / developer tools must be disabled
    if ((t.name.startsWith('developer.') || t.name.startsWith('runner.')) && t.exposure?.state === 'allowed') {
      throw new Error(`ERR_CODING_RUNNER_EXPOSED: Security violation: Coding/Developer tool ${t.name} must be disabled by default`);
    }

    // 2.11 Examples validation: minItems, required output, full schema matching, forbidden security fields
    if (!Array.isArray(t.examples) || t.examples.length === 0) {
      throw new Error(`ERR_EMPTY_EXAMPLES: Tool ${t.name} must contain at least 1 example`);
    }

    for (const ex of t.examples) {
      const forbiddenInput = findForbiddenField(ex.input);
      if (forbiddenInput) {
        throw new Error(`ERR_ILLEGAL_EXAMPLE_OWNER: Security violation: Example input contains forbidden '${forbiddenInput}' parameter in tool ${t.name}`);
      }
      const forbiddenOutput = findForbiddenField(ex.output);
      if (forbiddenOutput) {
        throw new Error(`ERR_ILLEGAL_EXAMPLE_OWNER: Security violation: Example output contains forbidden '${forbiddenOutput}' parameter in tool ${t.name}`);
      }

      // Input schema full validation
      if (t.input_schema && ex.input !== undefined) {
        const inputErrors = [];
        validateNodeAgainstSchema(
          t.input_schema,
          t.input_schema,
          ex.input,
          `${t.name}.examples[${ex.name}].input`,
          inputErrors
        );
        if (inputErrors.length > 0) {
          throw new Error(`ERR_INVALID_INPUT_INSTANCE: Tool ${t.name} example '${ex.name}' input violates schema: ${inputErrors[0]}`);
        }
      }

      // Output validation
      if (ex.outcome === 'ok') {
        if (!Object.prototype.hasOwnProperty.call(ex, 'output') || ex.output === undefined) {
          throw new Error(`ERR_MISSING_SUCCESSFUL_OUTPUT: Example '${ex.name}' in tool ${t.name} with outcome 'ok' must provide an output field`);
        }

        if (t.output_schema && ex.output !== null && ex.output !== undefined) {
          const outputErrors = [];
          validateNodeAgainstSchema(
            t.output_schema,
            t.output_schema,
            ex.output,
            `${t.name}.examples[${ex.name}].output`,
            outputErrors,
            ex.fixture_kind === 'shape_placeholder'
          );
          if (outputErrors.length > 0) {
            throw new Error(`ERR_INVALID_OUTPUT_INSTANCE: Tool ${t.name} example '${ex.name}' output violates schema: ${outputErrors[0]}`);
          }
        }
      }
    }

    // 2.12 Authoritative facts verification against tool output_schema
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
// 2. [PROVENANCE] File Hash Fingerprints
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

// Ensure metadata contains all 65 unique tools without duplicates or omissions
const metaToolNames = new Set();
for (const mt of parsedMetadata.tools || []) {
  if (metaToolNames.has(mt.name)) {
    console.error(`[FAIL - CROSS_CONTRACT] ERR_DUPLICATE_METADATA_TOOL: Duplicate tool '${mt.name}' in metadata.yaml`);
    process.exit(1);
  }
  metaToolNames.add(mt.name);
  if (!FROZEN_JAVA_REGISTERED_TOOLS.has(mt.name)) {
    console.error(`[FAIL - CROSS_CONTRACT] ERR_FICTIONAL_METADATA_TOOL: Tool '${mt.name}' in metadata.yaml is not in Java registry`);
    process.exit(1);
  }
}
for (const regName of FROZEN_JAVA_REGISTERED_TOOLS) {
  if (!metaToolNames.has(regName)) {
    console.error(`[FAIL - CROSS_CONTRACT] ERR_MISSING_METADATA_TOOL: Missing registered tool '${regName}' in metadata.yaml`);
    process.exit(1);
  }
}
assert(metaToolNames.size === 65, 'Metadata tools array contains all 65 unique registered tools without duplicates or omissions', 'CROSS_CONTRACT');

// -----------------------------------------------------------------------------
// 4. [COVERAGE_INTEGRITY] Validate Coverage Against Real Router & Controllers
// -----------------------------------------------------------------------------
console.log('\n--- 4. [COVERAGE_INTEGRITY] Validate Coverage Against Real Router & Controllers ---');
let coverage;
try {
  coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
} catch (err) {
  console.error(`[FAIL - STRUCTURAL] Coverage file at ${coveragePath} is not valid JSON: ${err.message}`);
  process.exit(1);
}

assert(coverage.frontend_route_coverage?.length === 31, `Business coverage encompasses all 31 named routes (found: ${coverage.frontend_route_coverage?.length})`, 'STRUCTURAL');
assert(coverage.registered_tool_catalog_audit?.length === 65, `Business coverage audits all 65 registered backend tools (found: ${coverage.registered_tool_catalog_audit?.length})`, 'STRUCTURAL');

// Verify router routes directly from router.ts source file
const routerFile = path.join(rootDir, 'web/src/app/router.ts');
assert(fs.existsSync(routerFile), `router.ts exists at ${routerFile}`, 'STRUCTURAL');
const realRouterRoutes = extractRouterRoutes(routerFile);
assert(realRouterRoutes.size === 31, `Extracted 31 named routes from router.ts (found: ${realRouterRoutes.size})`, 'STRUCTURAL');

// Verify every route in coverage matches real router.ts
const routeNamesInCoverage = new Set();
for (const r of coverage.frontend_route_coverage || []) {
  if (routeNamesInCoverage.has(r.routeName)) {
    console.error(`[FAIL - STRUCTURAL] ERR_DUPLICATE_ROUTE: Duplicate route name in coverage: ${r.routeName}`);
    process.exit(1);
  }
  routeNamesInCoverage.add(r.routeName);

  const realPath = realRouterRoutes.get(r.routeName);
  if (!realPath || r.path !== realPath) {
    console.error(`[FAIL - STRUCTURAL] ERR_WRONG_ROUTE_PATH: Route '${r.routeName}' path in coverage ('${r.path}') does not match router.ts path ('${realPath}')`);
    process.exit(1);
  }
}
assert(routeNamesInCoverage.size === 31, 'All 31 routes in coverage correspond strictly to real router.ts definitions', 'STRUCTURAL');

// Verify tool audit table has exact 65 deduplicated registered tools
const auditToolNames = new Set();
for (const t of coverage.registered_tool_catalog_audit || []) {
  if (auditToolNames.has(t.name)) {
    console.error(`[FAIL - STRUCTURAL] ERR_DUPLICATE_AUDIT_TOOL: Duplicate tool '${t.name}' in registered_tool_catalog_audit`);
    process.exit(1);
  }
  auditToolNames.add(t.name);
  if (!FROZEN_JAVA_REGISTERED_TOOLS.has(t.name)) {
    console.error(`[FAIL - STRUCTURAL] ERR_FICTIONAL_AUDIT_TOOL: Tool '${t.name}' in registered_tool_catalog_audit is not in Java registry`);
    process.exit(1);
  }
}
for (const regName of FROZEN_JAVA_REGISTERED_TOOLS) {
  if (!auditToolNames.has(regName)) {
    console.error(`[FAIL - STRUCTURAL] ERR_MISSING_AUDIT_TOOL: Missing registered tool '${regName}' in registered_tool_catalog_audit`);
    process.exit(1);
  }
}
assert(auditToolNames.size === 65, 'Audit table in coverage contains all 65 unique registered tools without duplicates or omissions', 'STRUCTURAL');

// Dynamic scanning of backend controllers and HTTP endpoints
function findJavaFiles(dir, filter) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findJavaFiles(full, filter));
    else if (filter(entry.name)) results.push(full);
  }
  return results;
}

function parseMapping(attrString) {
  if (!attrString) return '';
  const namedMatch = attrString.match(/(?:value|path)\s*=\s*['"]([^'"]*)['"]/);
  if (namedMatch) return namedMatch[1];
  const directMatch = attrString.match(/['"]([^'"]*)['"]/);
  if (directMatch) return directMatch[1];
  return '';
}

function extractBackendControllerEndpoints(backendJavaDir) {
  const controllers = findJavaFiles(backendJavaDir, (n) => n.endsWith('Controller.java'));
  const endpoints = new Map();
  const controllerMap = new Map();
  const controllerToEndpoints = new Map();
  const publicControllerSet = new Set();

  for (const cPath of controllers) {
    const content = fs.readFileSync(cPath, 'utf8');
    const cName = path.basename(cPath, '.java');
    controllerMap.set(cName, cPath);

    const classReqMatch = content.match(/@RequestMapping\((?:(?:value|path)\s*=\s*)?['"]([^'"]+)['"]\)/);
    const basePath = classReqMatch ? classReqMatch[1] : '';

    const methodRegex = /@(Get|Post|Put|Delete|Patch)Mapping(?:\(([^)]*)\))?/g;
    let m;
    const ctrlEps = new Set();
    while ((m = methodRegex.exec(content)) !== null) {
      const httpMethod = m[1].toUpperCase();
      const subPath = parseMapping(m[2]);
      let fullPath = (basePath + (subPath ? (subPath.startsWith('/') ? subPath : '/' + subPath) : '')).replace(/\/+/g, '/');
      if (fullPath.endsWith('/') && fullPath.length > 1) fullPath = fullPath.slice(0, -1);
      const key = `${httpMethod} ${fullPath}`;
      endpoints.set(key, { controller: cName, file: cPath });
      ctrlEps.add(key);
    }
    controllerToEndpoints.set(cName, ctrlEps);
    const isInternal = cName.startsWith('Internal') || basePath.startsWith('/internal');
    if (!isInternal) {
      publicControllerSet.add(cName);
    }
  }
  return { endpoints, controllerMap, controllerToEndpoints, publicControllerSet };
}

const backendJavaDir = path.join(rootDir, 'backend/src/main/java');
assert(fs.existsSync(backendJavaDir), `backend java source dir exists at ${backendJavaDir}`, 'STRUCTURAL');
const { endpoints: realBackendEndpoints, controllerMap: realControllerMap, controllerToEndpoints, publicControllerSet } = extractBackendControllerEndpoints(backendJavaDir);
assert(realControllerMap.size >= 50, `Extracted real controllers from backend sources (found: ${realControllerMap.size} controllers, ${realBackendEndpoints.size} endpoints)`, 'STRUCTURAL');

// Verify backend_controller_audit (R-Z10)
if (!Array.isArray(coverage.backend_controller_audit) || coverage.backend_controller_audit.length === 0) {
  console.error('[FAIL - STRUCTURAL] ERR_EMPTY_CONTROLLER_AUDIT: backend_controller_audit in coverage must not be empty');
  process.exit(1);
}

const auditedControllerNames = new Set();
for (const cAudit of coverage.backend_controller_audit) {
  if (auditedControllerNames.has(cAudit.controllerName)) {
    console.error(`[FAIL - STRUCTURAL] ERR_DUPLICATE_CONTROLLER_AUDIT: Duplicate controller in audit: ${cAudit.controllerName}`);
    process.exit(1);
  }
  auditedControllerNames.add(cAudit.controllerName);

  if (!realControllerMap.has(cAudit.controllerName)) {
    console.error(`[FAIL - STRUCTURAL] ERR_FICTIONAL_CONTROLLER: Controller '${cAudit.controllerName}' in audit does not exist in backend sources`);
    process.exit(1);
  }
  if (!Array.isArray(cAudit.endpoints) || cAudit.endpoints.length === 0) {
    console.error(`[FAIL - STRUCTURAL] ERR_EMPTY_CONTROLLER_ENDPOINTS: Controller '${cAudit.controllerName}' must declare non-empty endpoints`);
    process.exit(1);
  }
  const realEndpointsForThisCtrl = controllerToEndpoints.get(cAudit.controllerName);
  if (!realEndpointsForThisCtrl) {
    console.error(`[FAIL - STRUCTURAL] ERR_UNKNOWN_CONTROLLER_ENDPOINTS: Controller '${cAudit.controllerName}' has no mapped endpoints`);
    process.exit(1);
  }

  // 1. Check for duplicate endpoints within the controller
  const seenAuditEndpoints = new Set();
  for (const ep of cAudit.endpoints) {
    if (seenAuditEndpoints.has(ep)) {
      console.error(`[FAIL - STRUCTURAL] ERR_DUPLICATE_CONTROLLER_ENDPOINT: Duplicate endpoint '${ep}' in Controller '${cAudit.controllerName}'`);
      process.exit(1);
    }
    seenAuditEndpoints.add(ep);

    if (!realEndpointsForThisCtrl.has(ep)) {
      console.error(`[FAIL - STRUCTURAL] ERR_CONTROLLER_ENDPOINT_MISMATCH: Endpoint '${ep}' does not belong to Controller '${cAudit.controllerName}'`);
      process.exit(1);
    }
  }

  // 2. Bidirectional equality: every real endpoint of this Controller must be audited
  if (seenAuditEndpoints.size !== realEndpointsForThisCtrl.size) {
    console.error(`[FAIL - STRUCTURAL] ERR_CONTROLLER_ENDPOINTS_COUNT_MISMATCH: Controller '${cAudit.controllerName}' has ${realEndpointsForThisCtrl.size} real endpoints, but audit declared ${seenAuditEndpoints.size}`);
    process.exit(1);
  }
  for (const realEp of realEndpointsForThisCtrl) {
    if (!seenAuditEndpoints.has(realEp)) {
      console.error(`[FAIL - STRUCTURAL] ERR_CONTROLLER_ENDPOINT_OMITTED: Missing endpoint '${realEp}' in Controller '${cAudit.controllerName}' audit`);
      process.exit(1);
    }
  }
}

// Ensure all public controllers in backend are audited (bidirectional completeness)
for (const expectedCtrl of publicControllerSet) {
  if (!auditedControllerNames.has(expectedCtrl)) {
    console.error(`[FAIL - STRUCTURAL] ERR_MISSING_CONTROLLER_AUDIT: Missing required public controller in audit: ${expectedCtrl}`);
    process.exit(1);
  }
}
assert(true, 'All controller audit entries correspond to real Controller source files, exact endpoint pairing, and bidirectional completeness', 'STRUCTURAL');

// Extract exact Java handler bindings from source early
const backendDir = path.join(rootDir, 'backend');
const verifiedBindings = fs.existsSync(backendDir)
  ? extractBindingsFromJavaSource(backendDir)
  : FALLBACK_HANDLER_BINDINGS;
assert(verifiedBindings.size === 65 || Object.keys(verifiedBindings).length === 65, 'Exact 65 Java handler bindings loaded for receiver/method pairing', 'CROSS_CONTRACT');

// Build tool -> allowed controllers map from frontend_route_coverage + internal tool controllers
const toolAllowedControllers = new Map();
for (const r of coverage.frontend_route_coverage || []) {
  for (const t of r.associatedRegisteredTools || []) {
    if (!toolAllowedControllers.has(t)) toolAllowedControllers.set(t, new Set());
    for (const c of r.mappedBackendControllers || []) {
      toolAllowedControllers.get(t).add(c);
    }
  }
}
toolAllowedControllers.get('learning.context.get')?.add('InternalLearningToolController');

// Verify authoritative_facts_sources (R-Z10)
if (!Array.isArray(coverage.authoritative_facts_sources) || coverage.authoritative_facts_sources.length === 0) {
  console.error('[FAIL - STRUCTURAL] ERR_EMPTY_AUTHORITATIVE_FACTS_SOURCES: authoritative_facts_sources must not be empty');
  process.exit(1);
}

for (const afs of coverage.authoritative_facts_sources) {
  if (!FROZEN_JAVA_REGISTERED_TOOLS.has(afs.authoritativeTool)) {
    console.error(`[FAIL - STRUCTURAL] ERR_UNREGISTERED_AUTHORITATIVE_TOOL: Tool '${afs.authoritativeTool}' is not registered`);
    process.exit(1);
  }

  const expectedService = verifiedBindings instanceof Map
    ? verifiedBindings.get(afs.authoritativeTool)
    : verifiedBindings[afs.authoritativeTool];
  if (!expectedService || afs.javaService !== expectedService) {
    console.error(`[FAIL - STRUCTURAL] ERR_AUTHORITATIVE_SERVICE_TOOL_MISMATCH: Authoritative fact '${afs.metric}' tool '${afs.authoritativeTool}' is bound to '${expectedService}', but javaService declared '${afs.javaService}'`);
    process.exit(1);
  }

  const parts = afs.javaService.split('.');
  if (parts.length < 2) {
    console.error(`[FAIL - STRUCTURAL] ERR_INVALID_JAVA_SERVICE_FORMAT: Java service '${afs.javaService}' must specify ClassName.methodName`);
    process.exit(1);
  }
  const serviceClass = parts[0];
  const methodName = parts[1];
  const serviceFiles = findJavaFiles(backendJavaDir, (n) => n === `${serviceClass}.java`);
  if (serviceFiles.length === 0) {
    console.error(`[FAIL - STRUCTURAL] ERR_INVENTED_AUTHORITATIVE_SERVICE: Authoritative fact service '${afs.javaService}' (${serviceClass}) does not exist in backend Java sources`);
    process.exit(1);
  }
  const serviceSource = fs.readFileSync(serviceFiles[0], 'utf8');
  const methodRegex = new RegExp(`\\b${methodName}\\s*\\(`, 'g');
  if (!methodRegex.test(serviceSource)) {
    console.error(`[FAIL - STRUCTURAL] ERR_NONEXISTENT_SERVICE_METHOD: Method '${methodName}' does not exist in service '${serviceClass}' (${afs.javaService})`);
    process.exit(1);
  }

  const epInfo = realBackendEndpoints.get(afs.endpoint);
  if (!epInfo) {
    console.error(`[FAIL - STRUCTURAL] ERR_INVENTED_AUTHORITATIVE_ENDPOINT: Authoritative fact endpoint '${afs.endpoint}' does not exist in backend Controller sources`);
    process.exit(1);
  }

  const allowedControllers = toolAllowedControllers.get(afs.authoritativeTool);
  if (!allowedControllers || !allowedControllers.has(epInfo.controller)) {
    console.error(`[FAIL - STRUCTURAL] ERR_AUTHORITATIVE_ENDPOINT_CONTROLLER_MISMATCH: Authoritative fact '${afs.metric}' tool '${afs.authoritativeTool}' does not map to Controller '${epInfo.controller}' of endpoint '${afs.endpoint}'`);
    process.exit(1);
  }

  const ctrlSource = fs.readFileSync(epInfo.file, 'utf8');
  if (!ctrlSource.includes(methodName) && !ctrlSource.includes(serviceClass)) {
    console.error(`[FAIL - STRUCTURAL] ERR_CONTROLLER_SERVICE_DELEGATION_MISMATCH: Controller '${epInfo.controller}' handling '${afs.endpoint}' does not invoke service/method '${afs.javaService}' for fact '${afs.metric}'`);
    process.exit(1);
  }
}
assert(true, 'All authoritative fact sources correspond to real Java services, verified tool bindings, and real Controller endpoints', 'STRUCTURAL');

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

// Validate sources metadata_hash
if (!manifest.sources?.metadata_hash || manifest.sources.metadata_hash !== metadataHash) {
  console.error(`[FAIL - CROSS_CONTRACT] ERR_STALE_SOURCE_HASH: Manifest sources.metadata_hash (${manifest.sources?.metadata_hash}) does not match current metadata SHA-256 (${metadataHash})`);
  process.exit(1);
}
assert(true, 'Manifest metadata source hash strictly matches current metadata file SHA-256', 'CROSS_CONTRACT');

// Validate commit: must be valid 40-char hex, cannot be dummy repeating like 1111...
const sourceCommit = manifest.sources?.commit;
if (!sourceCommit || typeof sourceCommit !== 'string' || sourceCommit.length !== 40 || /^([0-9a-f])\1{39}$/i.test(sourceCommit)) {
  console.error(`[FAIL - CROSS_CONTRACT] ERR_FORGED_SOURCE_COMMIT: Invalid or forged source commit: ${sourceCommit}`);
  process.exit(1);
}
const commitCheck = spawnSync('git', ['cat-file', '-e', `${sourceCommit}^{commit}`]);
if (commitCheck.status !== 0) {
  console.error(`[FAIL - CROSS_CONTRACT] ERR_NONEXISTENT_SOURCE_COMMIT: Source commit ${sourceCommit} does not exist in git repository`);
  process.exit(1);
}

// Verify that the source commit actually contains contracts/agent-capabilities/generated/descriptors.json
const treeCheck = spawnSync('git', ['cat-file', '-e', `${sourceCommit}:contracts/agent-capabilities/generated/descriptors.json`]);
if (treeCheck.status !== 0) {
  console.error(`[FAIL - CROSS_CONTRACT] ERR_UNRELATED_SOURCE_COMMIT: Source commit ${sourceCommit} is unrelated and does not contain contracts/agent-capabilities/generated/descriptors.json`);
  process.exit(1);
}
assert(true, 'Manifest source commit exists and contains descriptors source artifact', 'CROSS_CONTRACT');

// Unconditionally verify descriptors from declared source commit
let commitDescContent;
try {
  commitDescContent = execFileSync('git', ['show', `${sourceCommit}:contracts/agent-capabilities/generated/descriptors.json`], { encoding: 'utf8' });
} catch (err) {
  console.error(`[FAIL - CROSS_CONTRACT] ERR_MISSING_COMMIT_DESCRIPTORS: Failed to read descriptors from source commit ${sourceCommit}: ${err.message}`);
  process.exit(1);
}

const commitDescHash = crypto.createHash('sha256').update(commitDescContent).digest('hex');
if (commitDescHash !== manifest.sources?.descriptors_hash) {
  console.error(`[FAIL - CROSS_CONTRACT] ERR_COMMIT_DESCRIPTORS_HASH_MISMATCH: Descriptors in source commit ${sourceCommit} has hash ${commitDescHash}, which does not match manifest.sources.descriptors_hash ${manifest.sources?.descriptors_hash}`);
  process.exit(1);
}

// Obtain and check explicit descriptors if provided
const descriptorsArg = getArg('--descriptors', null);
if (descriptorsArg) {
  if (!fs.existsSync(descriptorsArg)) {
    console.error(`[FAIL - CROSS_CONTRACT] ERR_MISSING_EXPLICIT_DESCRIPTORS: Explicit descriptors file at ${descriptorsArg} does not exist`);
    process.exit(1);
  }
  const explicitDescContent = fs.readFileSync(descriptorsArg, 'utf8');
  const explicitDescHash = crypto.createHash('sha256').update(explicitDescContent).digest('hex');
  if (explicitDescHash !== commitDescHash) {
    console.error(`[FAIL - CROSS_CONTRACT] ERR_EXPLICIT_DESCRIPTORS_MISMATCH: Explicit descriptors file hash ${explicitDescHash} does not match source commit descriptors hash ${commitDescHash}`);
    process.exit(1);
  }
}

// Obtain and check adjacent descriptors if present
const adjacentDescPath = path.join(path.dirname(manifestPath), 'descriptors.json');
if (fs.existsSync(adjacentDescPath)) {
  const adjacentDescContent = fs.readFileSync(adjacentDescPath, 'utf8');
  const adjacentDescHash = crypto.createHash('sha256').update(adjacentDescContent).digest('hex');
  if (adjacentDescHash !== commitDescHash) {
    console.error(`[FAIL - CROSS_CONTRACT] ERR_ADJACENT_DESCRIPTORS_MISMATCH: Adjacent descriptors file hash ${adjacentDescHash} does not match source commit descriptors hash ${commitDescHash}`);
    process.exit(1);
  }
}
assert(true, `Manifest descriptors_hash matches real content hash in commit and input files (${commitDescHash})`, 'CROSS_CONTRACT');

// Validate manifest document against parsed JSON schema
const schemaErrors = [];
validateNodeAgainstSchema(parsedSchema, parsedSchema, manifest, '$', schemaErrors);
if (schemaErrors.length > 0) {
  console.error(`[FAIL - CROSS_CONTRACT] Manifest failed schema validation against ${schemaPath}: ${schemaErrors[0]}`);
  process.exit(1);
}
assert(true, 'Actual input Manifest strictly conforms to Draft 2020-12 manifest.schema.json', 'CROSS_CONTRACT');

// Validate actual manifest input with validator engine
try {
  validateCapabilityManifest(manifest, FROZEN_JAVA_REGISTERED_TOOLS, verifiedBindings);
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
        target.confirmation.mode = 'none';
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

    validateCapabilityManifest(mutated, FROZEN_JAVA_REGISTERED_TOOLS, verifiedBindings);
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
