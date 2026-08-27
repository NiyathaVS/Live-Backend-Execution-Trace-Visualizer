package com.example.tracer.tracing;

import java.util.UUID;

public class TraceContext {

    private final String methodName;
    private final long startTime;
    private final String spanId;
    private final String parentSpanId;

    public TraceContext(String methodName, long startTime) {
        this.methodName = methodName;
        this.startTime = startTime;
        this.spanId = UUID.randomUUID().toString();
        this.parentSpanId = null;
    }

    public TraceContext(String methodName, long startTime, String parentSpanId) {
        this.methodName = methodName;
        this.startTime = startTime;
        this.spanId = UUID.randomUUID().toString();
        this.parentSpanId = parentSpanId;
    }

    public String getMethodName() {
        return methodName;
    }

    public long getStartTime() {
        return startTime;
    }

    public String getSpanId() {
        return spanId;
    }

    public String getParentSpanId() {
        return parentSpanId;
    }
}
