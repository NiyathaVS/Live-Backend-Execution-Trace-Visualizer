package com.example.tracer.tracing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Evaluates configurable alert rules against in-memory traces.
 */
@Service
public class TraceAlertService {

    private final InMemoryTraceCollector collector;
    private final long slowRequestThresholdMs;
    private final int maxErrorNodes;
    private final double errorRateThreshold;

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
            alerts.add(new TraceAlert(
                    requestId,
                    "SLOW_REQUEST",
                    "WARN",
                    "Request duration " + totalDuration + "ms exceeds threshold " + slowRequestThresholdMs + "ms"
            ));
        }

        if (counter.errorCount > maxErrorNodes) {
            alerts.add(new TraceAlert(
                    requestId,
                    "ERROR_NODES",
                    "ERROR",
                    counter.errorCount + " error node(s) detected (threshold: " + maxErrorNodes + ")"
            ));
        }

        if (counter.nodeCount > 0 && errorRateThreshold > 0) {
            double rate = (double) counter.errorCount / counter.nodeCount;
            if (rate >= errorRateThreshold) {
                alerts.add(new TraceAlert(
                        requestId,
                        "HIGH_ERROR_RATE",
                        "ERROR",
                        String.format("Error rate %.0f%% exceeds threshold %.0f%%",
                                rate * 100, errorRateThreshold * 100)
                ));
            }
        }

        if (counter.nPlusOnePatterns > 0) {
            alerts.add(new TraceAlert(
                    requestId,
                    "N_PLUS_ONE",
                    "WARN",
                    "N+1 query pattern detected (" + counter.nPlusOnePatterns + " occurrence(s))"
            ));
        }

        return alerts;
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

    public record TraceAlert(String requestId, String rule, String severity, String message) {
    }
}
