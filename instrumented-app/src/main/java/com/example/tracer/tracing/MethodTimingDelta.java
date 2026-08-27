package com.example.tracer.tracing;

public class MethodTimingDelta {
    private final String method;
    private final long baseAvgMs;
    private final long compareAvgMs;
    private final long deltaMs;

    public MethodTimingDelta(String method, long baseAvgMs, long compareAvgMs) {
        this.method = method;
        this.baseAvgMs = baseAvgMs;
        this.compareAvgMs = compareAvgMs;
        this.deltaMs = compareAvgMs - baseAvgMs;
    }

    public String getMethod() {
        return method;
    }

    public long getBaseAvgMs() {
        return baseAvgMs;
    }

    public long getCompareAvgMs() {
        return compareAvgMs;
    }

    public long getDeltaMs() {
        return deltaMs;
    }
}

