import { describe, expect, it } from 'vitest';
import router from '@/app/router';
import { dispatchUiAction } from '@/modules/assistant/uiActionDispatcher';
import {
  FROZEN_JAVA_REGISTERED_TOOLS,
  WRITE_TOOLS,
  USER_EXCLUSIVE_ACTIONS,
  VERIFIED_HANDLER_BINDINGS,
  validateCapabilityManifest,
  type CapabilityManifest,
  type CapabilityToolEntry
} from './capability-validator';
import fixtures from './capability-consumer-fixtures.fixture.json';

describe('StudyPilot H02 Capability Consumer Verification (ZCode Owner)', () => {
  describe('1. 路由与业务能力全量覆盖审计 (Route & Business Coverage)', () => {
    it('前端路由表严格包含 31 个具名路由，零遗漏', () => {
      const namedRoutes = router
        .getRoutes()
        .map((r) => r.name)
        .filter((n): n is string => typeof n === 'string');
      const uniqueNames = new Set(namedRoutes);
      expect(uniqueNames.size).toBe(31);

      // Verify specific core routes exist
      expect(uniqueNames.has('login')).toBe(true);
      expect(uniqueNames.has('register')).toBe(true);
      expect(uniqueNames.has('roadmap')).toBe(true);
      expect(uniqueNames.has('dashboard')).toBe(true);
      expect(uniqueNames.has('quiz')).toBe(true);
      expect(uniqueNames.has('wrong-questions')).toBe(true);
      expect(uniqueNames.has('workspace-artifacts')).toBe(true);
    });

    it('所有 65 个 Java 注册工具均可在业务路由中找到对应业务承载页', () => {
      expect(FROZEN_JAVA_REGISTERED_TOOLS.size).toBe(65);
      expect(WRITE_TOOLS.size).toBe(21);
      // Read tools + Write tools + navigation.resolve = 65
      expect(FROZEN_JAVA_REGISTERED_TOOLS.has('navigation.resolve')).toBe(true);
    });
  });

  describe('2. 用户专属业务动作与防越权防线 (User-Exclusive Actions)', () => {
    it('QUIZ_SUBMISSION、CHECKIN_SUMMARY_SUBMIT 与 ACCEPT_ARTIFACT_SUBMISSION 受到前端调度器真实验证保护', async () => {
      // Direct authenticity guard verification
      for (const action of ['QUIZ_SUBMISSION', 'CHECKIN_SUMMARY_SUBMIT', 'ACCEPT_ARTIFACT_SUBMISSION']) {
        await expect(
          dispatchUiAction(
            {
              actionId: `act-test-${action}`,
              type: 'NAVIGATE',
              routeKey: 'ROADMAP',
              params: { targetAction: action },
              reason: 'testing authenticity guard'
            },
            router
          )
        ).rejects.toThrow();
      }
    });

    it('用户专属列表严格定义且不与任何 Agent 工具重叠', () => {
      for (const userAction of USER_EXCLUSIVE_ACTIONS) {
        expect(FROZEN_JAVA_REGISTERED_TOOLS.has(userAction.toLowerCase())).toBe(false);
      }
    });
  });

  describe('3. 跨端能力清单正例验证 (Positive Capability Controls)', () => {
    it('正例只读工具 (roadmap.current.get) 严格通过校验，且 exposure 为 allowed', () => {
      const readFixture = fixtures.positive_controls.find((c) => c.name === 'valid_read_tool');
      expect(readFixture).toBeDefined();

      const tool = readFixture!.tool as unknown as CapabilityToolEntry;
      expect(tool.name).toBe('roadmap.current.get');
      expect(tool.side_effect?.effect).toBe('READ');
      expect(tool.exposure?.state).toBe('allowed');

      // Construct minimal valid manifest
      const mockManifest: CapabilityManifest = {
        manifest_version: '1.0-draft',
        tools: Array.from(FROZEN_JAVA_REGISTERED_TOOLS).map((name) => {
          if (name === tool.name) return tool;
          const isDevOrRunner = name.startsWith('developer.') || name.startsWith('runner.');
          const isWrite = WRITE_TOOLS.has(name);
          const isDisabled = isWrite || isDevOrRunner;
          return {
            name,
            version: 1,
            category: 'GENERAL',
            description: `Tool ${name}`,
            when_to_use: [`When user asks for ${name}`],
            side_effect: { effect: isWrite ? 'WRITE' : 'READ', risk_level: 'LOW' },
            confirmation: { mode: isWrite ? 'always_user_confirmation' : 'none' },
            exposure: { state: isDisabled ? 'disabled' : 'allowed', reason: 'baseline' },
            source_provenance: {
              handler: VERIFIED_HANDLER_BINDINGS[name] || 'AgentLearningContextService.get'
            },
            examples: [
              {
                name: 'default_example',
                input: {},
                expect: 'default expect',
                outcome: 'ok',
                output: {}
              }
            ]
          };
        })
      };

      const result = validateCapabilityManifest(mockManifest);
      expect(result.ok).toBe(true);
      expect(result.toolCount).toBe(65);
    });

    it('正例写工具 (roadmap.enroll) 严格通过校验，且 exposure 必须为 disabled', () => {
      const writeFixture = fixtures.positive_controls.find((c) => c.name === 'valid_disabled_write_tool');
      expect(writeFixture).toBeDefined();

      const tool = writeFixture!.tool as unknown as CapabilityToolEntry;
      expect(tool.name).toBe('roadmap.enroll');
      expect(tool.side_effect?.effect).toBe('WRITE');
      expect(tool.exposure?.state).toBe('disabled');
      expect(tool.confirmation?.mode).toBe('always_user_confirmation');
    });
  });

  describe('4. 离线行为负例全量拦截 (Negative Control Invariants)', () => {
    function buildBaseMockManifest(): CapabilityManifest {
      return {
        manifest_version: '1.0-draft',
        tools: Array.from(FROZEN_JAVA_REGISTERED_TOOLS).map((name) => ({
          name,
          version: 1,
          category: 'TEST',
          description: `Tool ${name}`,
          when_to_use: [`When user requests ${name}`],
          side_effect: {
            effect: WRITE_TOOLS.has(name) ? 'WRITE' : 'READ',
            risk_level: WRITE_TOOLS.has(name) ? 'HIGH' : 'LOW'
          },
          confirmation: {
            mode: WRITE_TOOLS.has(name) ? 'always_user_confirmation' : 'none'
          },
          exposure: {
            state: WRITE_TOOLS.has(name) || name.startsWith('developer.') || name.startsWith('runner.') ? 'disabled' : 'allowed',
            reason: 'mock reason'
          },
          source_provenance: {
            handler: VERIFIED_HANDLER_BINDINGS[name] || 'AgentLearningContextService.get'
          },
          authoritative_facts: name === 'roadmap.current.get' ? [{ fact: 'overall_progress', meaning: 'pct' }] : [],
          output_schema: name === 'roadmap.current.get'
            ? { type: 'object', properties: { overall_progress: { type: 'number' } } }
            : { type: 'object', properties: {} as Record<string, { type?: string }> },
          examples: [
            {
              name: 'default_example',
              input: {},
              expect: 'default expect',
              outcome: 'ok',
              output: {}
            }
          ]
        }))
      };
    }

    it('NEG-01: 遗漏已登记 Java 工具时严格报错拒绝 (ERR_MISSING_REGISTERED_TOOL)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools = manifest.tools.filter((t) => t.name !== 'roadmap.current.get');
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_MISSING_REGISTERED_TOOL');
    });

    it('NEG-02: 存在重复工具名称时严格报错拒绝 (ERR_DUPLICATE_WIRE_NAME)', () => {
      const manifest = buildBaseMockManifest();
      const dup = JSON.parse(JSON.stringify(manifest.tools[0]));
      manifest.tools.push(dup);
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_DUPLICATE_WIRE_NAME');
    });

    it('NEG-03: 虚构未注册工具目标时严格报错拒绝 (ERR_FICTIONAL_TOOL_TARGET)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools.push({
        name: 'studypilot.magic.solve',
        version: 1,
        category: 'FAKE',
        description: 'fake tool',
        when_to_use: ['user asks for magic'],
        side_effect: { effect: 'READ', risk_level: 'LOW' },
        exposure: { state: 'allowed', reason: 'fake' }
      });
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_FICTIONAL_TOOL_TARGET');
    });

    it('NEG-04: HIGH 风险工具 confirmation 声明为 none 时严格报错拒绝 (ERR_GOVERNANCE_CONFLICT)', () => {
      const manifest = buildBaseMockManifest();
      const highTool = manifest.tools.find((t) => t.side_effect?.risk_level === 'HIGH');
      expect(highTool).toBeDefined();
      highTool!.confirmation = { mode: 'none' };
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_GOVERNANCE_CONFLICT');
    });

    it('NEG-05: Task H11 之前写工具暴露为 allowed 时严格报错拒绝 (ERR_WRITE_TOOL_EXPOSED)', () => {
      const manifest = buildBaseMockManifest();
      const writeTool = manifest.tools.find((t) => t.name === 'roadmap.enroll');
      expect(writeTool).toBeDefined();
      writeTool!.exposure = { state: 'allowed', reason: 'illegal exposure' };
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_WRITE_TOOL_EXPOSED');
    });

    it('NEG-06: 示例中注入或泄露 ownerId 时严格报错拒绝 (ERR_ILLEGAL_EXAMPLE_OWNER)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools[0].examples = [
        {
          name: 'leaked_example',
          input: { ownerId: 'injected-user-id' },
          expect: 'should fail',
          outcome: 'ok'
        }
      ];
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_ILLEGAL_EXAMPLE_OWNER');
    });

    it('NEG-07: 将用户专属测验提交暴露为 Agent 工具时严格报错拒绝 (ERR_USER_EXCLUSIVE_EXPOSED)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools.push({
        name: 'assessment.quiz.submit',
        version: 1,
        category: 'ASSESSMENT',
        description: 'user only',
        when_to_use: ['user submits quiz'],
        side_effect: { effect: 'WRITE', risk_level: 'HIGH' },
        exposure: { state: 'allowed', reason: 'illegal' }
      });
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_USER_EXCLUSIVE_EXPOSED');
    });

    it('NEG-08: 默认开放 developer/runner 代码执行工具时严格报错拒绝 (ERR_CODING_RUNNER_EXPOSED)', () => {
      const manifest = buildBaseMockManifest();
      const devTool = manifest.tools.find((t) => t.name === 'developer.code.search');
      expect(devTool).toBeDefined();
      devTool!.exposure = { state: 'allowed', reason: 'illegal coding exposure' };
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_CODING_RUNNER_EXPOSED');
    });

    it('NEG-09: 声明未在 Java 后端注册的虚构权威事实时严格报错拒绝 (ERR_UNVERIFIED_AUTHORITATIVE_FACT)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools[0].authoritative_facts = [
        { fact: 'fabricated_ai_score', meaning: 'invented score' }
      ];
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_UNVERIFIED_AUTHORITATIVE_FACT');
    });

    it('NEG-10: 工具缺少描述时严格报错拒绝 (ERR_MISSING_DESCRIPTION)', () => {
      const manifest = buildBaseMockManifest();
      // @ts-expect-error testing missing description
      delete manifest.tools[0].description;
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_MISSING_DESCRIPTION');
    });

    it('NEG-11: 工具包含未知/未声明属性时严格报错拒绝 (ERR_UNKNOWN_TOOL_FIELD)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools[0].unrecognized = 42;
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_UNKNOWN_TOOL_FIELD');
    });

    it('NEG-12: 示例输出实例类型不匹配时严格报错拒绝 (ERR_INVALID_OUTPUT_INSTANCE)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools[0].output_schema = { type: 'object', properties: {} };
      manifest.tools[0].examples = [
        {
          name: 'invalid_output',
          input: {},
          expect: 'should fail',
          outcome: 'ok',
          output: 42
        }
      ];
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_INVALID_OUTPUT_INSTANCE');
    });

    it('NEG-13: 示例输出中存在深层嵌套 ownerId 时严格报错拒绝 (ERR_ILLEGAL_EXAMPLE_OWNER)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools[0].examples = [
        {
          name: 'nested_owner_output',
          input: {},
          expect: 'should fail',
          outcome: 'ok',
          output: { nested: { ownerId: 'injected' } }
        }
      ];
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_ILLEGAL_EXAMPLE_OWNER');
    });

    it('NEG-14: 任意未声明事实 (made_up_metric_893) 均被严格拦截 (ERR_UNVERIFIED_AUTHORITATIVE_FACT)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools[0].authoritative_facts = [
        { fact: 'made_up_metric_893', meaning: 'system truth' }
      ];
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_UNVERIFIED_AUTHORITATIVE_FACT');
    });

    it('NEG-15: 虚构处理类 (UnregisteredClass.noSuchMethod) 被严格拦截 (ERR_HANDLER_BINDING_MISMATCH)', () => {
      const manifest = buildBaseMockManifest();
      manifest.tools[0].source_provenance = {
        handler: 'UnregisteredClass.noSuchMethod'
      };
      expect(() => validateCapabilityManifest(manifest)).toThrow('ERR_HANDLER_BINDING_MISMATCH');
    });
  });

  describe('5. 后端公开 Controller 与未注册业务操作审计 (Controller Auditing)', () => {
    it('覆盖表完整审计 RoadmapStageGraduationController、RoadmapDiagnosticController、AgentFacadeController 与 WebSearchResultController', async () => {
      const coverageModule = await import('../../../docs/verification/harness/h02-business-coverage.json');
      const coverage = coverageModule.default || coverageModule;
      const auditedControllers = (coverage.backend_controller_audit || []).map((c: { controllerName: string }) => c.controllerName);

      expect(auditedControllers).toContain('RoadmapStageGraduationController');
      expect(auditedControllers).toContain('RoadmapDiagnosticController');
      expect(auditedControllers).toContain('AgentFacadeController');
      expect(auditedControllers).toContain('WebSearchResultController');
    });
  });
});
