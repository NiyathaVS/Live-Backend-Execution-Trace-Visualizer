package com.example.tracer.tracing;

import java.util.List;

public class MetricsDashboardReport {

    private final int traceCount;
    private final long totalRequests;
    private final List<MethodAggregateMetrics> methodMetrics;
    private final List<String> anomalies;

    public MetricsDashboardReport(int traceCount,
                                  long totalRequests,
                                  List<MethodAggregateMetrics> methodMetrics,
                                  List<String> anomalies) {
        this.traceCount = traceCount;
        this.totalRequests = totalRequests;
        this.methodMetrics = methodMetrics;
        this.anomalies = anomalies;
    }

    public int getTraceCount() { return traceCount; }
    public long getTotalRequests() { return totalRequests; }
    public List<MethodAggregateMetrics> getMethodMetrics() { return methodMetrics; }
    public List<String> getAnomalies() { return anomalies; }
}
