package com.example.tracer.tracing;

public class MethodAggregateMetrics {

    private final String method;
    private final long count;
    private final long errorCount;
    private final double errorRate;
    private final double avgMs;
    private final long p50Ms;
    private final long p95Ms;
    private final long p99Ms;
    private final double varianceMs;

    public MethodAggregateMetrics(String method,
                                  long count,
                                  long errorCount,
                                  double errorRate,
                                  double avgMs,
                                  long p50Ms,
                                  long p95Ms,
                                  long p99Ms,
                                  double varianceMs) {
        this.method = method;
        this.count = count;
        this.errorCount = errorCount;
        this.errorRate = errorRate;
        this.avgMs = avgMs;
        this.p50Ms = p50Ms;
        this.p95Ms = p95Ms;
        this.p99Ms = p99Ms;
        this.varianceMs = varianceMs;
    }

    public String getMethod() { return method; }
    public long getCount() { return count; }
    public long getErrorCount() { return errorCount; }
    public double getErrorRate() { return errorRate; }
    public double getAvgMs() { return avgMs; }
    public long getP50Ms() { return p50Ms; }
    public long getP95Ms() { return p95Ms; }
    public long getP99Ms() { return p99Ms; }
    public double getVarianceMs() { return varianceMs; }
}
