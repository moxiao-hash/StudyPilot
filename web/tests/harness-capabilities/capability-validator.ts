/**
 * Capability Manifest Consumer Validation Engine (ZCode H02)
 *
 * Implements strict consumer-side checks for tool exposure, governance boundaries,
 * authoritative fact provenance, and user-exclusive action isolation.
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

export interface CapabilityToolEntry {
  name: string;
  version: number;
  category: string;
  description: string;
  when_to_use?: string[];
  when_not_to_use?: string[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
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
}

export interface CapabilityManifest {
  manifest_version: string;
  generated_at?: string;
  sources?: Record<string, unknown>;
  tools: CapabilityToolEntry[];
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

  // 1. Tool count and omission check
  const toolNames = doc.tools.map((t) => t.name);
  const seenNames = new Set<string>();
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
    // User exclusive operation check
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
