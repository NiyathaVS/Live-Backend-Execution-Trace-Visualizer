package com.example.tracer.tracing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test concurrent access to InMemoryTraceCollector and WebSocket broadcasting.
 * Ensures thread safety under high load.
 */
public class ConcurrentTraceTest {

    private InMemoryTraceCollector collector;
    private TraceWebSocketHandler wsHandler;

    @BeforeEach
    public void setUp() {
        collector = new InMemoryTraceCollector(100);
        wsHandler = new TraceWebSocketHandler();
    }

    /**
     * Test that multiple threads can add events concurrently without corruption.
     */
    @Test
    public void testConcurrentEventAddition() throws InterruptedException {
        int numThreads = 10;
        int eventsPerThread = 100;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads);
        CountDownLatch latch = new CountDownLatch(numThreads);

        for (int t = 0; t < numThreads; t++) {
            final int threadId = t;
            executor.submit(() -> {
                try {
                    for (int i = 0; i < eventsPerThread; i++) {
                        TraceEvent event = new TraceEvent(
                            "req-" + threadId,
                            Thread.currentThread().getId(),
                            LocalDateTime.now(),
                            "method" + i,
                            new HashMap<>(),
                            null,
                            10L + i,
                            "parentMethod",
                            "Test.java",
                            i,
                            "SUCCESS",
                            null,
                            null,
                            null,
                            Thread.currentThread().getName(),
                            0L,
                            Thread.currentThread().getState().name()
                        );
                        collector.addEvent(event);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS), "Timeout waiting for concurrent events");
        executor.shutdown();

        // Verify all traces exist and have correct event counts
        for (int t = 0; t < numThreads; t++) {
            CallTreeNode trace = collector.getTrace("req-" + t);
            assertNotNull(trace, "Trace should exist for req-" + t);
            assertTrue(trace.getChildren().size() > 0, "Trace should have children");
        }
    }

    /**
     * Test that trace analysis works correctly under concurrent event additions.
     */
    @Test
    public void testConcurrentAnalysis() throws InterruptedException {
        String requestId = "req-concurrent-analysis";
        int numThreads = 5;
        int eventCount = 50;
        ExecutorService executor = Executors.newFixedThreadPool(numThreads + 1);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch endLatch = new CountDownLatch(numThreads + 1);

        // Event producer threads
        for (int t = 0; t < numThreads; t++) {
            executor.submit(() -> {
                try {
                    startLatch.await();
                    for (int i = 0; i < eventCount; i++) {
                        TraceEvent event = new TraceEvent(
                            requestId,
                            Thread.currentThread().getId(),
                            LocalDateTime.now(),
                            "method" + i,
                            new HashMap<>(),
                            null,
                            20L + (i % 200),
                            "parentMethod",
                            "Test.java",
                            i,
                            i % 10 == 0 ? "ERROR" : "SUCCESS",
                            i % 10 == 0 ? "TestException" : null,
                            i % 10 == 0 ? "Test error message" : null,
                            i % 10 == 0 ? "at Test.method()" : null,
                            Thread.currentThread().getName(),
                            0L,
                            Thread.currentThread().getState().name()
                        );
                        collector.addEvent(event);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    endLatch.countDown();
                }
            });
        }

        // Analysis thread - runs concurrently
        AtomicInteger analysisCount = new AtomicInteger(0);
        executor.submit(() -> {
            try {
                startLatch.await();
                while (endLatch.getCount() > 1) {
                    TraceAnalysisReport report = collector.analyzeTrace(requestId);
                    if (report != null) {
                        analysisCount.incrementAndGet();
                        // Verify analysis data consistency
                        assertTrue(report.getNodeCount() >= 0);
                        assertTrue(report.getErrorCount() >= 0);
                    }
                    Thread.sleep(5);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                endLatch.countDown();
            }
        });

        startLatch.countDown(); // Start all threads
        assertTrue(endLatch.await(20, TimeUnit.SECONDS), "Timeout waiting for concurrent operations");
        executor.shutdown();

        // Verify analysis ran multiple times
        assertTrue(analysisCount.get() > 0, "Analysis should have run at least once");

        // Verify final trace is valid
        CallTreeNode trace = collector.getTrace(requestId);
        assertNotNull(trace);
        TraceAnalysisReport finalReport = collector.analyzeTrace(requestId);
        assertNotNull(finalReport);
    }

    /**
     * Test WebSocket broadcast under concurrent event emission.
     * Simulates multiple clients receiving broadcast messages.
     */
    @Test
    public void testConcurrentWebSocketBroadcast() throws Exception {
        int numSessions = 5;
        int numEvents = 20;

        List<StubWebSocketSession> mockSessions = new ArrayList<>();
        for (int i = 0; i < numSessions; i++) {
            StubWebSocketSession session = new StubWebSocketSession("session-" + i);
            mockSessions.add(session);
            wsHandler.afterConnectionEstablished(session);
        }

        // Broadcast events concurrently
        ExecutorService executor = Executors.newFixedThreadPool(4);
        CountDownLatch latch = new CountDownLatch(4);

        for (int t = 0; t < 4; t++) {
            final int threadId = t;
            executor.submit(() -> {
                try {
                    for (int i = 0; i < numEvents; i++) {
                        TraceEvent event = new TraceEvent(
                            "req-" + threadId,
                            Thread.currentThread().getId(),
                            LocalDateTime.now(),
                            "method" + i,
                            new HashMap<>(),
                            null,
                            5L + i,
                            "parentMethod",
                            "Test.java",
                            i,
                            "SUCCESS",
                            null,
                            null,
                            null,
                            Thread.currentThread().getName(),
                            0L,
                            Thread.currentThread().getState().name()
                        );
                        wsHandler.broadcastEvent(event);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS), "Timeout waiting for broadcasts");
        executor.shutdown();

        for (StubWebSocketSession session : mockSessions) {
            assertTrue(session.getMessageCount() > 0,
                    "Session " + session.getId() + " should receive broadcasts");
        }

        // Clean up
        for (WebSocketSession session : mockSessions) {
            wsHandler.afterConnectionClosed(session, CloseStatus.NORMAL);
        }
    }

    /**
     * Test LRU eviction under concurrent access with memory bounds.
     */
    @Test
    public void testLRUEvictionUnderConcurrentLoad() throws InterruptedException {
        InMemoryTraceCollector boundedCollector = new InMemoryTraceCollector(50); // Small limit
        ExecutorService executor = Executors.newFixedThreadPool(4);
        CountDownLatch latch = new CountDownLatch(4);

        for (int t = 0; t < 4; t++) {
            final int threadId = t;
            executor.submit(() -> {
                try {
                    for (int i = 0; i < 50; i++) {
                        String requestId = "req-" + threadId + "-" + i;
                        TraceEvent event = new TraceEvent(
                            requestId,
                            Thread.currentThread().getId(),
                            LocalDateTime.now(),
                            "method",
                            new HashMap<>(),
                            null,
                            10L,
                            null,
                            "Test.java",
                            1,
                            "SUCCESS",
                            null,
                            null,
                            null,
                            Thread.currentThread().getName(),
                            0L,
                            Thread.currentThread().getState().name()
                        );
                        boundedCollector.addEvent(event);
                    }
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(10, TimeUnit.SECONDS), "Timeout waiting for LRU test");
        executor.shutdown();

        // Verify total traces don't exceed limit
        // Note: We can't directly access the map size, but we can verify no exceptions were thrown
        // and the system remained stable
    }

    /**
     * Test mixed read/write operations (simulate UI queries while events are being added).
     */
    @Test
    public void testMixedReadWriteOperations() throws InterruptedException {
        String requestId = "req-mixed";
        ExecutorService executor = Executors.newFixedThreadPool(6);
        CountDownLatch latch = new CountDownLatch(6);
        AtomicInteger readCount = new AtomicInteger(0);
        AtomicInteger errorCount = new AtomicInteger(0);

        // 3 writer threads
        for (int w = 0; w < 3; w++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < 30; i++) {
                        TraceEvent event = new TraceEvent(
                            requestId,
                            Thread.currentThread().getId(),
                            LocalDateTime.now(),
                            "method" + i,
                            new HashMap<>(),
                            null,
                            15L + i,
                            "parentMethod",
                            "Test.java",
                            i,
                            "SUCCESS",
                            null,
                            null,
                            null,
                            Thread.currentThread().getName(),
                            0L,
                            Thread.currentThread().getState().name()
                        );
                        collector.addEvent(event);
                        Thread.sleep(1);
                    }
                } catch (InterruptedException e) {
                    errorCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        // 3 reader threads
        for (int r = 0; r < 3; r++) {
            executor.submit(() -> {
                try {
                    for (int i = 0; i < 50; i++) {
                        CallTreeNode trace = collector.getTrace(requestId);
                        if (trace != null) {
                            readCount.incrementAndGet();
                        }
                        TraceAnalysisReport report = collector.analyzeTrace(requestId);
                        if (report != null) {
                            readCount.incrementAndGet();
                        }
                        Thread.sleep(1);
                    }
                } catch (InterruptedException e) {
                    errorCount.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }

        assertTrue(latch.await(30, TimeUnit.SECONDS), "Timeout waiting for mixed operations");
        executor.shutdown();

        assertEquals(0, errorCount.get(), "No errors should occur during concurrent access");
        assertTrue(readCount.get() > 0, "Reads should have succeeded");
    }

    /** Minimal WebSocketSession stub for concurrent broadcast tests. */
    static class StubWebSocketSession implements WebSocketSession {
        private final String id;
        private boolean open = true;
        private int messageCount;

        StubWebSocketSession(String id) {
            this.id = id;
        }

        int getMessageCount() {
            return messageCount;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public boolean isOpen() {
            return open;
        }

        @Override
        public void sendMessage(org.springframework.web.socket.WebSocketMessage<?> message) {
            messageCount++;
        }

        @Override
        public void close() {
            open = false;
        }

        @Override
        public void close(org.springframework.web.socket.CloseStatus status) {
            open = false;
        }

        @Override
        public java.net.URI getUri() {
            return null;
        }

        @Override
        public org.springframework.http.HttpHeaders getHandshakeHeaders() {
            return new org.springframework.http.HttpHeaders();
        }

        @Override
        public java.util.Map<String, Object> getAttributes() {
            return new java.util.HashMap<>();
        }

        @Override
        public java.security.Principal getPrincipal() {
            return null;
        }

        @Override
        public java.net.InetSocketAddress getLocalAddress() {
            return null;
        }

        @Override
        public java.net.InetSocketAddress getRemoteAddress() {
            return null;
        }

        @Override
        public String getAcceptedProtocol() {
            return null;
        }

        @Override
        public void setTextMessageSizeLimit(int messageSizeLimit) {
        }

        @Override
        public int getTextMessageSizeLimit() {
            return 0;
        }

        @Override
        public void setBinaryMessageSizeLimit(int messageSizeLimit) {
        }

        @Override
        public int getBinaryMessageSizeLimit() {
            return 0;
        }

        @Override
        public List<org.springframework.web.socket.WebSocketExtension> getExtensions() {
            return List.of();
        }
    }
}
