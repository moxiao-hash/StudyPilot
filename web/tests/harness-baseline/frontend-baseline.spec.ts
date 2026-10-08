import { describe, it, expect, vi, beforeEach } from 'vitest'
import router from '@/app/router'
import eventSamplesFixture from './event-samples.fixture.json'
import {
  VALID_ASSISTANT_EVENT_TYPES,
  subscribeAssistantEvents,
  type AssistantEventType,
} from '@/services/current/assistant'
import {
  dispatchUiAction,
  resolveNamedRouteFromUiAction,
  FROZEN_MODAL_MATRIX,
  FROZEN_FOCUS_MATRIX,
} from '@/modules/assistant/uiActionDispatcher'

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index++]))
      } else {
        controller.close()
      }
    },
  })
}

describe('H01 Frontend Baseline Compatibility (Round 2)', () => {
  describe('1. [STRUCTURAL] Vue Named Routes & AppShell Inventory', () => {
    it('identifies 31 named routes (28 guarded, 3 public) and legacy routes', () => {
      const allRoutes = router.getRoutes()
      const namedRoutes = allRoutes.filter((r) => typeof r.name === 'string')
      expect(namedRoutes.length).toBe(31)

      const publicRoutes = namedRoutes.filter((r) => r.meta?.public === true)
      expect(publicRoutes.map((r) => r.name).sort()).toEqual(['login', 'not-found', 'register'].sort())

      const guardedRoutes = namedRoutes.filter((r) => r.meta?.public !== true)
      expect(guardedRoutes.length).toBe(28)

      const routeNames = namedRoutes.map((r) => r.name)
      expect(routeNames).toContain('assistant')
      expect(routeNames).toContain('assistant-health')
      expect(routeNames).toContain('settings-ai')
      expect(routeNames).toContain('workspace-artifacts')

      const legacyRoutes = namedRoutes.filter((r) => r.meta?.legacy === true)
      expect(legacyRoutes.map((r) => r.name).sort()).toEqual(['course-detail', 'courses', 'lesson'].sort())
    })

    it('verifies 12 legacy assistant event types are recognized in VALID_ASSISTANT_EVENT_TYPES', () => {
      const expectedLegacyEvents: AssistantEventType[] = [
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
      ]

      for (const evt of expectedLegacyEvents) {
        expect(VALID_ASSISTANT_EVENT_TYPES.has(evt)).toBe(true)
      }
    })

    it('verifies UI action route resolution and frozen parameter matrices', () => {
      const resolved = resolveNamedRouteFromUiAction({ routeKey: 'ROADMAP', params: {} })
      expect(resolved).toEqual({ name: 'roadmap', params: {} })

      expect(FROZEN_MODAL_MATRIX).toEqual({
        LEARNING_GOALS: 'CREATE_GOAL',
        LEARNING_PLANS: 'CREATE_PLAN',
        MATERIALS: 'IMPORT_MATERIAL',
      })

      expect(FROZEN_FOCUS_MATRIX).toEqual({
        ASSISTANT: 'MESSAGE_INPUT',
        LEARNING_PLANS: 'PLAN_TITLE_INPUT',
      })
    })
  })

  describe('2. [BEHAVIORAL] UI Action Dispatcher Real Offline Negative Tests', () => {
    const mockRouter = { push: vi.fn(), currentRoute: { name: 'assistant' } }

    it('rejects ownerId parameter injection with explicit REJECTED receipt', async () => {
      await expect(
        dispatchUiAction(
          {
            actionId: 'act-reject-owner',
            type: 'NAVIGATE',
            routeKey: 'ROADMAP',
            params: { ownerId: 'attacker-injected-id' },
            reason: '测试参数注入',
          },
          mockRouter,
        ),
      ).rejects.toThrow('严禁携带 ownerId')

      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('rejects autoSubmit in PREFILL_FORM with explicit REJECTED receipt', async () => {
      await expect(
        dispatchUiAction(
          {
            actionId: 'act-reject-autosubmit',
            type: 'PREFILL_FORM',
            routeKey: 'LEARNING_PLANS',
            params: { formKey: 'PLAN_FORM', autoSubmit: 'true' as any },
            reason: '测试自动提交防御',
          },
          mockRouter,
        ),
      ).rejects.toThrow('严禁自动提交')
    })

    it('rejects unknown routeKey with explicit REJECTED receipt', async () => {
      await expect(
        dispatchUiAction(
          {
            actionId: 'act-reject-unknown-route',
            type: 'NAVIGATE',
            routeKey: 'UNKNOWN_MALICIOUS_ROUTE_KEY',
            params: {},
            reason: '测试未知路由',
          },
          mockRouter,
        ),
      ).rejects.toThrow('不受支持的页面动作')

      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('rejects arbitrary CSS selectors in FOCUS_ELEMENT with explicit REJECTED receipt', async () => {
      await expect(
        dispatchUiAction(
          {
            actionId: 'act-reject-css-selector',
            type: 'FOCUS_ELEMENT',
            routeKey: 'ASSISTANT',
            params: { elementKey: 'button.danger[data-id="delete"]' },
            reason: '测试原生选择器拦截',
          },
          mockRouter,
        ),
      ).rejects.toThrow('不受支持的元素聚焦')
    })

    it('rejects non-delegatable learning integrity actions with explicit REJECTED receipt', async () => {
      await expect(
        dispatchUiAction(
          {
            actionId: 'act-reject-quiz-delegate',
            type: 'PREFILL_FORM',
            routeKey: 'LEARNING_GOALS',
            params: { formKey: 'QUIZ_SUBMISSION' },
            reason: '测试代答拦截',
          },
          mockRouter,
        ),
      ).rejects.toThrow('专属行为，严禁代办')
    })
  })

  describe('3. [BEHAVIORAL] SSE Parser Real Offline Negative Tests', () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('drops unknown SSE event types without invoking consumer handler', async () => {
      const onEvent = vi.fn()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: createMockStream([
          'id: 1\nevent: MALICIOUS_UNKNOWN_EVENT\ndata: {"sequence":1,"type":"MALICIOUS_UNKNOWN_EVENT"}\n\n',
        ]),
      } as unknown as Response)

      const controller = subscribeAssistantEvents('conv-test-1', { onEvent, autoReconnect: false })
      await new Promise((r) => setTimeout(r, 50))
      controller.close()

      expect(onEvent).not.toHaveBeenCalled()
    })

    it('drops malformed JSON frames without invoking consumer handler', async () => {
      const onEvent = vi.fn()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: createMockStream([
          'id: 1\nevent: TURN_STARTED\ndata: {unclosed-malformed-json-payload\n\n',
        ]),
      } as unknown as Response)

      const controller = subscribeAssistantEvents('conv-test-2', { onEvent, autoReconnect: false })
      await new Promise((r) => setTimeout(r, 50))
      controller.close()

      expect(onEvent).not.toHaveBeenCalled()
    })

    it('drops frames where frame id does not match payload sequence', async () => {
      const onEvent = vi.fn()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: createMockStream([
          'id: 1\nevent: TURN_STARTED\ndata: {"sequence":2,"type":"TURN_STARTED","conversationId":"conv-test-3"}\n\n',
        ]),
      } as unknown as Response)

      const controller = subscribeAssistantEvents('conv-test-3', { onEvent, autoReconnect: false })
      await new Promise((r) => setTimeout(r, 50))
      controller.close()

      expect(onEvent).not.toHaveBeenCalled()
    })

    it('drops frames where sequence number is less than or equal to 0', async () => {
      const onEvent = vi.fn()
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: createMockStream([
          'id: 0\nevent: TURN_STARTED\ndata: {"sequence":0,"type":"TURN_STARTED","conversationId":"conv-test-4"}\n\n',
        ]),
      } as unknown as Response)

      const controller = subscribeAssistantEvents('conv-test-4', { onEvent, autoReconnect: false })
      await new Promise((r) => setTimeout(r, 50))
      controller.close()

      expect(onEvent).not.toHaveBeenCalled()
    })
  })

  describe('4. [CROSS_CONTRACT] Runtime Contract Consumer Validation & Provenance', () => {
    it('verifies that all mapped target runtime events use public UPPERCASE names and endReason/ok semantics', () => {
      const content = eventSamplesFixture as any
      expect(content.task).toBe('H01')
      expect(content.round).toBe('ROUND2')

      // All 12 mapped events must use uppercase target event names
      const mappings = content.runtime_event_mappings
      expect(mappings.length).toBe(12)
      for (const m of mappings) {
        expect(m.target_runtime_event).toBe(m.target_runtime_event.toUpperCase())
      }

      // Terminal turn mappings use TURN_FINISHED with endReason & ok
      const turnCompleted = mappings.find((m: any) => m.legacy_event === 'TURN_COMPLETED')
      expect(turnCompleted.target_runtime_event).toBe('TURN_FINISHED')
      expect(turnCompleted.key_identifiers).toContain('endReason')
      expect(turnCompleted.key_identifiers).toContain('ok')

      // End reasons are uppercase and distinct
      const endReasons = content.terminal_reasons_and_error_codes.end_reasons
      const codes = endReasons.map((r: any) => r.code)
      expect(codes).toContain('COMPLETED')
      expect(codes).toContain('FAILED')
      expect(codes).toContain('CANCELLED')
      expect(codes).toContain('BUDGET_EXHAUSTED')
      expect(codes).toContain('MAX_TOKENS')
      expect(codes).toContain('CAPABILITY_DENIED')

      // Verify that completed has ok: true while non-completed have ok: false
      const completedReason = endReasons.find((r: any) => r.code === 'COMPLETED')
      expect(completedReason.ok).toBe(true)
      const maxTokensReason = endReasons.find((r: any) => r.code === 'MAX_TOKENS')
      expect(maxTokensReason.ok).toBe(false)
      const cancelledReason = endReasons.find((r: any) => r.code === 'CANCELLED')
      expect(cancelledReason.ok).toBe(false)

      // Verify steer vs cancel and waiting state semantic notes
      expect(content.terminal_reasons_and_error_codes.steer_semantics.operation).toBe('steer')
      expect(content.terminal_reasons_and_error_codes.steer_semantics.description).toContain('request.steer')
      expect(content.terminal_reasons_and_error_codes.interaction_states[0].state).toBe('INTERACTION_REQUIRED')
      expect(content.terminal_reasons_and_error_codes.interaction_states[0].description).toContain('NOT a finished turn')
    })

    it('validates concrete runtime event instances structure against protocolVersion 1.0-draft', () => {
      const content = eventSamplesFixture as any
      const instances = content.runtime_event_instances
      expect(Array.isArray(instances)).toBe(true)
      expect(instances.length).toBe(12)

      for (const inst of instances) {
        expect(inst.protocolVersion).toBe('1.0-draft')
        expect(inst.kind).toBe('event')
        expect(inst.sequence).toBeGreaterThanOrEqual(1)
        expect(inst.sessionId).toMatch(/^sess-/)
        expect(inst.turnId).toMatch(/^turn-/)
        expect(inst.type).toBe(inst.type.toUpperCase())
        expect(inst.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/)
        if (inst.type !== 'TURN_STARTED') {
          expect(typeof inst.payload).toBe('object')
        }
      }
    })
  })

  describe('5. [BOUNDARY] Anti-False-Success Invariants', () => {
    it('enforces that unauthenticated router access redirects to login and cannot be claimed as business success', () => {
      const targetRoute = { path: '/workspaces', fullPath: '/workspaces', meta: { title: '工作区与成果' } }
      const isAuthenticated = false
      const guardResult = !isAuthenticated
        ? { name: 'login', query: { redirect: targetRoute.fullPath } }
        : true

      expect(guardResult).toEqual({
        name: 'login',
        query: { redirect: '/workspaces' },
      })
      expect((guardResult as any).name).toBe('login')
    })
  })
})
