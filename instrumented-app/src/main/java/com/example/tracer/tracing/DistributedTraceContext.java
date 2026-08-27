package com.example.tracer.tracing;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Optional;
import java.util.UUID;

/**
 * Parses inbound distributed trace headers (W3C traceparent and X-Trace-Id).
 */
public final class DistributedTraceContext {

    public static final String HEADER_TRACE_ID = "X-Trace-Id";
    public static final String HEADER_TRACE_PARENT = "traceparent";

    private DistributedTraceContext() {
    }

    public static Optional<InboundTrace> fromRequest(HttpServletRequest request) {
        String traceId = request.getHeader(HEADER_TRACE_ID);
        String parentSpanId = null;

        String traceparent = request.getHeader(HEADER_TRACE_PARENT);
        if (traceparent != null && !traceparent.isBlank()) {
            String[] parts = traceparent.split("-");
            if (parts.length >= 3) {
                if (traceId == null || traceId.isBlank()) {
                    traceId = parts[1];
                }
                parentSpanId = parts[2];
            }
        }

        if (traceId == null || traceId.isBlank()) {
            return Optional.empty();
        }

        return Optional.of(new InboundTrace(traceId, parentSpanId));
    }

    public static String normalizeTraceId(String raw) {
        if (raw == null || raw.isBlank()) {
            return UUID.randomUUID().toString();
        }
        String cleaned = raw.replace("-", "");
        if (cleaned.length() >= 32) {
            return cleaned.substring(0, 8) + "-"
                    + cleaned.substring(8, 12) + "-"
                    + cleaned.substring(12, 16) + "-"
                    + cleaned.substring(16, 20) + "-"
                    + cleaned.substring(20, 32);
        }
        return raw;
    }

    public record InboundTrace(String traceId, String parentSpanId) {
    }
}
