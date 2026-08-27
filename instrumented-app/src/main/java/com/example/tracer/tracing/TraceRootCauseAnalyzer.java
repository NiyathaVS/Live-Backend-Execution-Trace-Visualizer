package com.example.tracer.tracing;

import java.util.ArrayList;
import java.util.List;

/**
 * Heuristic root-cause analysis over a completed call tree.
 */
public final class TraceRootCauseAnalyzer {

    private TraceRootCauseAnalyzer() {
    }

    public static List<String> analyze(CallTreeNode root) {
        if (root == null) {
            return List.of();
        }

        List<String> causes = new ArrayList<>();

        CallTreeNode slowest = findSlowestNode(root, null);
        if (slowest != null && slowest.getExecutionTime() >= 250) {
            causes.add("Primary latency hotspot: " + slowest.getMethodName()
                    + " (" + slowest.getExecutionTime() + "ms)");
        }

        List<CallTreeNode> errors = new ArrayList<>();
        collectErrors(root, errors);
        if (!errors.isEmpty()) {
            CallTreeNode first = errors.get(0);
            causes.add("Failure origin: " + first.getMethodName()
                    + (first.getErrorMessage() != null ? " — " + first.getErrorMessage() : ""));
        }

        List<String> nPlusOne = detectNPlusOne(root);
        if (!nPlusOne.isEmpty()) {
            causes.addAll(nPlusOne.stream().limit(3).toList());
        }

        List<CallTreeNode> slowSql = new ArrayList<>();
        collectSlowSql(root, slowSql);
        if (!slowSql.isEmpty()) {
            causes.add("Database bottleneck: " + slowSql.size() + " slow SQL span(s); "
                    + "review query plans and indexes");
        }

        if (causes.isEmpty()) {
            causes.add("No dominant root cause identified; inspect critical path nodes");
        }

        return causes;
    }

    public static List<String> detectAnomalies(List<Long> durationsMs, long currentMs) {
        if (durationsMs == null || durationsMs.size() < 3) {
            return List.of();
        }
        double mean = durationsMs.stream().mapToLong(Long::longValue).average().orElse(0);
        double variance = durationsMs.stream()
                .mapToDouble(v -> Math.pow(v - mean, 2))
                .average()
                .orElse(0);
        double stdDev = Math.sqrt(variance);
        if (stdDev < 1) {
            return List.of();
        }
        double z = (currentMs - mean) / stdDev;
        if (z >= 2.0) {
            return List.of(String.format(
                    "Latency anomaly: %.0fms is %.1fσ above rolling mean (%.0fms)",
                    (double) currentMs, z, mean));
        }
        return List.of();
    }

    private static CallTreeNode findSlowestNode(CallTreeNode node, CallTreeNode best) {
        if (!"ROOT".equals(node.getMethodName()) && node.getExecutionTime() > 0) {
            if (best == null || node.getExecutionTime() > best.getExecutionTime()) {
                best = node;
            }
        }
        for (CallTreeNode child : node.getChildren()) {
            best = findSlowestNode(child, best);
        }
        return best;
    }

    private static void collectErrors(CallTreeNode node, List<CallTreeNode> out) {
        if (node.hasError()) {
            out.add(node);
        }
        for (CallTreeNode child : node.getChildren()) {
            collectErrors(child, out);
        }
    }

    private static void collectSlowSql(CallTreeNode node, List<CallTreeNode> out) {
        if (SqlTraceListener.EVENT_TYPE_SQL.equals(node.getEventType())
                && (node.isSlowQuery() || node.isSlowPath())) {
            out.add(node);
        }
        for (CallTreeNode child : node.getChildren()) {
            collectSlowSql(child, out);
        }
    }

    public static List<String> detectNPlusOne(CallTreeNode root) {
        List<String> warnings = new ArrayList<>();
        scanForRepeatedSql(root, warnings);
        return warnings;
    }

    private static void scanForRepeatedSql(CallTreeNode node, List<String> warnings) {
        if (node.getChildren().isEmpty()) {
            return;
        }

        java.util.Map<String, Integer> sqlCounts = new java.util.HashMap<>();
        for (CallTreeNode child : node.getChildren()) {
            if (SqlTraceListener.EVENT_TYPE_SQL.equals(child.getEventType()) && child.getSql() != null) {
                String normalized = normalizeSql(child.getSql());
                sqlCounts.merge(normalized, 1, Integer::sum);
            }
        }

        for (var entry : sqlCounts.entrySet()) {
            if (entry.getValue() >= 5) {
                warnings.add("N+1 pattern: " + entry.getValue()
                        + " similar queries under " + node.getMethodName()
                        + " — " + truncate(entry.getKey(), 80));
            }
        }

        for (CallTreeNode child : node.getChildren()) {
            scanForRepeatedSql(child, warnings);
        }
    }

    private static String normalizeSql(String sql) {
        return sql.replaceAll("\\s+", " ")
                .replaceAll("\\?", "?")
                .replaceAll("'[^']*'", "'?'")
                .replaceAll("\\d+", "N")
                .trim()
                .toLowerCase();
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 3) + "...";
    }
}
