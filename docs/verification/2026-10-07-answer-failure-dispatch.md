# StudyPilot daily-use answer failure remediation

User authorized this repair on 2026-10-07. Codex owns planning, review and independent acceptance. MiniMax Code and ZCode implement. This is a Task 33 user-trial defect, not authorization for Task 34 or new coding-agent capabilities.

## Reproduction and required outcome

Current root runtime is project@0793020 on agent/zcode-task-31-usage-health. Its latest real conversation successfully loads learning context and generates a LEARNING_QUERY plan, then roadmap.current.get returns HTTP 404 with the fixed business message 当前路线不存在. The gateway raises JavaBackendError and aborts the turn; the web displays 回答生成失败. All three service health checks pass. Do not confuse a missing enrollment with model outage. Do not create an enrollment in the real account merely to hide this defect.

The accepted component baselines are backend at /Users/moxiao/IdeaProjects/project-minimax-task-33, branch agent/minimax-task-33-local-handler, HEAD 2c5194a; AI/web at /Users/moxiao/IdeaProjects/project-zcode-task-33, branch agent/zcode-task-33-local-adapters, HEAD 0fe122d. Both start clean. Do not merge main or replace entire root checkout. Existing root script changes and unrelated docs must be preserved.

## MiniMax Code backend scope

- Work only in the backend worktree and existing backend branch. Read applicable AGENTS, collaboration handoff, frozen Task 33 contract, backend evidence and this dispatch.
- Use failing-first tests. For roadmap.current.get ONLY, no active owned enrollment is a successful, explicit empty result: data=null, truncated=false, action=null. Use currentMapIfPresent and the existing typed compact projection. Update its published output schema to nullable so the validator accepts the empty result. Keep the public roadmap API 404 behavior and detail/node/stage tools unchanged.
- Do not catch arbitrary 404/errors as empty. Broken template, database error and auth failure remain real failures. Preserve owner isolation and bounded projection.
- Cover never-enrolled owner, owner B when A has a route, enrolled compact result/counts, public API unchanged, and a genuine underlying failure not swallowed. Use isolated test fixtures, never mutate the user's database.
- Run affected tests, full Java tests and capability-matrix validation; update only your existing docs/verification/task-33-backend.md. Commit locally on your own branch and stop for Codex acceptance. No push required for this repair. No ai-service/web/root scripts changes, no secret/config changes, no Obsidian edits.

## ZCode AI/web and launcher scope

- AI/web modifications only in the ZCode worktree and its existing branch. Read applicable AGENTS, handoff, existing evidence and this dispatch. No backend edits and no new features.
- Add failing-first full-turn regression with learning.context.get explicitly roadmap=null and roadmap.current.get data=null; the turn must complete, honestly report no route, and still summarize other requested tasks/mastery/wrong-question facts. Verify enrolled compact results retain factual counts. Genuine tool/backend failure must remain failure, never fabricated empty or success. Use a stub model in tests; do not expose auth data.
- Make the front-end failure fallback describe query/execution failure honestly instead of implying every failure is answer generation; only a small wording/typed safe-error adjustment if necessary. Never expose raw backend exception messages/paths/secrets. Add affected UI tests.
- You are additionally authorized to edit ONLY /Users/moxiao/IdeaProjects/project/start-project.sh, stop-project.sh, README.md and a dedicated root operational evidence file docs/verification/2026-10-07-launcher-remediation.md. These existing root uncommitted scripts must be preserved and improved in place, not Git-reset. Do NOT commit root unrelated edits. Keep the original fixed ports and automatic listener cleanup policy.
- Root launcher must explicitly start backend from the accepted MiniMax worktree and AI/web from the accepted ZCode worktree. Keep stable ignored root ai-service/.env as the sole shared configuration source and .studypilot-runtime in root as the manager state/log location. Use selected AI venv, not a mismatched root dependency set. Fail clearly if chosen paths/dependencies do not exist. Report component paths/revisions in normal startup output without secrets. Runtime ownership for orphan children must allow only these configured project component roots, not arbitrary sibling projects. Save/check component identity in managed state so repeat startup cannot silently reuse an old checkout instance; old state requires close/restart. Preserve port overrides, rollback, health checks and process identity/ancestor protection.
- Do not restart services or modify the real DB; Codex owns the final stop/start and browser acceptance. Validate launcher syntax and safely validate process ownership/selected paths with disposable fixtures if useful. Coordinate nullable tool data with backend dispatch above.
- Run affected AI/web tests, relevant full suites/typecheck/build as warranted; update your dedicated evidence. Commit only AI/web/evidence in your own branch, leave root scripts reviewable uncommitted. Stop for Codex. No push/main merge/new task/frozen-plan edit/secrets/Obsidian mutation.

## Codex acceptance checkpoint

1. Matching-surface failure is established by latest real UI and tool HTTP 404.
2. Direct mechanism is missing active enrollment raised as an exception; version drift is separately confirmed.
3. Delegate scoped nullable backend and AI/web/launcher fixes above; inspect every changed file.
4. Rerun affected tests independently. Restart via root scripts. Verify runtime cwd/revision/schema alignment and real browser query on the user's existing account. Test enrolled cases with isolated fixtures rather than user data.
5. Record actual RED/GREEN and final commits, preserve real learning data and secrets. No release/PR/main merge is requested; leave user-trial version running and notify user to test.

Throughput checkpoint: backend and AI/web work have disjoint ownership. Codex can inspect launcher/runtime and prepare browser acceptance while both implement. Final restart waits until both have frozen their sources.

## Dispatch status on 2026-10-07

Subsequent direct user instruction supersedes the execution-role restriction for this repair: Codex must implement directly because both executors are unavailable. No further messages to either executor are needed. The original limited scope and acceptance gates still apply.

Both complete dispatch pointers were entered in the existing StudyPilot GUI sessions, actual input was read back before sending. MiniMax's backend message is visible but its selected Gemini model retried the LLM connection and ended with 模型服务有点不稳定，请重试. ZCode's message is visible, then its selected Gemini model returned User location is not supported for the API use. Neither worktree changed, neither agent produced implementation or tool execution evidence. Dispatch delivery is confirmed; successful start of development is NOT confirmed. Codex asked the user whether to use the logged-in native MiniMax model or restore Gemini. No app-wide model/proxy settings were changed. Live StudyPilot services were not stopped or restarted. Source repair and end-to-end acceptance remain pending.
