package com.example.tracer.tracing;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Records JDBC query execution as trace events attached to the current call stack.
 */
@Component
public class SqlTraceListener {

    public static final String EVENT_TYPE_SQL = "SQL";
    public static final String EVENT_TYPE_METHOD = "METHOD";

    private final InMemoryTraceCollector collector;
    private final TraceEventPublisher eventPublisher;
    private final long slowQueryThresholdMs;

    @Autowired(required = false)
    private TraceWebSocketHandler wsHandler;

    public SqlTraceListener(
            InMemoryTraceCollector collector,
            TraceEventPublisher eventPublisher,
            @Value("${trace.sql.slow-threshold-ms:500}") long slowQueryThresholdMs) {
        this.collector = collector;
        this.eventPublisher = eventPublisher;
        this.slowQueryThresholdMs = slowQueryThresholdMs;
    }

    public void recordSuccess(String sql, long startNanos) {
        publishSqlEvent(sql, toMillis(startNanos), "SUCCESS", null);
    }

    public void recordFailure(String sql, long startNanos, String errorMessage) {
        publishSqlEvent(sql, toMillis(startNanos), "ERROR", errorMessage);
    }

    private void publishSqlEvent(String sql, long durationMs, String status, String errorMessage) {
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        if (requestId == null) {
            return;
        }

        TraceContext parent = TraceStack.peek();
        String parentMethod = parent != null ? parent.getMethodName() : null;
        String parentSpanId = parent != null ? parent.getSpanId() : null;
        String sqlSpanId = java.util.UUID.randomUUID().toString();
        boolean slowQuery = durationMs >= slowQueryThresholdMs;

        Map<String, Object> params = new HashMap<>();
        params.put("sql", truncateSql(sql, 500));
        params.put("durationMs", durationMs);
        params.put("slowQuery", slowQuery);

        String displayName = "SQL: " + truncateSql(sql, 72);

        TraceEvent event = TraceEvent.builder()
                .requestId(requestId)
                .threadId(Thread.currentThread().getId())
                .timestamp(LocalDateTime.now())
                .method(displayName)
                .params(params)
                .executionTimeMs(durationMs)
                .parentMethod(parentMethod)
                .sourceFile("jdbc")
                .sourceLine(-1)
                .status(status)
                .errorType(slowQuery ? "SlowQuery" : null)
                .errorMessage(errorMessage)
                .threadName(Thread.currentThread().getName())
                .threadState(Thread.currentThread().getState().name())
                .eventType(EVENT_TYPE_SQL)
                .sql(sql)
                .slowQuery(slowQuery)
                .spanId(sqlSpanId)
                .parentSpanId(parentSpanId)
                .build();

        eventPublisher.publish(event);
        collector.addEvent(event);

        if (wsHandler != null) {
            wsHandler.broadcastEvent(event);
        }
    }

    private static long toMillis(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static String truncateSql(String sql, int maxLen) {
        if (sql == null) {
            return "";
        }
        String normalized = sql.replaceAll("\\s+", " ").trim();
        if (normalized.length() <= maxLen) {
            return normalized;
        }
        return normalized.substring(0, maxLen - 3) + "...";
    }

}
