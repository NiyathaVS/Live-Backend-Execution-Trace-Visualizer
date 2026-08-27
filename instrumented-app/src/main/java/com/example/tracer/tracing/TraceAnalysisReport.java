package com.example.tracer.tracing;

import java.util.List;

public class TraceAnalysisReport {
    private final String requestId;
    private final long totalExecutionTimeMs;
    private final int nodeCount;
    private final int errorCount;
    private final int slowNodeCount;
    private final int resourceLeakSuspectCount;
    private final int contentionRiskCount;
    private final int logicGapCount;
    private final List<String> warnings;
    private final List<String> rootCauseHints;
    private final List<String> nPlusOneWarnings;
    private final List<String> anomalies;

    public TraceAnalysisReport(String requestId,
                              long totalExecutionTimeMs,
                              int nodeCount,
                              int errorCount,
                              int slowNodeCount,
                              int resourceLeakSuspectCount,
                              int contentionRiskCount,
                              int logicGapCount,
                              List<String> warnings) {
        this(requestId, totalExecutionTimeMs, nodeCount, errorCount, slowNodeCount,
                resourceLeakSuspectCount, contentionRiskCount, logicGapCount,
                warnings, List.of(), List.of(), List.of());
    }

    public TraceAnalysisReport(String requestId,
                              long totalExecutionTimeMs,
                              int nodeCount,
                              int errorCount,
                              int slowNodeCount,
                              int resourceLeakSuspectCount,
                              int contentionRiskCount,
                              int logicGapCount,
                              List<String> warnings,
                              List<String> rootCauseHints,
                              List<String> nPlusOneWarnings,
                              List<String> anomalies) {
        this.requestId = requestId;
        this.totalExecutionTimeMs = totalExecutionTimeMs;
        this.nodeCount = nodeCount;
        this.errorCount = errorCount;
        this.slowNodeCount = slowNodeCount;
        this.resourceLeakSuspectCount = resourceLeakSuspectCount;
        this.contentionRiskCount = contentionRiskCount;
        this.logicGapCount = logicGapCount;
        this.warnings = warnings;
        this.rootCauseHints = rootCauseHints;
        this.nPlusOneWarnings = nPlusOneWarnings;
        this.anomalies = anomalies;
    }

    public String getRequestId() { return requestId; }
    public long getTotalExecutionTimeMs() { return totalExecutionTimeMs; }
    public int getNodeCount() { return nodeCount; }
    public int getErrorCount() { return errorCount; }
    public int getSlowNodeCount() { return slowNodeCount; }
    public int getResourceLeakSuspectCount() { return resourceLeakSuspectCount; }
    public int getContentionRiskCount() { return contentionRiskCount; }
    public int getLogicGapCount() { return logicGapCount; }
    public List<String> getWarnings() { return warnings; }
    public List<String> getRootCauseHints() { return rootCauseHints; }
    public List<String> getNPlusOneWarnings() { return nPlusOneWarnings; }
    public List<String> getAnomalies() { return anomalies; }
}
