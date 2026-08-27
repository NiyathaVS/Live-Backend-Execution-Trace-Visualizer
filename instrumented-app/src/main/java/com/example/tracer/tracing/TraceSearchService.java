package com.example.tracer.tracing;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class TraceSearchService {

    private final InMemoryTraceCollector collector;

    public TraceSearchService(InMemoryTraceCollector collector) {
        this.collector = collector;
    }

    public List<TraceSearchResult> search(TraceSearchCriteria criteria) {
        List<TraceSearchResult> results = new ArrayList<>();

        for (String requestId : collector.listRequestIds()) {
            CallTreeNode root = collector.getTrace(requestId);
            if (root == null) {
                continue;
            }

            TraceSummary summary = summarize(root);
            if (!matches(criteria, summary)) {
                continue;
            }

            results.add(new TraceSearchResult(
                    requestId,
                    summary.totalDurationMs(),
                    summary.nodeCount(),
                    summary.errorCount(),
                    summary.slowNodeCount(),
                    summary.methods()
            ));
        }

        results.sort(Comparator.comparingLong(TraceSearchResult::totalDurationMs).reversed());
        int limit = criteria.limit() != null && criteria.limit() > 0 ? criteria.limit() : 50;
        if (results.size() > limit) {
            return results.subList(0, limit);
        }
        return results;
    }

    private boolean matches(TraceSearchCriteria criteria, TraceSummary summary) {
        if (criteria.method() != null && !criteria.method().isBlank()) {
            String needle = criteria.method().toLowerCase();
            boolean found = summary.methods().stream()
                    .anyMatch(m -> m.toLowerCase().contains(needle));
            if (!found) {
                return false;
            }
        }
        if (criteria.minDurationMs() != null && summary.totalDurationMs() < criteria.minDurationMs()) {
            return false;
        }
        if (criteria.maxDurationMs() != null && summary.totalDurationMs() > criteria.maxDurationMs()) {
            return false;
        }
        if (criteria.hasError() != null) {
            boolean hasErr = summary.errorCount() > 0;
            if (criteria.hasError() != hasErr) {
                return false;
            }
        }
        return true;
    }

    private TraceSummary summarize(CallTreeNode root) {
        SummaryCounter counter = new SummaryCounter();
        collect(root, counter);
        long total = root.getChildren().stream().mapToLong(CallTreeNode::getExecutionTime).sum();
        return new TraceSummary(total, counter.nodeCount, counter.errorCount, counter.slowCount, counter.methods);
    }

    private void collect(CallTreeNode node, SummaryCounter counter) {
        if (!"ROOT".equals(node.getMethodName())) {
            counter.nodeCount++;
            counter.methods.add(node.getMethodName());
            if (node.hasError()) {
                counter.errorCount++;
            }
            if (node.isSlowPath()) {
                counter.slowCount++;
            }
        }
        for (CallTreeNode child : node.getChildren()) {
            collect(child, counter);
        }
    }

    private static class SummaryCounter {
        int nodeCount;
        int errorCount;
        int slowCount;
        final List<String> methods = new ArrayList<>();
    }

    public record TraceSearchCriteria(
            String method,
            Long minDurationMs,
            Long maxDurationMs,
            Boolean hasError,
            Integer limit) {
    }

    public record TraceSearchResult(
            String requestId,
            long totalDurationMs,
            int nodeCount,
            int errorCount,
            int slowNodeCount,
            List<String> methods) {
    }

    private record TraceSummary(
            long totalDurationMs,
            int nodeCount,
            int errorCount,
            int slowNodeCount,
            List<String> methods) {
    }
}
