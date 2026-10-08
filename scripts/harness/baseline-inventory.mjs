#!/usr/bin/env node
// H01 read-only baseline inventory for the original DeepSeek Harness.
//
// Owner: deepseek-harness (H01). This script is READ-ONLY against the desktop
// Harness source tree: it runs only `git rev-parse` / `git status --porcelain`
// and reads files to hash them. It never writes, stages, checks out, installs,
// or starts anything inside that tree.
//
// Modes:
//   (default)   human-readable inventory summary
//   --json      machine-readable inventory on stdout
//   --check     compare the live tree against the frozen lock recorded in
//               agent-service/tests/fixtures/runtime_scenarios.json
//
// Exit codes: 0 = ok / no drift, 1 = drift detected, 2 = usage or IO error.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const DEFAULT_FIXTURE = join(REPO_ROOT, 'agent-service', 'tests', 'fixtures', 'runtime_scenarios.json');
const DSH_HOME = join(homedir(), '.dsh');

// The mechanism extension points H01 must not silently lose. Every entry is a
// file the integration design depends on; `required: true` means a missing file
// is baseline drift rather than a renamed package.
export const EXTENSION_POINTS = [
  { id: 'loop-main', path: 'packages/core/agent-loop/src/agent.ts', required: true, role: 'turn/step 循环、模型流调用、工具执行、cancel/steer' },
  { id: 'loop-tool-calls', path: 'packages/core/agent-loop/src/tool-calls.ts', required: true, role: '工具调度与中止语义' },
  { id: 'loop-inbox', path: 'packages/core/agent-loop/src/inbox.ts', required: true, role: 'steer/inject 的下一步注入边界' },
  { id: 'agent-registry', path: 'packages/core/agent/src/index.ts', required: true, role: 'create/resume/handle 注册表' },
  { id: 'agent-runtime-types', path: 'packages/core/agent/src/runtime-types.ts', required: true, role: 'Agent/followup/steer/cancel 契约' },
  { id: 'agent-dispatch', path: 'packages/core/agent/src/dispatch.ts', required: true, role: '事件派发与 scope 过滤' },
  { id: 'tools-registry', path: 'packages/core/tools/src/index.ts', required: true, role: 'tools.register 与输出 schema 校验' },
  { id: 'tools-json-schema', path: 'packages/core/tools/src/json-schema.ts', required: true, role: 'JSON Schema 支持子集' },
  { id: 'tools-schema-dsl', path: 'packages/core/tools/src/schema.ts', required: true, role: 'defineTool 作者接口' },
  { id: 'system-prompt', path: 'packages/core/system-prompt/src/index.ts', required: true, role: 'system prompt 段落扩展点' },
  { id: 'compaction-basic', path: 'packages/compaction/compaction-basic/src/index.ts', required: true, role: '自动压缩策略' },
  { id: 'compaction-tool-result-pruner', path: 'packages/compaction/compaction-tool-result-pruner/src/index.ts', required: true, role: '超大工具结果裁剪' },
  { id: 'compaction-image-offload', path: 'packages/compaction/compaction-image-offload/src/index.ts', required: true, role: '图片预算卸载重试' },
  { id: 'session-persistence-jsonl', path: 'packages/session/session-persistence-jsonl/src/index.ts', required: true, role: '会话日志持久化' },
  { id: 'session-checkpoint-policy', path: 'packages/session/session-checkpoint-policy/src/index.ts', required: true, role: '每次模型请求前的持久化检查点' },
  { id: 'llm-service', path: 'packages/llm/llm/src/index.ts', required: true, role: 'llm.stream 模型边界' },
  { id: 'llm-deepseek', path: 'packages/llm/llm-deepseek/src/index.ts', required: true, role: 'provider/baseURL/model 配置' },
  { id: 'llm-retry', path: 'packages/llm/llm-retry/src/index.ts', required: true, role: '重试策略' },
  { id: 'token-meter', path: 'packages/llm/token-meter/src/index.ts', required: true, role: '上下文计量' },
  { id: 'user-approval', path: 'packages/interaction/user-approval/src/index.ts', required: true, role: '工具许可 answerer' },
  { id: 'user-questions', path: 'packages/interaction/user-questions/src/index.ts', required: true, role: '结构化提问 answerer' },
  { id: 'tool-ask-user', path: 'packages/interaction/tool-ask-user/src/index.ts', required: true, role: '模型侧提问工具' },
  { id: 'subagent', path: 'packages/subagent/subagent/src/index.ts', required: true, role: '子 Agent 注册表' },
  { id: 'agent-presets', path: 'packages/preset/agent-presets/src/index.ts', required: true, role: '按会话组装 Agent 平面' },
  { id: 'sdk-server', path: 'packages/sdk/server/src/index.ts', required: true, role: 'SDK 传输插件入口（仅 initialize/session/prompt/shutdown）' },
  { id: 'sdk-server-impl', path: 'packages/sdk/server/src/server.ts', required: true, role: 'SDK 私有 sessions 注册表与 createSession 冲突点' },
  { id: 'sdk-protocol', path: 'packages/sdk/protocol/src/index.ts', required: true, role: 'SDK 协议形状' },
  { id: 'sdk-client', path: 'packages/sdk/client/src/index.ts', required: true, role: 'SDK 客户端' },
  { id: 'bundle-base', path: 'packages/bundle/base/cordis.patch.yml', required: true, role: '宿主平面完整组合' },
  { id: 'bundle-web-app', path: 'packages/bundle/web-app/cordis.patch.yml', required: true, role: 'Web 表面组合' },
  { id: 'bundle-sdk-app', path: 'packages/bundle/sdk-app/cordis.patch.yml', required: true, role: '完整 SDK 组合（maxTokensAsSuccess 默认 true）' },
  { id: 'bundle-sdk-minimal', path: 'packages/bundle/sdk-minimal/cordis.patch.yml', required: true, role: '最小 SDK 组合（不含压缩/子 Agent/PTC）' },
  { id: 'preset-standard', path: 'packages/preset/agent-presets/presets/standard/agent.cordis.yml', required: true, role: '完整 Agent 平面组合' },
];

