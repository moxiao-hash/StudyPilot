/**
 * Capability Manifest Consumer Validation Engine (ZCode H02)
 *
 * Implements strict consumer-side checks for tool exposure, governance boundaries,
 * authoritative fact provenance, schema conformity, and user-exclusive action isolation.
 */

export const FROZEN_JAVA_REGISTERED_TOOLS = new Set([
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

export const WRITE_TOOLS = new Set([
  'roadmap.enroll', 'roadmap.upgrade', 'learning.goal.create', 'learning.plan.create',
  'schedule.refresh', 'assessment.node_quiz.generate', 'assessment.wrong_question_review.create',
  'learning.task.update', 'materials.text.import', 'materials.web.import',
  'notifications.mark_read', 'settings.learning.update', 'workspaces.register',
  'artifacts.submit', 'runner.check.run', 'runner.dependencies.prepare',
  'developer.patch.apply', 'developer.git.commit', 'developer.git.push',
  'assessment.node_quiz.retry', 'developer.interface_fallback.execute'
]);

export const USER_EXCLUSIVE_ACTIONS = [
  'QUIZ_SUBMISSION',
  'CHECKIN_SUMMARY_SUBMIT',
  'ACCEPT_ARTIFACT_SUBMISSION',
  'AUTH_LOGIN',
  'AUTH_REGISTER',
  'GOVERNANCE_GRANT_APPROVAL'
];

export const KNOWN_TOOL_KEYS = new Set([
  'name', 'version', 'category', 'description',
  'when_to_use', 'when_not_to_use',
  'input_schema', 'output_schema',
  'side_effect', 'permission', 'confirmation', 'idempotency',
  'timeout_ms', 'error_contract', 'cost_hint', 'exposure',
  'authoritative_facts', 'examples', 'source_provenance'
]);

export const KNOWN_SERVICE_HANDLERS = new Set([
  'AgentGovernanceService',
  'AgentLearningContextService',
  'AgentToolHandler',
  'AiCredentialService',
  'AssistantAutomationService',
  'AssistantHealthService',
  'CreateLearningGoalService',
  'FunctionalAgentToolHandler',
  'GovernedFunctionalAgentToolHandler',
  'LearningPlanService',
  'LearningTaskService',
  'LocalInterfaceFallbackService',
  'MaterialService',
  'NavigationToolHandler',
  'NotificationService',
  'QuizService',
  'QuizAttemptService',
  'RoadmapArtifactService',
  'RoadmapEnrollmentService',
  'RoadmapLearningLoopService',
  'RoadmapQueryService',
  'RoadmapScheduleService',
  'RoadmapService',
  'RoadmapUpgradeService',
  'RunnerGovernanceService',
  'UserSettingsService',
  'WorkspaceDeveloperService',
  'WrongQuestionReviewService',
  'WrongQuestionService'
]);

export const ROUTE_PATH_MAP: Record<string, string> = {
  login: '/login',
  register: '/register',
  'not-found': '/:pathMatch(.*)*',
  assistant: '/',
  dashboard: '/dashboard',
  roadmap: '/roadmap',
  'roadmap-stage': '/roadmap/stages/:id',
  'roadmap-module': '/roadmap/modules/:id',
  'roadmap-node': '/roadmap/nodes/:id',
  goals: '/goals',
  plans: '/plans',
  'plan-detail': '/plans/:id',
  today: '/today',
  materials: '/materials',
  'material-detail': '/materials/:id',
  quiz: '/quizzes/:id',
  attempt: '/attempts/:id',
  'wrong-questions': '/wrong-questions',
  mastery: '/mastery',
  courses: '/courses',
  'course-detail': '/courses/:slug',
  lesson: '/lessons/:lessonId',
  knowledge: '/knowledge',
  'agent-plan': '/agent/plan',
  'agent-tasks': '/agent/tasks',
  activity: '/activity',
  'assistant-health': '/assistant/health',
  notifications: '/notifications',
  settings: '/settings',
  'settings-ai': '/settings/ai',
  'workspace-artifacts': '/workspaces'
};

export interface CapabilityToolEntry {
  name: string;
  version: number;
  category: string;
  description: string;
  when_to_use?: string[];
  when_not_to_use?: string[];
  input_schema?: Record<string, unknown>;
  output_schema?: {
    type?: string;
    required?: string[];
    properties?: Record<string, { type?: string; [key: string]: unknown }>;
    items?: {
      type?: string;
      properties?: Record<string, unknown>;
    };
    [key: string]: unknown;
  };
  side_effect?: {
    effect: 'READ' | 'NAVIGATE' | 'WRITE' | 'LOCAL';
    risk_level: 'NONE' | 'LOW' | 'HIGH';
    mutates_business_data?: boolean;
  };
  permission?: {
    required_scope?: string | null;
  };
  confirmation?: {
    mode: 'none' | 'always_user_confirmation' | 'conditional_scope_grant';
    waiting_status?: string | null;
    notes?: string;
  };
  idempotency?: {
    required: boolean;
  };
  timeout_ms?: number;
  cost_hint?: {
    local?: boolean;
    external_dependency?: string | null;
    notes?: string;
    [key: string]: unknown;
  };
  exposure?: {
    state: 'allowed' | 'disabled' | 'pending';
    reason: string;
  };
  authoritative_facts?: Array<{ fact: string; meaning: string }>;
  examples?: Array<{
    name: string;
    input?: Record<string, unknown>;
    expect: string;
    outcome: string;
    output?: unknown;
    fixture_kind?: string;
    [key: string]: unknown;
  }>;
  source_provenance?: {
    registration?: string;
    handler?: string;
    output_schema?: string;
  };
  [key: string]: unknown;
}

export interface CapabilityManifest {
  manifest_version: string;
  generated_at?: string;
  sources?: {
    descriptor_count?: number;
    descriptors_hash?: string;
    metadata_hash?: string;
    [key: string]: unknown;
  };
  tools: CapabilityToolEntry[];
  [key: string]: unknown;
}

function findForbiddenField(
  obj: unknown,
  forbidden: Set<string> = new Set(['ownerId', 'token', 'password', 'secret', 'credential'])
): string | null {
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
 * Lightweight Recursive JSON Schema Validator (Draft 2020-12 subset)
 * ------------------------------------------------------------------ */
function resolveRef(root: Record<string, unknown>, ref: string): Record<string, unknown> {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref supported: ${ref}`);
  let current: unknown = root;
  for (const part of ref.slice(2).split('/')) {
    current = (current as Record<string, unknown>)?.[part];
    if (current === undefined) throw new Error(`Unresolvable $ref: ${ref}`);
  }
  return current as Record<string, unknown>;
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'number';
  return typeof value;
}

function matchesType(value: unknown, expected: string): boolean {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

export function validateNodeAgainstSchema(
  rootSchema: Record<string, unknown>,
  schema: Record<string, unknown>,
  value: unknown,
  path = '$',
  errors: string[] = []
): void {
  if (!schema || typeof schema !== 'object') return;

  if (schema.$ref && typeof schema.$ref === 'string') {
    validateNodeAgainstSchema(rootSchema, resolveRef(rootSchema, schema.$ref), value, path, errors);
    return;
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`SCHEMA: ${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`SCHEMA: ${path} value ${JSON.stringify(value)} not in allowed enum [${schema.enum.join(', ')}]`);
  }

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type as string];
    if (!expected.some((one) => matchesType(value, one))) {
      errors.push(`SCHEMA: ${path} type must be ${expected.join('|')}, got ${typeOf(value)}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`SCHEMA: ${path} length < ${schema.minLength}`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push(`SCHEMA: ${path} does not match pattern ${schema.pattern}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`SCHEMA: ${path} items count (${value.length}) < ${schema.minItems}`);
    }
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((item, idx) => {
        validateNodeAgainstSchema(rootSchema, schema.items as Record<string, unknown>, item, `${path}[${idx}]`, errors);
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(schema.required)) {
      for (const req of schema.required as string[]) {
        if (!Object.prototype.hasOwnProperty.call(obj, req)) {
          errors.push(`SCHEMA: ${path} missing required property '${req}'`);
        }
      }
    }
    if (schema.additionalProperties === false && schema.properties) {
      const allowedProps = new Set(Object.keys(schema.properties as Record<string, unknown>));
      for (const k of Object.keys(obj)) {
        if (!allowedProps.has(k)) {
          errors.push(`SCHEMA: ${path} contains unexpected property '${k}'`);
        }
      }
    }
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [k, propSchema] of Object.entries(schema.properties as Record<string, unknown>)) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          validateNodeAgainstSchema(rootSchema, propSchema as Record<string, unknown>, obj[k], `${path}.${k}`, errors);
        }
      }
    }
  }
}

