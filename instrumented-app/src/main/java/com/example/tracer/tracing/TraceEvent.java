package com.example.tracer.tracing;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Getter
@Builder
public class TraceEvent {

    @Builder.Default
    private final String eventId = UUID.randomUUID().toString();

    private final String spanId;
    private final String parentSpanId;
    private final String requestId;
    private final long threadId;
    private final LocalDateTime timestamp;
    private final String method;
    private final Map<String, Object> params;
    private final Object returnValue;
    private final long executionTimeMs;
    private final String parentMethod;
    private final String sourceFile;
    private final int sourceLine;
    private final String status;
    private final String errorType;
    private final String errorMessage;
    private final String errorStackTrace;
    private final String threadName;
    private final long threadCpuTimeMs;
    private final String threadState;

    @Builder.Default
    private final String eventType = SqlTraceListener.EVENT_TYPE_METHOD;

    private final String sql;
    private final boolean slowQuery;

    /**
     * Returns a copy of this event with the given params and returnValue replaced.
     * Used by {@link SensitiveDataRedactor} to produce a redacted copy without
     * mutating the original.
     */
    public TraceEvent withRedacted(Map<String, Object> redactedParams, Object redactedReturn) {
        return TraceEvent.builder()
                .eventId(this.eventId)
                .spanId(this.spanId)
                .parentSpanId(this.parentSpanId)
                .requestId(this.requestId)
                .threadId(this.threadId)
                .timestamp(this.timestamp)
                .method(this.method)
                .params(redactedParams)
                .returnValue(redactedReturn)
                .executionTimeMs(this.executionTimeMs)
                .parentMethod(this.parentMethod)
                .sourceFile(this.sourceFile)
                .sourceLine(this.sourceLine)
                .status(this.status)
                .errorType(this.errorType)
                .errorMessage(this.errorMessage)
                .errorStackTrace(this.errorStackTrace)
                .threadName(this.threadName)
                .threadCpuTimeMs(this.threadCpuTimeMs)
                .threadState(this.threadState)
                .eventType(this.eventType)
                .sql(this.sql)
                .slowQuery(this.slowQuery)
                .build();
    }
}
