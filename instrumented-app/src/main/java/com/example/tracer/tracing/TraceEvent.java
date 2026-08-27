package com.example.tracer.tracing;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public class TraceEvent {

    private final String eventId;
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
    private final String eventType;
    private final String sql;
    private final boolean slowQuery;

    public TraceEvent(String requestId,
                      long threadId,
                      LocalDateTime timestamp,
                      String method,
                      Map<String, Object> params,
                      Object returnValue,
                      long executionTimeMs,
                      String parentMethod,
                      String sourceFile,
                      int sourceLine,
                      String status,
                      String errorType,
                      String errorMessage,
                      String errorStackTrace,
                      String threadName,
                      long threadCpuTimeMs,
                      String threadState) {
        this(requestId, threadId, timestamp, method, params, returnValue, executionTimeMs,
                parentMethod, sourceFile, sourceLine, status, errorType, errorMessage,
                errorStackTrace, threadName, threadCpuTimeMs, threadState,
                SqlTraceListener.EVENT_TYPE_METHOD, null, false, null, null);
    }

    public TraceEvent(String requestId,
                      long threadId,
                      LocalDateTime timestamp,
                      String method,
                      Map<String, Object> params,
                      Object returnValue,
                      long executionTimeMs,
                      String parentMethod,
                      String sourceFile,
                      int sourceLine,
                      String status,
                      String errorType,
                      String errorMessage,
                      String errorStackTrace,
                      String threadName,
                      long threadCpuTimeMs,
                      String threadState,
                      String eventType,
                      String sql,
                      boolean slowQuery) {
        this(requestId, threadId, timestamp, method, params, returnValue, executionTimeMs,
                parentMethod, sourceFile, sourceLine, status, errorType, errorMessage,
                errorStackTrace, threadName, threadCpuTimeMs, threadState,
                eventType, sql, slowQuery, null, null);
    }

    public TraceEvent(String requestId,
                      long threadId,
                      LocalDateTime timestamp,
                      String method,
                      Map<String, Object> params,
                      Object returnValue,
                      long executionTimeMs,
                      String parentMethod,
                      String sourceFile,
                      int sourceLine,
                      String status,
                      String errorType,
                      String errorMessage,
                      String errorStackTrace,
                      String threadName,
                      long threadCpuTimeMs,
                      String threadState,
                      String eventType,
                      String sql,
                      boolean slowQuery,
                      String spanId,
                      String parentSpanId) {

        this.spanId = spanId != null ? spanId : UUID.randomUUID().toString();
        this.parentSpanId = parentSpanId;
        this.eventId = UUID.randomUUID().toString();
        this.requestId = requestId;
        this.threadId = threadId;
        this.timestamp = timestamp;
        this.method = method;
        this.params = params;
        this.returnValue = returnValue;
        this.executionTimeMs = executionTimeMs;
        this.parentMethod = parentMethod;
        this.sourceFile = sourceFile;
        this.sourceLine = sourceLine;
        this.status = status;
        this.errorType = errorType;
        this.errorMessage = errorMessage;
        this.errorStackTrace = errorStackTrace;
        this.threadName = threadName;
        this.threadCpuTimeMs = threadCpuTimeMs;
        this.threadState = threadState;
        this.eventType = eventType != null ? eventType : SqlTraceListener.EVENT_TYPE_METHOD;
        this.sql = sql;
        this.slowQuery = slowQuery;
    }

    public String getEventId() { return eventId; }
    public String getSpanId() { return spanId; }
    public String getParentSpanId() { return parentSpanId; }
    public String getRequestId() { return requestId; }
    public long getThreadId() { return threadId; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public String getMethod() { return method; }
    public Map<String, Object> getParams() { return params; }
    public Object getReturnValue() { return returnValue; }
    public long getExecutionTimeMs() { return executionTimeMs; }
    public String getParentMethod() { return parentMethod; }
    public String getSourceFile() { return sourceFile; }
    public int getSourceLine() { return sourceLine; }
    public String getStatus() { return status; }
    public String getErrorType() { return errorType; }
    public String getErrorMessage() { return errorMessage; }
    public String getErrorStackTrace() { return errorStackTrace; }
    public String getThreadName() { return threadName; }
    public long getThreadCpuTimeMs() { return threadCpuTimeMs; }
    public String getThreadState() { return threadState; }
    public String getEventType() { return eventType; }
    public String getSql() { return sql; }
    public boolean isSlowQuery() { return slowQuery; }
}
