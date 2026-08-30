package com.example.tracer.tracing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Evaluates configurable alert rules against in-memory traces.
 * Alerts can be individually acknowledged; acknowledged alerts are suppressed
 * until the underlying condition changes (requestId+rule combination resets
 * if the same trace fires the same rule again after the server restarts).
 */
@Service
public class TraceAlertService {

    private final InMemoryTraceCollector collector;
    private final long slowRequestThresholdMs;
    private final int maxErrorNodes;
    private final double errorRateThreshold;

    /** Set of acknowledged alert IDs ({requestId}::{rule}). */
    private final Set<String> acknowledged = ConcurrentHashMap.newKeySet();

    public TraceAlertService(
            InMemoryTraceCollector collector,
            @Value("${trace.alerts.slow-request-ms:1000}") long slowRequestThresholdMs,
            @Value("${trace.alerts.max-error-nodes:0}") int maxErrorNodes,
            @Value("${trace.alerts.error-rate-threshold:0.0}") double errorRateThreshold) {
        this.collector = collector;
        this.slowRequestThresholdMs = slowRequestThresholdMs;
        this.maxErrorNodes = maxErrorNodes;
        this.errorRateThreshold = errorRateThreshold;
    }

    /** Acknowledge an alert by its composite id ({requestId}::{rule}). Returns true if it existed. */
    public boolean acknowledge(String alertId) {
        return acknowledged.add(alertId);
    }

    public List<TraceAlert> evaluateAll() {
        List<TraceAlert> alerts = new ArrayList<>();
        for (String requestId : collector.listRequestIds()) {
            alerts.addAll(evaluate(requestId));
        }
        return alerts;
    }

    public List<TraceAlert> evaluate(String requestId) {
        List<TraceAlert> alerts = new ArrayList<>();
        CallTreeNode root = collector.getTrace(requestId);
        if (root == null) {
            return alerts;
        }

        AlertCounter counter = new AlertCounter();
        collect(root, counter);

        long totalDuration = root.getChildren().stream().mapToLong(CallTreeNode::getExecutionTime).sum();

        if (totalDuration >= slowRequestThresholdMs) {
            addIfNotAcknowledged(alerts, requestId, "SLOW_REQUEST", "WARN",
                    "Request duration " + totalDuration + "ms exceeds threshold " + slowRequestThresholdMs + "ms");
        }

        if (counter.errorCount > maxErrorNodes) {
            addIfNotAcknowledged(alerts, requestId, "ERROR_NODES", "ERROR",
                    counter.errorCount + " error node(s) detected (threshold: " + maxErrorNodes + ")");
        }

        if (counter.nodeCount > 0 && errorRateThreshold > 0) {
            double rate = (double) counter.errorCount / counter.nodeCount;
            if (rate >= errorRateThreshold) {
                addIfNotAcknowledged(alerts, requestId, "HIGH_ERROR_RATE", "ERROR",
                        String.format("Error rate %.0f%% exceeds threshold %.0f%%",
                                rate * 100, errorRateThreshold * 100));
            }
        }

        if (counter.nPlusOnePatterns > 0) {
            addIfNotAcknowledged(alerts, requestId, "N_PLUS_ONE", "WARN",
                    "N+1 query pattern detected (" + counter.nPlusOnePatterns + " occurrence(s))");
        }

        return alerts;
    }

    private void addIfNotAcknowledged(List<TraceAlert> list,
                                      String requestId, String rule, String severity, String message) {
        String id = requestId + "::" + rule;
        if (!acknowledged.contains(id)) {
            list.add(new TraceAlert(id, requestId, rule, severity, message));
        }
    }

    private void collect(CallTreeNode node, AlertCounter counter) {
        if (!"ROOT".equals(node.getMethodName())) {
            counter.nodeCount++;
            if (node.hasError()) {
                counter.errorCount++;
            }
        }
        for (CallTreeNode child : node.getChildren()) {
            collect(child, counter);
        }
        if ("ROOT".equals(node.getMethodName())) {
            counter.nPlusOnePatterns = TraceRootCauseAnalyzer.detectNPlusOne(node).size();
        }
    }

    private static class AlertCounter {
        int nodeCount;
        int errorCount;
        int nPlusOnePatterns;
    }

    /**
     * @param id        composite id: {requestId}::{rule} — stable, deterministic
     * @param requestId the originating trace
     * @param rule      alert rule name (e.g. SLOW_REQUEST)
     * @param severity  WARN or ERROR
     * @param message   human-readable description
     */
    public record TraceAlert(String id, String requestId, String rule, String severity, String message) {
    }
}
