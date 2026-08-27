package com.example.tracer.tracing;

import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Component
public class InMemoryTraceCollector {

    private static final long SLOW_THRESHOLD_MS = 250;
    private static final long SLOW_SQL_THRESHOLD_MS = 500;
    private static final int DEFAULT_MAX_TRACES = 1000;
    private static final long DEFAULT_TTL_SECONDS = 3600; // 1 hour
    
    private final int maxTraces;
    private final long ttlMillis;
    private final String samplingMode;
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    
    // LRU cache: LinkedHashMap with removeEldestEntry override for bounded size
    private final Map<String, CallTreeNode> traces;
    // Track creation time for each trace for TTL eviction
    private final Map<String, Long> traceCreationTimes = new ConcurrentHashMap<>();
    // Rolling durations per method for anomaly detection
    private final Map<String, List<Long>> methodDurationHistory = new ConcurrentHashMap<>();

    public InMemoryTraceCollector(int maxTraces, long ttlSeconds, String samplingMode) {
        this.maxTraces = maxTraces > 0 ? maxTraces : DEFAULT_MAX_TRACES;
        this.ttlMillis = (ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS) * 1000;
        this.samplingMode = samplingMode != null ? samplingMode : "all";
        this.traces = new LinkedHashMap<String, CallTreeNode>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, CallTreeNode> eldest) {
                return size() > InMemoryTraceCollector.this.maxTraces;
            }
        };
        
        // Start cleanup thread for TTL eviction (only if TTL is enabled)
        if (ttlSeconds > 0) {
            startTtlCleanupThread();
        }
    }
    
    /** Constructor for backward compatibility */
    public InMemoryTraceCollector(int maxTraces) {
        this(maxTraces, DEFAULT_TTL_SECONDS, "all");
    }

    /**
     * Determine if this trace should be sampled (stored).
     * Supports three modes:
     * - "all": Store all traces
     * - "slow": Store only slow traces (execution time > 500ms)
     * - percentage (e.g., "10"): Store 10% of traces randomly
     */
    private boolean shouldSample(long executionTimeMs) {
        if ("all".equalsIgnoreCase(samplingMode)) {
            return true;
        }
        if ("slow".equalsIgnoreCase(samplingMode)) {
            return executionTimeMs >= SLOW_SQL_THRESHOLD_MS;
        }
        try {
            int percentage = Integer.parseInt(samplingMode);
            return Math.random() * 100 < percentage;
        } catch (NumberFormatException e) {
            // Default to "all" if sampling config is invalid
            return true;
        }
    }

    /**
     * Clean up expired traces (older than TTL).
     * Runs periodically in a background thread.
     */
    private void startTtlCleanupThread() {
        Thread cleanupThread = new Thread(() -> {
            while (true) {
                try {
                    // Run cleanup every minute
                    Thread.sleep(60_000);
                    
                    lock.writeLock().lock();
                    try {
                        long now = System.currentTimeMillis();
                        List<String> expiredTraces = new ArrayList<>();
                        
                        for (Map.Entry<String, Long> entry : traceCreationTimes.entrySet()) {
                            if (now - entry.getValue() > ttlMillis) {
                                expiredTraces.add(entry.getKey());
                            }
                        }
                        
                        for (String traceId : expiredTraces) {
                            traces.remove(traceId);
                            traceCreationTimes.remove(traceId);
                        }
                    } finally {
                        lock.writeLock().unlock();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }, "TraceCollector-TTL-Cleanup");
        cleanupThread.setDaemon(true);
        cleanupThread.start();
    }

    public void addEvent(TraceEvent event) {
        // Check if this event should be sampled
        if (!shouldSample(event.getExecutionTimeMs())) {
            return; // Skip sampling this event
        }
        
        lock.writeLock().lock();
        try {
            // Get or create root node for this request
            CallTreeNode root = traces.computeIfAbsent(event.getRequestId(),
                    k -> {
                        traceCreationTimes.put(k, System.currentTimeMillis());
                        return new CallTreeNode("ROOT", System.currentTimeMillis());
                    });

            // Build child node
            CallTreeNode node = new CallTreeNode(event.getMethod(), System.currentTimeMillis());
            node.setSpanId(event.getSpanId());
            node.setParentSpanId(event.getParentSpanId());
            node.setExecutionTime(event.getExecutionTimeMs());
            node.setReturnValue(event.getReturnValue());
            node.setParams(event.getParams());
            node.setSourceFile(event.getSourceFile());
            node.setSourceLine(event.getSourceLine());
            node.setThreadName(event.getThreadName());
            node.setThreadCpuTimeMs(event.getThreadCpuTimeMs());
            node.setThreadState(event.getThreadState());
            node.setEventType(event.getEventType());
            node.setSql(event.getSql());
            node.setSlowQuery(event.isSlowQuery());

            // Heuristic risk flags
            String methodName = event.getMethod() != null ? event.getMethod().toLowerCase() : "";
            boolean isSqlEvent = SqlTraceListener.EVENT_TYPE_SQL.equals(event.getEventType());

            if (isSqlEvent) {
                if (event.isSlowQuery() || event.getExecutionTimeMs() >= SLOW_SQL_THRESHOLD_MS) {
                    node.setSlowPath(true);
                    node.setSlowQuery(true);
                    node.setLogicGapRisk(true);
                }
            } else if (event.getExecutionTimeMs() > SLOW_THRESHOLD_MS) {
                node.setSlowPath(true);
            }

            if (methodName.contains("open") || methodName.contains("connect") || methodName.contains("allocate") || methodName.contains("create") || methodName.contains("stream") || methodName.contains("acquire")) {
                node.setResourceLeakSuspicion(true);
            }

            if (methodName.contains("close") || methodName.contains("release") || methodName.contains("disconnect") || methodName.contains("shutdown") || methodName.contains("dispose")) {
                node.setResourceLeakSuspicion(false);
            }

            if (methodName.contains("lock") || methodName.contains("synchronize") || methodName.contains("wait") || methodName.contains("semaphore")) {
                node.setContentionRisk(true);
            }

            if ("ERROR".equals(event.getStatus())) {
                node.setHasError(true);
                node.setErrorMessage(event.getErrorMessage());
                node.setErrorStackTrace(event.getErrorStackTrace());
                node.setLogicGapRisk(true);
            }

            if (event.getExecutionTimeMs() > SLOW_THRESHOLD_MS * 4) {
                node.setLogicGapRisk(true);
            }

            // Find parent node using spanId/parentSpanId (stable identifier)
            CallTreeNode parentNode = findParentBySpanId(root, event.getParentSpanId());
            if (parentNode != null) {
                parentNode.addChild(node);
            } else {
                // Fallback: use parentMethod for backward compatibility
                parentNode = findLastParent(root, event.getParentMethod());
                if (parentNode != null) {
                    parentNode.addChild(node);
                } else {
                    root.addChild(node);
                }
            }

            // Calculate critical path after each event
            calculateCriticalPath(root);

            if (!"ROOT".equals(event.getMethod())) {
                recordMethodDuration(event.getMethod(), event.getExecutionTimeMs());
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void recordMethodDuration(String method, long durationMs) {
        methodDurationHistory.compute(method, (k, list) -> {
            List<Long> updated = list == null ? new ArrayList<>() : new ArrayList<>(list);
            updated.add(durationMs);
            if (updated.size() > 200) {
                updated = new ArrayList<>(updated.subList(updated.size() - 200, updated.size()));
            }
            return updated;
        });
    }

    /** Finds node by spanId (stable, unique identifier). */
    private CallTreeNode findParentBySpanId(CallTreeNode current, String parentSpanId) {
        if (parentSpanId == null) {
            return null;
        }
        
        if (parentSpanId.equals(current.getSpanId())) {
            return current;
        }
        
        for (CallTreeNode child : current.getChildren()) {
            CallTreeNode match = findParentBySpanId(child, parentSpanId);
            if (match != null) {
                return match;
            }
        }
        
        return null;
    }

    /** Finds the deepest node matching parentMethod (most recent call in the tree). */
    private CallTreeNode findLastParent(CallTreeNode current, String parentMethod) {
        if (parentMethod == null) {
            return null;
        }
        CallTreeNode match = null;
        if (parentMethod.equals(current.getMethodName())) {
            match = current;
        }
        for (CallTreeNode child : current.getChildren()) {
            CallTreeNode childMatch = findLastParent(child, parentMethod);
            if (childMatch != null) {
                match = childMatch;
            }
        }
        return match;
    }
    
    // Calculate and mark the critical path (longest execution path from root to leaf)
    private void calculateCriticalPath(CallTreeNode root) {
        // Clear previous critical path markings
        clearCriticalPathMarkings(root);
        
        // Find the longest path and mark it
        List<CallTreeNode> longestPath = findLongestPath(root);
        for (CallTreeNode node : longestPath) {
            node.setIsOnCriticalPath(true);
        }
    }
    
    private void clearCriticalPathMarkings(CallTreeNode node) {
        node.setIsOnCriticalPath(false);
        for (CallTreeNode child : node.getChildren()) {
            clearCriticalPathMarkings(child);
        }
    }
    
    // Find the longest execution path (cumulative time) from root to any leaf
    private List<CallTreeNode> findLongestPath(CallTreeNode node) {
        List<CallTreeNode> longestPath = new ArrayList<>();
        longestPath.add(node);
        
        if (node.getChildren().isEmpty()) {
            return longestPath;
        }
        
        List<CallTreeNode> longestChildPath = null;
        long maxChildTime = 0;
        
        for (CallTreeNode child : node.getChildren()) {
            List<CallTreeNode> childPath = findLongestPath(child);
            long childTime = calculatePathTime(childPath);
            
            if (childTime > maxChildTime) {
                maxChildTime = childTime;
                longestChildPath = childPath;
            }
        }
        
        if (longestChildPath != null) {
            longestPath.addAll(longestChildPath);
        }
        
        return longestPath;
    }
    
    private long calculatePathTime(List<CallTreeNode> path) {
        return path.stream().mapToLong(CallTreeNode::getExecutionTime).sum();
    }

    public CallTreeNode getTrace(String requestId) {
        lock.readLock().lock();
        try {
            return traces.get(requestId);
        } finally {
            lock.readLock().unlock();
        }
    }

    public TraceAnalysisReport analyzeTrace(String requestId) {
        lock.readLock().lock();
        try {
            CallTreeNode root = traces.get(requestId);
            if (root == null) {
                return null;
            }

            AnalysisCounter counter = new AnalysisCounter();
            countNodes(root, counter);

            long totalTime = root.getChildren().stream().mapToLong(CallTreeNode::getExecutionTime).sum();
            List<String> warnings = new ArrayList<>();

            if (counter.errorCount > 0) {
                warnings.add("Errors detected in call tree: " + counter.errorCount + " nodes");
            }
            if (counter.slowNodeCount > 0) {
                warnings.add("Slow nodes: " + counter.slowNodeCount + " nodes above " + SLOW_THRESHOLD_MS + "ms");
            }
            if (counter.resourceLeakSuspectCount > 0) {
                warnings.add("Resource leak candidates: " + counter.resourceLeakSuspectCount);
            }
            if (counter.contentionRiskCount > 0) {
                warnings.add("Contention risk nodes: " + counter.contentionRiskCount);
            }
            if (counter.logicGapCount > 0) {
                warnings.add("Logic gap risk nodes: " + counter.logicGapCount);
            }

            List<String> nPlusOne = TraceRootCauseAnalyzer.detectNPlusOne(root);
            if (!nPlusOne.isEmpty()) {
                warnings.add("N+1 query pattern detected (" + nPlusOne.size() + " occurrence(s))");
            }

            List<String> rootCauses = TraceRootCauseAnalyzer.analyze(root);
            List<String> anomalies = detectRequestAnomalies(root);

            return new TraceAnalysisReport(
                    requestId,
                    totalTime,
                    counter.nodeCount,
                    counter.errorCount,
                    counter.slowNodeCount,
                    counter.resourceLeakSuspectCount,
                    counter.contentionRiskCount,
                    counter.logicGapCount,
                    warnings,
                    rootCauses,
                    nPlusOne,
                    anomalies
            );
        } finally {
            lock.readLock().unlock();
        }
    }

    private List<String> detectRequestAnomalies(CallTreeNode root) {
        List<String> anomalies = new ArrayList<>();
        collectAnomalies(root, anomalies);
        return anomalies;
    }

    private void collectAnomalies(CallTreeNode node, List<String> anomalies) {
        if (!"ROOT".equals(node.getMethodName())) {
            List<Long> history = methodDurationHistory.get(node.getMethodName());
            anomalies.addAll(TraceRootCauseAnalyzer.detectAnomalies(history, node.getExecutionTime()));
        }
        for (CallTreeNode child : node.getChildren()) {
            collectAnomalies(child, anomalies);
        }
    }

    public MetricsDashboardReport getMetricsDashboard() {
        lock.readLock().lock();
        try {
            Map<String, MethodStat> globalStats = new HashMap<>();
            for (CallTreeNode root : traces.values()) {
                collectMethodStats(root, globalStats);
            }

            List<MethodAggregateMetrics> metrics = globalStats.entrySet().stream()
                    .map(e -> toAggregateMetrics(e.getKey(), e.getValue()))
                    .sorted(Comparator.comparingLong(MethodAggregateMetrics::getCount).reversed())
                    .limit(50)
                    .toList();

            List<String> anomalies = new ArrayList<>();
            for (MethodAggregateMetrics m : metrics) {
                if (m.getP95Ms() > m.getAvgMs() * 3 && m.getCount() >= 5) {
                    anomalies.add(m.getMethod() + ": high tail latency (p95="
                            + m.getP95Ms() + "ms vs avg=" + String.format("%.0f", m.getAvgMs()) + "ms)");
                }
                if (m.getErrorRate() > 0.1 && m.getCount() >= 3) {
                    anomalies.add(m.getMethod() + ": elevated error rate "
                            + String.format("%.0f%%", m.getErrorRate() * 100));
                }
            }

            return new MetricsDashboardReport(
                    traces.size(),
                    traces.size(),
                    metrics,
                    anomalies.stream().limit(10).toList()
            );
        } finally {
            lock.readLock().unlock();
        }
    }

    private MethodAggregateMetrics toAggregateMetrics(String method, MethodStat stat) {
        List<Long> durations = stat.durations.isEmpty()
                ? List.of(stat.totalMs / Math.max(stat.count, 1))
                : stat.durations;
        durations = durations.stream().sorted().toList();

        long p50 = percentile(durations, 50);
        long p95 = percentile(durations, 95);
        long p99 = percentile(durations, 99);
        double avg = durations.stream().mapToLong(Long::longValue).average().orElse(0);
        double variance = durations.stream()
                .mapToDouble(d -> Math.pow(d - avg, 2))
                .average()
                .orElse(0);
        double errorRate = stat.count == 0 ? 0 : (double) stat.errorCount / stat.count;

        return new MethodAggregateMetrics(
                method,
                stat.count,
                stat.errorCount,
                errorRate,
                avg,
                p50,
                p95,
                p99,
                variance
        );
    }

    private static long percentile(List<Long> sorted, int pct) {
        if (sorted.isEmpty()) {
            return 0;
        }
        int idx = (int) Math.ceil((pct / 100.0) * sorted.size()) - 1;
        idx = Math.max(0, Math.min(idx, sorted.size() - 1));
        return sorted.get(idx);
    }

    public TraceDiffReport diffTraces(String baseRequestId, String compareRequestId) {
        lock.readLock().lock();
        try {
            CallTreeNode base = traces.get(baseRequestId);
            CallTreeNode compare = traces.get(compareRequestId);

            if (base == null || compare == null) {
                return new TraceDiffReport(
                    baseRequestId,
                    compareRequestId,
                    Collections.emptyList(),
                    Collections.emptyList(),
                    Collections.emptyList()
                );
            }

            Map<String, MethodStat> baseStats = new HashMap<>();
            Map<String, MethodStat> compareStats = new HashMap<>();
            collectMethodStats(base, baseStats);
            collectMethodStats(compare, compareStats);

            Set<String> baseMethods = new HashSet<>(baseStats.keySet());
            Set<String> compareMethods = new HashSet<>(compareStats.keySet());

            List<String> addedMethods = compareMethods.stream()
                .filter(method -> !baseMethods.contains(method))
                .sorted()
                .toList();

            List<String> removedMethods = baseMethods.stream()
                .filter(method -> !compareMethods.contains(method))
                .sorted()
                .toList();

            List<MethodTimingDelta> timingDeltas = new ArrayList<>();
            for (String method : baseMethods) {
                if (!compareMethods.contains(method)) {
                    continue;
                }
                MethodStat baseStat = baseStats.get(method);
                MethodStat compareStat = compareStats.get(method);
                long baseAvg = baseStat.totalMs / Math.max(baseStat.count, 1);
                long compareAvg = compareStat.totalMs / Math.max(compareStat.count, 1);
                timingDeltas.add(new MethodTimingDelta(method, baseAvg, compareAvg));
            }

            timingDeltas.sort(Comparator.comparingLong(delta -> Math.abs(delta.getDeltaMs())));
            Collections.reverse(timingDeltas);

            if (timingDeltas.size() > 8) {
                timingDeltas = new ArrayList<>(timingDeltas.subList(0, 8));
            }

            return new TraceDiffReport(baseRequestId, compareRequestId, addedMethods, removedMethods, timingDeltas);
        } finally {
            lock.readLock().unlock();
        }
    }

    private void countNodes(CallTreeNode node, AnalysisCounter counter) {
        if (node == null) return;
        counter.nodeCount++;
        if (node.hasError()) counter.errorCount++;
        if (node.isSlowPath()) counter.slowNodeCount++;
        if (node.isResourceLeakSuspicion()) counter.resourceLeakSuspectCount++;
        if (node.isContentionRisk()) counter.contentionRiskCount++;
        if (node.isLogicGapRisk()) counter.logicGapCount++;

        for (CallTreeNode child : node.getChildren()) {
            countNodes(child, counter);
        }
    }

    private void collectMethodStats(CallTreeNode node, Map<String, MethodStat> stats) {
        if (node == null) {
            return;
        }

        if (!"ROOT".equals(node.getMethodName())) {
            MethodStat stat = stats.computeIfAbsent(node.getMethodName(), k -> new MethodStat());
            stat.count += 1;
            stat.totalMs += node.getExecutionTime();
            stat.durations.add(node.getExecutionTime());
            if (node.hasError()) {
                stat.errorCount += 1;
            }
        }

        for (CallTreeNode child : node.getChildren()) {
            collectMethodStats(child, stats);
        }
    }

    private static class AnalysisCounter {
        int nodeCount;
        int errorCount;
        int slowNodeCount;
        int resourceLeakSuspectCount;
        int contentionRiskCount;
        int logicGapCount;
    }

    private static class MethodStat {
        long count;
        long totalMs;
        long errorCount;
        final List<Long> durations = new ArrayList<>();
    }

    public List<String> listRequestIds() {
        lock.readLock().lock();
        try {
            return new ArrayList<>(traces.keySet());
        } finally {
            lock.readLock().unlock();
        }
    }

    public void removeTrace(String requestId) {
        lock.writeLock().lock();
        try {
            traces.remove(requestId);
            traceCreationTimes.remove(requestId);
        } finally {
            lock.writeLock().unlock();
        }
    }

    public int mergeRemoteSpans(String requestId, List<DistributedSpanMerger.RemoteSpanPayload> remoteSpans,
                                DistributedSpanMerger merger) {
        lock.writeLock().lock();
        try {
            CallTreeNode root = traces.get(requestId);
            if (root == null) {
                return 0;
            }
            int merged = merger.mergeRemoteSpans(root, remoteSpans);
            if (merged > 0) {
                calculateCriticalPath(root);
            }
            return merged;
        } finally {
            lock.writeLock().unlock();
        }
    }
}
