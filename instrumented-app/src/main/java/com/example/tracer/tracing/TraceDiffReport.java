package com.example.tracer.tracing;

import java.util.List;

public class TraceDiffReport {
    private final String baseRequestId;
    private final String compareRequestId;
    private final List<String> addedMethods;
    private final List<String> removedMethods;
    private final List<MethodTimingDelta> timingDeltas;

    public TraceDiffReport(String baseRequestId,
                           String compareRequestId,
                           List<String> addedMethods,
                           List<String> removedMethods,
                           List<MethodTimingDelta> timingDeltas) {
        this.baseRequestId = baseRequestId;
        this.compareRequestId = compareRequestId;
        this.addedMethods = addedMethods;
        this.removedMethods = removedMethods;
        this.timingDeltas = timingDeltas;
    }

    public String getBaseRequestId() {
        return baseRequestId;
    }

    public String getCompareRequestId() {
        return compareRequestId;
    }

    public List<String> getAddedMethods() {
        return addedMethods;
    }

    public List<String> getRemovedMethods() {
        return removedMethods;
    }

    public List<MethodTimingDelta> getTimingDeltas() {
        return timingDeltas;
    }
}

