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
    properties?: Record<string, unknown>;
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

    // 2.3 User-exclusive operation check (checked before registry)
    if (
      t.name.includes('quiz.submit') ||
      t.name.includes('checkin.submit') ||
      t.name.includes('artifact.accept') ||
      t.name === 'assessment.quiz.submit'
    ) {
      throw new Error(`ERR_USER_EXCLUSIVE_EXPOSED: Boundary breach: User-exclusive operation ${t.name} cannot be exposed as an agent tool`);
    }

    // 2.4 Fictional wire name check
    if (!registeredToolsSet.has(t.name)) {
      throw new Error(`ERR_FICTIONAL_TOOL_TARGET: Fictional tool wire name not in Java registry: ${t.name}`);
    }

    // 2.5 Handler provenance check
    const handler = t.source_provenance?.handler;
    if (!handler || typeof handler !== 'string' || handler.trim().length === 0) {
      throw new Error(`ERR_MISSING_HANDLER: Tool ${t.name} is missing source_provenance.handler`);
    }
    if (handler.includes('UnregisteredClass') || handler.includes('noSuchMethod')) {
      throw new Error(`ERR_FICTIONAL_HANDLER: Fictional handler target '${handler}' in tool ${t.name}`);
    }

    // 2.6 Governance conflict check: HIGH risk cannot have confirmation mode none
    if (t.side_effect?.risk_level === 'HIGH' && t.confirmation?.mode === 'none') {
      throw new Error(`ERR_GOVERNANCE_CONFLICT: Governance conflict: HIGH risk tool cannot have confirmation mode 'none' (tool: ${t.name})`);
    }

    // 2.7 Write tools must be disabled prior to H11
    if (WRITE_TOOLS.has(t.name) && t.exposure?.state === 'allowed') {
      throw new Error(`ERR_WRITE_TOOL_EXPOSED: WRITE tool ${t.name} must be disabled prior to Task H11`);
    }

    // 2.8 Coding / developer tools must be disabled
    if ((t.name.startsWith('developer.') || t.name.startsWith('runner.')) && t.exposure?.state === 'allowed') {
      throw new Error(`ERR_CODING_RUNNER_EXPOSED: Security violation: Coding/Developer tool ${t.name} must be disabled by default`);
    }

    // 2.9 Example validation: forbidden fields & output type match
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

    // 2.10 Authoritative facts verification against tool output_schema
    const declaredProps = (t.output_schema?.properties || t.output_schema?.items?.properties || {}) as Record<string, unknown>;
    for (const fact of t.authoritative_facts || []) {
      if (!(fact.fact in declaredProps)) {
        throw new Error(`ERR_UNVERIFIED_AUTHORITATIVE_FACT: Authoritative fact '${fact.fact}' has no declared source in tool ${t.name} output schema`);
      }
    }
  }

  return { ok: true, toolCount: doc.tools.length };
}
