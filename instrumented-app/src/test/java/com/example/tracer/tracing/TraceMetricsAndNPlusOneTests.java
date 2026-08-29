package com.example.tracer.tracing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TraceMetricsAndNPlusOneTests {

    private InMemoryTraceCollector collector;

    @BeforeEach
    void setUp() {
        collector = new InMemoryTraceCollector(100, 3600, "all", 100, 200);
    }

    @Test
    void detectsNPlusOnePattern() {
        String requestId = "req-n1";
        String parentSpan = UUID.randomUUID().toString();

        addMethodEvent(requestId, "com.example.Service.load(..)", parentSpan, null);
        for (int i = 0; i < 6; i++) {
            addSqlEvent(requestId, "SELECT * FROM items WHERE id = ?", parentSpan);
        }

        TraceAnalysisReport report = collector.analyzeTrace(requestId);
        assertNotNull(report);
        assertFalse(report.getNPlusOneWarnings().isEmpty());
    }

    @Test
    void aggregatesMethodMetricsWithPercentiles() {
        String req1 = "req-a";
        String req2 = "req-b";

        addMethodEvent(req1, "com.example.Service.work(..)", null, null, 100);
        addMethodEvent(req2, "com.example.Service.work(..)", null, null, 200);
        addMethodEvent(req2, "com.example.Service.work(..)", null, null, 300);

        MetricsDashboardReport dashboard = collector.getMetricsDashboard();
        assertNotNull(dashboard);
        assertTrue(dashboard.getMethodMetrics().stream()
                .anyMatch(m -> m.getMethod().contains("Service.work")));
    }

    @Test
    void inboundDistributedTraceIdIsAccepted() {
        var inbound = new DistributedTraceContext.InboundTrace(
                "00000000-0000-0000-0000-000000000001",
                "abc123parentspan01"
        );
        assertEquals("00000000-0000-0000-0000-000000000001", inbound.traceId());
        assertNotNull(inbound.parentSpanId());
    }

    private void addMethodEvent(String requestId, String method, String spanId, String parentSpanId) {
        addMethodEvent(requestId, method, spanId, parentSpanId, 50);
    }

    private void addMethodEvent(String requestId, String method, String spanId, String parentSpanId, long ms) {
        collector.addEvent(TraceEvent.builder()
                .requestId(requestId).threadId(1L).timestamp(LocalDateTime.now())
                .method(method).params(Map.of()).returnValue("ok")
                .executionTimeMs(ms)
                .sourceFile("Service.java").sourceLine(10).status("SUCCESS")
                .threadName("main").threadCpuTimeMs(1L).threadState("RUNNABLE")
                .eventType(SqlTraceListener.EVENT_TYPE_METHOD)
                .spanId(spanId != null ? spanId : UUID.randomUUID().toString())
                .parentSpanId(parentSpanId)
                .build());
    }

    private void addSqlEvent(String requestId, String sql, String parentSpanId) {
        collector.addEvent(TraceEvent.builder()
                .requestId(requestId).threadId(1L).timestamp(LocalDateTime.now())
                .method("SQL: " + sql).params(new HashMap<>())
                .executionTimeMs(20L)
                .parentMethod("com.example.Service.load(..)")
                .sourceFile("jdbc").sourceLine(-1).status("SUCCESS")
                .threadName("main").threadState("RUNNABLE")
                .eventType(SqlTraceListener.EVENT_TYPE_SQL)
                .sql(sql)
                .spanId(UUID.randomUUID().toString())
                .parentSpanId(parentSpanId)
                .build());
    }
}
