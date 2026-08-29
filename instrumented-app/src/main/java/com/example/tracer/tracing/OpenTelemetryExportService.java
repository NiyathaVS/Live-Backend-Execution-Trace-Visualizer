package com.example.tracer.tracing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Exports traces in OpenTelemetry-compatible JSON (trace + spans).
 * See https://opentelemetry.io/docs/specs/otel/trace/api/
 */
@Service
public class OpenTelemetryExportService {

    private final String serviceName;

    public OpenTelemetryExportService(
            @Value("${spring.application.name:instrumented-app}") String serviceName) {
        this.serviceName = serviceName;
    }

    public Map<String, Object> toOpenTelemetryJson(CallTreeNode root, String traceId) {
        if (root == null) {
            return Map.of("resourceSpans", List.of());
        }

        // traceStartMs is the epoch-millisecond baseline for the whole trace.
        // Each span's absolute start is computed from its own startTime field.
        long traceStartMs = root.getStartTime();
        List<Map<String, Object>> spans = new ArrayList<>();
        collectSpans(root, traceId, traceStartMs, spans);

        Map<String, Object> resource = Map.of(
                "attributes", List.of(
                        attribute("service.name", serviceName)
                )
        );

        Map<String, Object> scopeSpans = Map.of(
                "scope", Map.of("name", "live-trace-visualizer"),
                "spans", spans
        );

        Map<String, Object> resourceSpan = Map.of(
                "resource", resource,
                "scopeSpans", List.of(scopeSpans)
        );

        return Map.of("resourceSpans", List.of(resourceSpan));
    }

    private void collectSpans(CallTreeNode node, String traceId, long traceStartMs, List<Map<String, Object>> spans) {
        if (!"ROOT".equals(node.getMethodName()) && node.getSpanId() != null) {
            // Use the node's own startTime (epoch ms) converted to nanoseconds.
            // Fall back to traceStartMs when startTime is not set (legacy nodes).
            long nodeStartMs = node.getStartTime() > 0 ? node.getStartTime() : traceStartMs;
            long startNs = nodeStartMs * 1_000_000L;
            long endNs = startNs + node.getExecutionTime() * 1_000_000L;

            Map<String, Object> span = new LinkedHashMap<>();
            span.put("traceId", toOtlpTraceId(traceId));
            span.put("spanId", toOtlpSpanId(node.getSpanId()));
            if (node.getParentSpanId() != null) {
                span.put("parentSpanId", toOtlpSpanId(node.getParentSpanId()));
            }
            span.put("name", node.getMethodName());
            span.put("kind", 1); // SPAN_KIND_INTERNAL
            span.put("startTimeUnixNano", String.valueOf(startNs));
            span.put("endTimeUnixNano", String.valueOf(endNs));

            List<Map<String, Object>> attributes = new ArrayList<>();
            attributes.add(attribute("execution.time_ms", node.getExecutionTime()));
            if (node.getThreadName() != null) {
                attributes.add(attribute("thread.name", node.getThreadName()));
            }
            if (node.getEventType() != null) {
                attributes.add(attribute("trace.event_type", node.getEventType()));
            }
            if (node.getSql() != null) {
                attributes.add(attribute("db.statement", node.getSql()));
            }
            if (node.hasError()) {
                attributes.add(attribute("error", true));
                if (node.getErrorMessage() != null) {
                    attributes.add(attribute("exception.message", node.getErrorMessage()));
                }
            }
            span.put("attributes", attributes);

            if (node.hasError()) {
                span.put("status", Map.of("code", 2, "message", node.getErrorMessage() != null ? node.getErrorMessage() : "ERROR"));
            } else {
                span.put("status", Map.of("code", 1));
            }

            spans.add(span);
        }

        for (CallTreeNode child : node.getChildren()) {
            collectSpans(child, traceId, traceStartMs, spans);
        }
    }

    private static Map<String, Object> attribute(String key, Object value) {
        Map<String, Object> attr = new LinkedHashMap<>();
        attr.put("key", key);
        if (value instanceof Boolean b) {
            attr.put("value", Map.of("boolValue", b));
        } else if (value instanceof Number n) {
            attr.put("value", Map.of("intValue", n.longValue()));
        } else {
            attr.put("value", Map.of("stringValue", String.valueOf(value)));
        }
        return attr;
    }

    static String toOtlpTraceId(String traceId) {
        if (traceId == null) {
            return "0".repeat(32);
        }
        String hex = traceId.replace("-", "").replaceAll("[^0-9a-fA-F]", "").toLowerCase();
        if (hex.isEmpty()) {
            hex = Integer.toHexString(traceId.hashCode() & 0x7fffffff);
        }
        while (hex.length() < 32) {
            hex = hex + hex;
        }
        return hex.substring(0, 32);
    }

    static String toOtlpSpanId(String spanId) {
        if (spanId == null) {
            return "0".repeat(16);
        }
        String hex = spanId.replace("-", "").replaceAll("[^0-9a-fA-F]", "").toLowerCase();
        if (hex.isEmpty()) {
            hex = Integer.toHexString(spanId.hashCode() & 0x7fffffff);
        }
        while (hex.length() < 16) {
            hex = hex + hex;
        }
        return hex.substring(0, 16);
    }
}
