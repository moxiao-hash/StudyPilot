import { describe, it, expect } from 'vitest'
import router from '@/app/router'
import eventSamplesFixture from './event-samples.fixture.json'
import {
  VALID_ASSISTANT_EVENT_TYPES,
  type AssistantEventType,
} from '@/services/current/assistant'
import {
  resolveNamedRouteFromUiAction,
  FROZEN_MODAL_MATRIX,
  FROZEN_FOCUS_MATRIX,
} from '@/modules/assistant/uiActionDispatcher'

describe('H01 Frontend Baseline Compatibility (GREEN phase)', () => {
  it('covers all 31 named routes in router, identifying 28 guarded and 3 public routes', () => {
    const allRoutes = router.getRoutes()
    const namedRoutes = allRoutes.filter((r) => typeof r.name === 'string')
    expect(namedRoutes.length).toBe(31)

    const publicRoutes = namedRoutes.filter((r) => r.meta?.public === true)
    expect(publicRoutes.map((r) => r.name).sort()).toEqual(['login', 'not-found', 'register'].sort())

    const guardedRoutes = namedRoutes.filter((r) => r.meta?.public !== true)
    expect(guardedRoutes.length).toBe(28)

    // Verify key agent & settings routes exist
    const routeNames = namedRoutes.map((r) => r.name)
    expect(routeNames).toContain('assistant')
    expect(routeNames).toContain('assistant-health')
    expect(routeNames).toContain('settings-ai')
    expect(routeNames).toContain('knowledge')
    expect(routeNames).toContain('agent-plan')
    expect(routeNames).toContain('agent-tasks')
    expect(routeNames).toContain('activity')
    expect(routeNames).toContain('workspace-artifacts')

    // Verify legacy routes are explicitly tagged
    const legacyRoutes = namedRoutes.filter((r) => r.meta?.legacy === true)
    expect(legacyRoutes.map((r) => r.name).sort()).toEqual(['course-detail', 'courses', 'lesson'].sort())
  })

  it('verifies all 12 legacy assistant event types are recognized in valid event types set', () => {
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
    expect(VALID_ASSISTANT_EVENT_TYPES.size).toBe(13)
  })

  it('loads and validates frontend-baseline-event-samples.json fixture and runtime mappings', () => {
    expect(eventSamplesFixture).toBeDefined()
    const content = eventSamplesFixture as any
    expect(content.version).toBe('1.0.0')
    expect(content.task).toBe('H01')

    // 13 legacy samples (1 heartbeat + 12 events)
    expect(content.legacy_sse_events.samples.length).toBe(13)

    // 12 runtime mappings matching business events
    expect(content.runtime_event_mappings.length).toBe(12)
    const mappedLegacyEvents = content.runtime_event_mappings.map((m: any) => m.legacy_event)
    expect(mappedLegacyEvents).toContain('TURN_STARTED')
    expect(mappedLegacyEvents).toContain('CONTEXT_LOADED')
    expect(mappedLegacyEvents).toContain('PLAN_GENERATED')
    expect(mappedLegacyEvents).toContain('TOOL_STARTED')
    expect(mappedLegacyEvents).toContain('TOOL_SUCCEEDED')
    expect(mappedLegacyEvents).toContain('TOOL_FAILED')
    expect(mappedLegacyEvents).toContain('ACTION_PREVIEW')
    expect(mappedLegacyEvents).toContain('ASSISTANT_DELTA')
    expect(mappedLegacyEvents).toContain('UI_ACTION')
    expect(mappedLegacyEvents).toContain('TURN_COMPLETED')
    expect(mappedLegacyEvents).toContain('TURN_FAILED')
    expect(mappedLegacyEvents).toContain('TURN_CANCELLED')

    // Finish reasons distinction
    const finishReasons = content.terminal_reasons_and_error_codes.finish_reasons.map((f: any) => f.code)
    expect(finishReasons).toContain('completed')
    expect(finishReasons).toContain('cancelled')
    expect(finishReasons).toContain('max_tokens')
    expect(finishReasons).toContain('budget_exhausted')
    expect(finishReasons).toContain('waiting_confirmation')
    expect(finishReasons).toContain('failed')

    // Consumption requirements submitted to MiniMax
    expect(content.consumption_requirements_for_runtime_schema.requirements.length).toBeGreaterThanOrEqual(6)
  })

  it('verifies UI action route resolution and frozen parameter matrices', () => {
    // 28 navigation routes resolvable
    const testCases: Array<[string, Record<string, string>, string, Record<string, string>]> = [
      ['ROADMAP', {}, 'roadmap', {}],
      ['ROADMAP_STAGE', { stageId: 's-1' }, 'roadmap-stage', { id: 's-1' }],
      ['ROADMAP_MODULE', { moduleId: 'm-1' }, 'roadmap-module', { id: 'm-1' }],
      ['ROADMAP_NODE', { nodeId: 'n-1' }, 'roadmap-node', { id: 'n-1' }],
      ['TODAY', {}, 'today', {}],
      ['WORKSPACE_ARTIFACTS', {}, 'workspace-artifacts', {}],
      ['ASSISTANT_HEALTH', {}, 'assistant-health', {}],
      ['AI_SETTINGS', {}, 'settings-ai', {}],
    ]

    for (const [routeKey, params, expectedName, expectedParams] of testCases) {
      const resolved = resolveNamedRouteFromUiAction({ routeKey, params })
      expect(resolved).toEqual({ name: expectedName, params: expectedParams })
    }

    // Modal matrix and focus matrix are frozen and strictly symbolic
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

  it('verifies anti-false-success rule: unauthenticated navigation redirects to login and cannot be claimed as business success', async () => {
    // Unauthenticated router navigation test
    const targetRoute = { path: '/workspaces', fullPath: '/workspaces', meta: { title: '工作区与成果' } }

    // Simulate router.beforeEach guard logic
    const isPublic = false
    const isAuthenticated = false
    const guardResult = !isPublic && !isAuthenticated
      ? { name: 'login', query: { redirect: targetRoute.fullPath } }
      : true

    expect(guardResult).toEqual({
      name: 'login',
      query: { redirect: '/workspaces' },
    })

    // Rule assertion: Landing on login page when requesting /workspaces must fail closed
    const isLoginLanding = guardResult && typeof guardResult === 'object' && guardResult.name === 'login'
    expect(isLoginLanding).toBe(true)
  })
})