export function validateCapabilityManifest(
  doc: CapabilityManifest,
  registeredToolsSet: Set<string> = FROZEN_JAVA_REGISTERED_TOOLS
): { ok: boolean; toolCount: number } {
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
  const seenNames = new Set<string>();
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

    // 2.7 Handler provenance check: must match real backend service classes
    const handler = t.source_provenance?.handler;
    if (!handler || typeof handler !== 'string' || handler.trim().length === 0) {
      throw new Error(`ERR_MISSING_HANDLER: Tool ${t.name} is missing source_provenance.handler`);
    }
    const hasValidService = Array.from(KNOWN_SERVICE_HANDLERS).some((svc) => handler.includes(svc));
    if (!hasValidService) {
      throw new Error(`ERR_FICTIONAL_HANDLER: Fictional handler target '${handler}' in tool ${t.name} does not match any registered service`);
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

    // 2.11 Examples validation: minItems, required output, type conformity, forbidden security fields
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

        // Check successful output presence
        if (ex.outcome === 'ok') {
          if (!Object.prototype.hasOwnProperty.call(ex, 'output') || ex.output === undefined) {
            throw new Error(`ERR_MISSING_SUCCESSFUL_OUTPUT: Example '${ex.name}' in tool ${t.name} with outcome 'ok' must provide an output field`);
          }

          // Output instance type check against output_schema
          const schemaType = t.output_schema?.type;
          if (schemaType === 'object') {
            if (typeof ex.output !== 'object' || Array.isArray(ex.output) || ex.output === null) {
              throw new Error(`ERR_INVALID_OUTPUT_INSTANCE: Tool ${t.name} example '${ex.name}' output type mismatch: expected object, got ${typeof ex.output}`);
            }
          } else if (schemaType === 'array') {
            if (!Array.isArray(ex.output)) {
              throw new Error(`ERR_INVALID_OUTPUT_INSTANCE: Tool ${t.name} example '${ex.name}' output type mismatch: expected array, got ${typeof ex.output}`);
            }
          }

          // Schema required properties check on example output
        if (t.output_schema?.required && ex.output !== null && typeof ex.output === 'object' && !Array.isArray(ex.output)) {
          const outObj = ex.output as Record<string, unknown>;
          for (const req of t.output_schema.required) {
            if (!Object.prototype.hasOwnProperty.call(outObj, req)) {
              throw new Error(`ERR_MISSING_OUTPUT_REQUIRED_PROPERTY: Tool ${t.name} example output missing required property '${req}'`);
            }
          }
        }

        // Output instance property type check
        if (t.output_schema?.properties && ex.output !== null && typeof ex.output === 'object' && !Array.isArray(ex.output)) {
          const outObj = ex.output as Record<string, unknown>;
          for (const [propName, propSchema] of Object.entries(t.output_schema.properties)) {
            if (Object.prototype.hasOwnProperty.call(outObj, propName)) {
              const val = outObj[propName];
              if (ex.fixture_kind === 'shape_placeholder' && val === '<shape-placeholder>') {
                continue;
              }
              const expectedType = propSchema.type;
              if (expectedType === 'integer') {
                if (ex.fixture_kind === 'shape_placeholder' && val === '<shape-placeholder>') {
                  // Upstream shape placeholder accepted
                } else if (typeof val !== 'number' || !Number.isInteger(val)) {
                  throw new Error(`ERR_WRONG_OUTPUT_PROPERTY_TYPE: Tool ${t.name} example output property '${propName}' expected integer, got ${typeof val}`);
                }
              } else if (expectedType === 'number') {
                if (typeof val !== 'number') {
                  throw new Error(`ERR_WRONG_OUTPUT_PROPERTY_TYPE: Tool ${t.name} example output property '${propName}' expected number, got ${typeof val}`);
                }
              } else if (expectedType === 'string') {
                if (typeof val !== 'string') {
                  throw new Error(`ERR_WRONG_OUTPUT_PROPERTY_TYPE: Tool ${t.name} example output property '${propName}' expected string, got ${typeof val}`);
                }
              } else if (expectedType === 'boolean') {
                if (typeof val !== 'boolean') {
                  throw new Error(`ERR_WRONG_OUTPUT_PROPERTY_TYPE: Tool ${t.name} example output property '${propName}' expected boolean, got ${typeof val}`);
                }
              }
            }
          }
        }
      }
    }

    // 2.12 Authoritative facts verification against tool output_schema
    const declaredProps = (t.output_schema?.properties || t.output_schema?.items?.properties || {}) as Record<string, unknown>;
    for (const fact of t.authoritative_facts || []) {
      if (!(fact.fact in declaredProps)) {
        throw new Error(`ERR_UNVERIFIED_AUTHORITATIVE_FACT: Authoritative fact '${fact.fact}' has no declared source in tool ${t.name} output schema`);
      }
    }
  }

  return { ok: true, toolCount: doc.tools.length };
}
