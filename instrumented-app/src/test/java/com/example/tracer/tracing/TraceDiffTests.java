package com.example.tracer.tracing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Trace Diff Tests")
class TraceDiffTests {

    private InMemoryTraceCollector collector;

    @BeforeEach
    void setUp() {
        collector = new InMemoryTraceCollector(100, 3600, "all");
    }

    @Test
    @DisplayName("Diff detects added methods")
    void testDiffDetectsAddedMethods() {
        // Base trace with 2 methods
        addEvent("base", "com.example.Service.method1()", 100L);
        addEvent("base", "com.example.Service.method2()", 50L);

        // Compare trace with 3 methods (method3 is new)
        addEvent("compare", "com.example.Service.method1()", 100L);
        addEvent("compare", "com.example.Service.method2()", 50L);
        addEvent("compare", "com.example.Service.method3()", 75L);

        TraceDiffReport diff = collector.diffTraces("base", "compare");

        assertNotNull(diff);
        assertEquals(1, diff.getAddedMethods().size());
        assertTrue(diff.getAddedMethods().contains("com.example.Service.method3()"));
        assertEquals(0, diff.getRemovedMethods().size());
    }

    @Test
    @DisplayName("Diff detects removed methods")
    void testDiffDetectsRemovedMethods() {
        // Base trace with 3 methods
        addEvent("base", "com.example.Service.method1()", 100L);
        addEvent("base", "com.example.Service.method2()", 50L);
        addEvent("base", "com.example.Service.method3()", 75L);

        // Compare trace with 2 methods (method3 removed)
        addEvent("compare", "com.example.Service.method1()", 100L);
        addEvent("compare", "com.example.Service.method2()", 50L);

        TraceDiffReport diff = collector.diffTraces("base", "compare");

        assertNotNull(diff);
        assertEquals(0, diff.getAddedMethods().size());
        assertEquals(1, diff.getRemovedMethods().size());
        assertTrue(diff.getRemovedMethods().contains("com.example.Service.method3()"));
    }

    @Test
    @DisplayName("Diff detects timing changes")
    void testDiffDetectsTimingChanges() {
        // Base trace
        addEvent("base", "com.example.Service.method1()", 100L);
        addEvent("base", "com.example.Service.method2()", 50L);

        // Compare trace with different timings
        addEvent("compare", "com.example.Service.method1()", 200L); // 2x slower
        addEvent("compare", "com.example.Service.method2()", 25L);  // 2x faster

        TraceDiffReport diff = collector.diffTraces("base", "compare");

        assertNotNull(diff);
        List<MethodTimingDelta> deltas = diff.getTimingDeltas();
        
        assertFalse(deltas.isEmpty());
        
        // Find method1 delta
        MethodTimingDelta method1Delta = deltas.stream()
            .filter(d -> d.getMethod().equals("com.example.Service.method1()"))
            .findFirst()
            .orElse(null);
        
        assertNotNull(method1Delta);
        assertEquals(100L, method1Delta.getDeltaMs()); // 200 - 100 = 100ms slower
    }

    @Test
    @DisplayName("Diff handles missing traces gracefully")
    void testDiffHandlesMissingTraces() {
        addEvent("base", "com.example.Service.method1()", 100L);

        TraceDiffReport diff = collector.diffTraces("base", "nonexistent");

        assertNotNull(diff);
        assertTrue(diff.getAddedMethods().isEmpty());
        assertTrue(diff.getRemovedMethods().isEmpty());
        assertTrue(diff.getTimingDeltas().isEmpty());
    }

    @Test
    @DisplayName("Diff with identical traces shows no changes")
    void testDiffWithIdenticalTraces() {
        addEvent("trace1", "com.example.Service.method1()", 100L);
        addEvent("trace1", "com.example.Service.method2()", 50L);

        addEvent("trace2", "com.example.Service.method1()", 100L);
        addEvent("trace2", "com.example.Service.method2()", 50L);

        TraceDiffReport diff = collector.diffTraces("trace1", "trace2");

        assertNotNull(diff);
        assertTrue(diff.getAddedMethods().isEmpty());
        assertTrue(diff.getRemovedMethods().isEmpty());
        
        // Timing deltas might exist but should be minimal
        for (MethodTimingDelta delta : diff.getTimingDeltas()) {
            assertEquals(0L, delta.getDeltaMs());
        }
    }

    @Test
    @DisplayName("Diff limits timing deltas to top 8")
    void testDiffLimitsTimingDeltas() {
        // Create base trace with 10 methods
        for (int i = 0; i < 10; i++) {
            addEvent("base", "com.example.Service.method" + i + "()", 100L);
        }

        // Create compare trace with different timings
        for (int i = 0; i < 10; i++) {
            addEvent("compare", "com.example.Service.method" + i + "()", 100L + (i * 10));
        }

        TraceDiffReport diff = collector.diffTraces("base", "compare");

        assertNotNull(diff);
        assertTrue(diff.getTimingDeltas().size() <= 8, 
            "Timing deltas should be limited to 8 entries");
    }

    private void addEvent(String requestId, String method, long executionTime) {
        TraceEvent event = new TraceEvent(
            requestId,
            Thread.currentThread().getId(),
            LocalDateTime.now(),
            method,
            new HashMap<>(),
            null,
            executionTime,
            null,
            "Service.java",
            10,
            "SUCCESS",
            null,
            null,
            null,
            "main",
            10L,
            "RUNNABLE"
        );
        collector.addEvent(event);
    }
}