// Lockfiles and manifests whose digests pin the dependency graph.
export const LOCKED_FILES = ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json'];

// The active profile layers outside the repository.
export const PROFILE_FILES = [
  { id: 'profile-web-root', path: join(DSH_HOME, 'profiles', 'web', 'cordis.yml') },
  { id: 'profile-web-patch', path: join(DSH_HOME, 'profiles', 'web', 'cordis.patch.yml') },
  { id: 'profile-web-package', path: join(DSH_HOME, 'profiles', 'web', 'package.json') },
  { id: 'profile-desktop-root', path: join(DSH_HOME, 'profiles', 'desktop', 'cordis.yml') },
  { id: 'profile-desktop-patch', path: join(DSH_HOME, 'profiles', 'desktop', 'cordis.patch.yml') },
  { id: 'profile-desktop-package', path: join(DSH_HOME, 'profiles', 'desktop', 'package.json') },
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function countLines(path) {
  const text = readFileSync(path, 'utf8');
  if (text.length === 0) return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

/** Read-only git query. Throws with a captured stderr on failure. */
function git(repoPath, args) {
  return execFileSync('git', ['-C', repoPath, ...args], { encoding: 'utf8' }).trim();
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const err = new Error(`cannot read ${label} at ${path}: ${error.message}`);
    err.code = 'INVENTORY_IO';
    throw err;
  }
}

export function collectInventory(harnessPath, { includeProfiles = true } = {}) {
  if (!existsSync(harnessPath)) {
    const err = new Error(`Harness source tree not found at ${harnessPath}`);
    err.code = 'INVENTORY_IO';
    throw err;
  }
  if (!existsSync(join(harnessPath, '.git'))) {
    const err = new Error(`${harnessPath} is not a git working tree; the baseline cannot be locked`);
    err.code = 'INVENTORY_IO';
    throw err;
  }

  const head = git(harnessPath, ['rev-parse', 'HEAD']);
  const branch = git(harnessPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const dirtyStatus = git(harnessPath, ['status', '--porcelain'])
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const lockedHashes = {};
  for (const rel of LOCKED_FILES) {
    const abs = join(harnessPath, rel);
    lockedHashes[rel] = existsSync(abs) ? sha256(abs) : null;
  }

  const extensionPoints = EXTENSION_POINTS.map((entry) => {
    const abs = join(harnessPath, entry.path);
    if (!existsSync(abs)) {
      return { ...entry, present: false, sha256: null, lines: null, bytes: null };
    }
    return {
      ...entry,
      present: true,
      sha256: sha256(abs),
      lines: countLines(abs),
      bytes: statSync(abs).size,
    };
  });

  const profileFiles = includeProfiles
    ? PROFILE_FILES.map((entry) => ({
        ...entry,
        present: existsSync(entry.path),
        sha256: existsSync(entry.path) ? sha256(entry.path) : null,
      }))
    : [];

  const packageJson = readJson(join(harnessPath, 'package.json'), 'Harness package.json');
  const webProfile = includeProfiles
    ? readJson(join(DSH_HOME, 'profiles', 'web', 'package.json'), 'web profile package.json')
    : null;

  return {
    harnessPath,
    harnessHead: head,
    harnessBranch: branch,
    harnessVersion: packageJson.version ?? null,
    harnessDirtyPaths: dirtyStatus,
    lockedHashes,
    extensionPoints,
    missingRequired: extensionPoints.filter((entry) => entry.required && !entry.present).map((e) => e.path),
    profileFiles,
    profileBundles: webProfile?.dsh?.profile?.bundles ?? [],
    profilePatchReload: webProfile?.dsh?.profile?.patchReload ?? null,
    collectedAt: new Date().toISOString(),
  };
}

function summarize(inventory) {
  const lines = [];
  lines.push(`Harness       ${inventory.harnessPath}`);
  lines.push(`HEAD          ${inventory.harnessHead} (${inventory.harnessBranch})`);
  lines.push(`Version       ${inventory.harnessVersion}`);
  lines.push(`Dirty paths   ${inventory.harnessDirtyPaths.length}: ${inventory.harnessDirtyPaths.join(' | ') || '-'}`);
  lines.push('');
  lines.push('Locked digests');
  for (const [file, hash] of Object.entries(inventory.lockedHashes)) {
    lines.push(`  ${file.padEnd(20)} ${hash ?? '<missing>'}`);
  }
  lines.push('');
  lines.push(`Extension points (${inventory.extensionPoints.length})`);
  for (const entry of inventory.extensionPoints) {
    const state = entry.present ? `${String(entry.lines).padStart(5)} lines  ${entry.sha256.slice(0, 12)}` : 'MISSING';
    lines.push(`  ${entry.id.padEnd(30)} ${state}`);
  }
  if (inventory.missingRequired.length > 0) {
    lines.push('');
    lines.push(`MISSING REQUIRED: ${inventory.missingRequired.join(', ')}`);
  }
  lines.push('');
  lines.push(`Profile bundles (web): ${inventory.profileBundles.join(', ') || '-'}`);
  lines.push(`Profile patchReload:   ${inventory.profilePatchReload ?? '-'}`);
  lines.push('');
  lines.push('Profile layer digests');
  for (const entry of inventory.profileFiles) {
    lines.push(`  ${entry.id.padEnd(24)} ${entry.sha256 ? entry.sha256.slice(0, 16) : '<missing>'}`);
  }
  return lines.join('\n');
}

/** Compare the live tree against the lock frozen in the fixture. */
export function checkAgainstFixture(inventory, fixtureDoc) {
  const drift = [];
  const baseline = fixtureDoc.baseline ?? {};

  if (inventory.harnessHead !== baseline.harnessHead) {
    drift.push(`HEAD changed: locked ${baseline.harnessHead}, live ${inventory.harnessHead}`);
  }
  for (const [file, locked] of Object.entries(baseline.lockedHashes ?? {})) {
    const live = inventory.lockedHashes[file];
    if (live === undefined) {
      drift.push(`locked file ${file} is not tracked by the inventory`);
    } else if (live !== locked) {
      drift.push(`${file} changed: locked ${locked.slice(0, 12)}, live ${String(live).slice(0, 12)}`);
    }
  }
  if (inventory.missingRequired.length > 0) {
    drift.push(`required extension points missing: ${inventory.missingRequired.join(', ')}`);
  }
  const lockedBundles = baseline.profileBundles ?? [];
  if (inventory.profileBundles.length > 0) {
    const same =
      lockedBundles.length === inventory.profileBundles.length &&
      lockedBundles.every((name, index) => name === inventory.profileBundles[index]);
    if (!same) {
      drift.push(`profile bundles changed: locked [${lockedBundles.join(', ')}], live [${inventory.profileBundles.join(', ')}]`);
    }
  } else {
    drift.push('live profile bundles are unavailable, so the composition lock is UNVERIFIED');
  }
  const presetEntry = inventory.extensionPoints.find((entry) => entry.id === 'preset-standard');
  if (!presetEntry?.present) drift.push('the standard agent preset composition is missing');
  if (baseline.agentPreset && baseline.agentPreset !== 'standard') {
    drift.push(`locked agent preset is "${baseline.agentPreset}", which the inventory does not resolve`);
  }

  return { ok: drift.length === 0, drift };
}

function main(argv) {
  const json = argv.includes('--json');
  const check = argv.includes('--check');
  const harnessArgIndex = argv.indexOf('--harness');
  const fixtureArgIndex = argv.indexOf('--fixture');
  const harnessPath =
    harnessArgIndex >= 0 ? argv[harnessArgIndex + 1] : '/Users/moxiao/Desktop/Deepseek Harness';
  const fixturePath = fixtureArgIndex >= 0 ? argv[fixtureArgIndex + 1] : DEFAULT_FIXTURE;

  try {
    const inventory = collectInventory(harnessPath);
    if (check) {
      const doc = readJson(fixturePath, 'fixture');
      const result = checkAgainstFixture(inventory, doc);
      const payload = { ok: result.ok, harnessHead: inventory.harnessHead, drift: result.drift };
      if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      else if (result.ok) process.stdout.write(`LOCKED  baseline matches the live Harness tree\n        HEAD ${inventory.harnessHead}\n`);
      else {
        process.stderr.write(`DRIFT   baseline no longer matches the live Harness tree\n`);
        for (const item of result.drift) process.stderr.write(`        - ${item}\n`);
      }
      return result.ok ? 0 : 1;
    }
    process.stdout.write(json ? `${JSON.stringify(inventory, null, 2)}\n` : `${summarize(inventory)}\n`);
    return 0;
  } catch (error) {
    if (json) process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    else process.stderr.write(`ERROR   ${error.message}\n`);
    return error.code === 'INVENTORY_IO' ? 2 : 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
