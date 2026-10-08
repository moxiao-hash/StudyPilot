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
            array.add(node);
        }

        // 导出到工作树目标路径
        Path targetDir = Paths.get("../contracts/agent-capabilities/generated").toAbsolutePath().normalize();
        Files.createDirectories(targetDir);
        Path targetFile = targetDir.resolve("descriptors.json");

        String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(array);
        Files.writeString(targetFile, json + "\n");

        assertTrue(Files.exists(targetFile));
        assertEquals(65, array.size());
    }
}
