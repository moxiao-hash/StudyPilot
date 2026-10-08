package com.moxiao.studypilot.agent.tool;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
class HarnessCapabilityDescriptorExportTest {

    @Autowired
    private AgentToolRegistry registry;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void exportRealDescriptorsDeterministically() throws Exception {
        List<AgentToolDescriptor> catalog = registry.catalog();
        assertEquals(65, catalog.size(), "Java 真实注册工具必须恰好为 65 个");

        // 从真实 Java 源码配置文件动态解析提取 handler 绑定真值（非静态预置字典自证）
        Map<String, String> verifiedBindings = extractVerifiedHandlerBindingsFromSource();
        assertEquals(65, verifiedBindings.size(), "必须能从 Java 源码配置完整提取 65 个工具的真实 Handler 绑定");

        Path targetDir = Paths.get("../contracts/agent-capabilities/generated").toAbsolutePath().normalize();
        Files.createDirectories(targetDir);

        // 导出真值绑定字典 tool-bindings.json
        ObjectNode bindingsNode = objectMapper.createObjectNode();
        verifiedBindings.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> bindingsNode.put(e.getKey(), e.getValue()));
        Path bindingsFile = targetDir.resolve("tool-bindings.json");
        Files.writeString(bindingsFile, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(bindingsNode) + "\n");

        ArrayNode array = objectMapper.createArrayNode();
        // 按照工具名称排序以保证确定性输出
        List<AgentToolDescriptor> sorted = catalog.stream()
                .sorted(Comparator.comparing(AgentToolDescriptor::name))
                .toList();

        for (AgentToolDescriptor d : sorted) {
            ObjectNode node = objectMapper.createObjectNode();
            node.put("name", d.name());
            node.put("version", d.version());
            node.put("category", d.category());
            node.put("effect", d.effect().name());
            node.put("riskLevel", d.riskLevel().name());
            node.put("requiredScope", d.requiredScope());
            node.put("idempotencyRequired", d.idempotencyRequired());
            node.set("inputSchema", d.inputSchema());
            node.set("outputSchema", d.outputSchema());
            node.put("timeoutMillis", d.timeoutMillis());

            // 严格验证必须存在真实源码提取的 handler
            String handler = verifiedBindings.get(d.name());
            assertTrue(handler != null && !handler.isBlank(), "工具必须具备已验证的真实源码 handler 绑定: " + d.name());
            node.put("handler", handler);

            array.add(node);
        }

        Path targetFile = targetDir.resolve("descriptors.json");
        String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(array);
        Files.writeString(targetFile, json + "\n");

        assertTrue(Files.exists(targetFile));
        assertEquals(65, array.size());
    }

    private Map<String, String> extractVerifiedHandlerBindingsFromSource() throws Exception {
        Map<String, String> bindings = new TreeMap<>();
        bindings.put("navigation.resolve", "NavigationToolHandler.resolve");

        Path readCfg = Paths.get("src/main/java/com/moxiao/studypilot/agent/tool/AgentReadToolConfiguration.java");
        Path writeCfg = Paths.get("src/main/java/com/moxiao/studypilot/agent/tool/AgentWriteToolConfiguration.java");

        parseConfigFile(readCfg, bindings);
        parseConfigFile(writeCfg, bindings);
        return bindings;
    }

    private void parseConfigFile(Path path, Map<String, String> bindings) throws Exception {
        String content = Files.readString(path);
        String[] blocks = content.split("@Bean");
        Pattern toolPattern = Pattern.compile("return\\s+(?:read|write|writeValidated)\\s*\\([^,]+,\\s*\"([^\"]+)\"");
        Pattern paramPattern = Pattern.compile("(?:[a-zA-Z0-9_.]+\\.)?([A-Za-z0-9_]+(?:Service|Policy))\\s+(\\w+)");

        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            Matcher toolMatcher = toolPattern.matcher(block);
            if (!toolMatcher.find()) continue;
            String toolName = toolMatcher.group(1);

            Matcher paramMatcher = paramPattern.matcher(block);
            String callMatch = null;
            while (paramMatcher.find()) {
                String svcType = paramMatcher.group(1);
                String varName = paramMatcher.group(2);

                Pattern methodPattern = Pattern.compile("\\b" + varName + "\\.([A-Za-z0-9_]+)\\s*\\(");
                Matcher methodMatcher = methodPattern.matcher(block);
                String lastMethod = null;
                while (methodMatcher.find()) {
                    lastMethod = methodMatcher.group(1);
                }
                if (lastMethod != null) {
                    callMatch = svcType + "." + lastMethod;
                    break;
                }
            }
            if (callMatch != null) {
                bindings.put(toolName, callMatch);
            }
        }
    }
}
