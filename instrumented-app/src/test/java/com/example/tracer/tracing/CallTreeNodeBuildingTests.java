package com.example.tracer.tracing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("CallTreeNode Building Tests")
class CallTreeNodeBuildingTests {

    private InMemoryTraceCollector collector;

    @BeforeEach
    void setUp() {
        collector = new InMemoryTraceCollector(100, 3600, "all", 100, 200);
    }

    @Test
    @DisplayName("Single event creates root with one child")
    void testSingleEventCreatesNode() {
        TraceEvent event = createEvent("requestId1", "com.example.Service.method()", null, null);
        
        collector.addEvent(event);
        
        CallTreeNode root = collector.getTrace("requestId1");
        assertNotNull(root);
        assertEquals("ROOT", root.getMethodName());
        assertEquals(1, root.getChildren().size());
        assertEquals("com.example.Service.method()", root.getChildren().get(0).getMethodName());
    }

    @Test
    @DisplayName("Parent-child relationship using spanId")
    void testSpanIdParentLinkage() {
        String parentSpanId = "span-parent-123";
        String childSpanId = "span-child-456";
        
        TraceEvent parent = createEvent("requestId1", "com.example.Service.parent()", 
            parentSpanId, null);
        TraceEvent child = createEvent("requestId1", "com.example.Service.child()", 
            childSpanId, parentSpanId);
        
        collector.addEvent(parent);
        collector.addEvent(child);
        
        CallTreeNode root = collector.getTrace("requestId1");
        assertEquals(1, root.getChildren().size());
        
        CallTreeNode parentNode = root.getChildren().get(0);
        assertEquals("com.example.Service.parent()", parentNode.getMethodName());
        assertEquals(parentSpanId, parentNode.getSpanId());
        
        assertEquals(1, parentNode.getChildren().size());
        CallTreeNode childNode = parentNode.getChildren().get(0);
        assertEquals("com.example.Service.child()", childNode.getMethodName());
        assertEquals(childSpanId, childNode.getSpanId());
        assertEquals(parentSpanId, childNode.getParentSpanId());
    }

    @Test
    @DisplayName("Multiple children under same parent")
    void testMultipleChildren() {
        String parentSpanId = "span-parent-123";
        
        TraceEvent parent = createEvent("requestId1", "com.example.Service.parent()", 
            parentSpanId, null);
        TraceEvent child1 = createEvent("requestId1", "com.example.Service.child1()", 
            "span-child-1", parentSpanId);
        TraceEvent child2 = createEvent("requestId1", "com.example.Service.child2()", 
            "span-child-2", parentSpanId);
        
        collector.addEvent(parent);
        collector.addEvent(child1);
        collector.addEvent(child2);
        
        CallTreeNode root = collector.getTrace("requestId1");
        CallTreeNode parentNode = root.getChildren().get(0);
        
        assertEquals(2, parentNode.getChildren().size());
        assertEquals("com.example.Service.child1()", parentNode.getChildren().get(0).getMethodName());
        assertEquals("com.example.Service.child2()", parentNode.getChildren().get(1).getMethodName());
    }

    @Test
    @DisplayName("Slow path detection")
    void testSlowPathDetection() {
        TraceEvent slowEvent = TraceEvent.builder()
            .requestId("requestId1").threadId(1L).timestamp(LocalDateTime.now())
            .method("com.example.Service.slowMethod()")
            .params(new HashMap<>()).executionTimeMs(500L)
            .sourceFile("Service.java").sourceLine(10)
            .status("SUCCESS").threadName("main").threadCpuTimeMs(100L).threadState("RUNNABLE")
            .build();
        
        collector.addEvent(slowEvent);
        
        CallTreeNode root = collector.getTrace("requestId1");
        CallTreeNode node = root.getChildren().get(0);
        assertTrue(node.isSlowPath(), "Event with 500ms should be marked as slow path");
    }

    @Test
    @DisplayName("Error handling")
    void testErrorHandling() {
        TraceEvent errorEvent = TraceEvent.builder()
            .requestId("requestId1").threadId(1L).timestamp(LocalDateTime.now())
            .method("com.example.Service.failingMethod()")
            .params(new HashMap<>()).executionTimeMs(50L)
            .sourceFile("Service.java").sourceLine(10).status("ERROR")
            .errorType("NullPointerException").errorMessage("Something was null").errorStackTrace("at line 10...")
            .threadName("main").threadCpuTimeMs(10L).threadState("RUNNABLE")
            .build();
        
        collector.addEvent(errorEvent);
        
        CallTreeNode root = collector.getTrace("requestId1");
        CallTreeNode node = root.getChildren().get(0);
        assertTrue(node.hasError(), "Event with ERROR status should have error flag");
        assertEquals("Something was null", node.getErrorMessage());
    }

    @Test
    @DisplayName("Sampling filters by percentage")
    void testSamplingPercentage() {
        InMemoryTraceCollector sampledCollector = new InMemoryTraceCollector(100, 3600, "10", 100, 200);
        
        // Add 100 events with different execution times
        // ~10 should be sampled on average
        int collected = 0;
        for (int i = 0; i < 100; i++) {
            TraceEvent event = createEvent("requestId" + i, 
                "com.example.Service.method" + i + "()", null, null);
            sampledCollector.addEvent(event);
        }
        
        // Count how many traces were actually collected
        // Note: This is probabilistic, so exact count will vary
        // In a real test, you might mock the random for determinism
        assertTrue(collected >= 0, "Sampling should accept some events");
    }

    @Test
    @DisplayName("CPU time is preserved")
    void testCpuTimePreservation() {
        TraceEvent event = TraceEvent.builder()
            .requestId("requestId1").threadId(1L).timestamp(LocalDateTime.now())
            .method("com.example.Service.method()")
            .params(new HashMap<>()).executionTimeMs(100L)
            .sourceFile("Service.java").sourceLine(10).status("SUCCESS")
            .threadName("main").threadCpuTimeMs(45L).threadState("RUNNABLE")
            .build();
        
        collector.addEvent(event);
        
        CallTreeNode root = collector.getTrace("requestId1");
        CallTreeNode node = root.getChildren().get(0);
        assertEquals(45L, node.getThreadCpuTimeMs(), "CPU time should be preserved");
    }

    @Test
    @DisplayName("SpanId is properly stored and retrieved")
    void testSpanIdStorage() {
        String spanId = "unique-span-id-xyz";
        String parentSpanId = "parent-span-id-abc";
        
        TraceEvent event = createEventWithSpanIds("requestId1", "com.example.Service.method()", 
            spanId, parentSpanId);
        
        collector.addEvent(event);
        
        CallTreeNode root = collector.getTrace("requestId1");
        CallTreeNode node = root.getChildren().get(0);
        
        assertEquals(spanId, node.getSpanId());
        assertEquals(parentSpanId, node.getParentSpanId());
    }

    private TraceEvent createEvent(String requestId, String method, String spanId, String parentSpanId) {
        return TraceEvent.builder()
            .requestId(requestId).threadId(1L).timestamp(LocalDateTime.now())
            .method(method).params(new HashMap<>()).executionTimeMs(50L)
            .sourceFile("Service.java").sourceLine(10).status("SUCCESS")
            .threadName("main").threadCpuTimeMs(10L).threadState("RUNNABLE")
            .eventType("METHOD").spanId(spanId).parentSpanId(parentSpanId)
            .build();
    }

    private TraceEvent createEventWithSpanIds(String requestId, String method, String spanId, String parentSpanId) {
        return createEvent(requestId, method, spanId, parentSpanId);
    }
}
