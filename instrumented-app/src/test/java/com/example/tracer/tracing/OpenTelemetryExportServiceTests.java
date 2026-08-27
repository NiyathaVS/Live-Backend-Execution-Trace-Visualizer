package com.example.tracer.tracing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class OpenTelemetryExportServiceTests {

    private OpenTelemetryExportService service;

    @BeforeEach
    void setUp() {
        service = new OpenTelemetryExportService("test-service");
    }

    @Test
    void exportsResourceSpansStructure() {
        CallTreeNode root = new CallTreeNode("ROOT", 1_700_000_000_000L);
        CallTreeNode child = new CallTreeNode("UserService.getUser", 1_700_000_000_010L);
        child.setSpanId("abc-def-123");
        child.setExecutionTime(42);
        root.addChild(child);

        var json = service.toOpenTelemetryJson(root, "trace-123");

        assertTrue(json.containsKey("resourceSpans"));
        var resourceSpans = (java.util.List<?>) json.get("resourceSpans");
        assertFalse(resourceSpans.isEmpty());
    }

    @Test
    void normalizesTraceAndSpanIds() {
        assertEquals(32, OpenTelemetryExportService.toOtlpTraceId("abc").length());
        assertEquals(16, OpenTelemetryExportService.toOtlpSpanId("span").length());
    }
}
