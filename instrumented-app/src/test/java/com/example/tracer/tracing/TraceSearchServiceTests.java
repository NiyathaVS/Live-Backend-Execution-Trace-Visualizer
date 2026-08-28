package com.example.tracer.tracing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TraceSearchServiceTests {

    private InMemoryTraceCollector collector;
    private TraceSearchService searchService;

    @BeforeEach
    void setUp() {
        collector = new InMemoryTraceCollector(100, 3600, "all");
        searchService = new TraceSearchService(collector);
    }

    @Test
    void findsTracesByMethodName() {
        addMethodEvent("req-1", "UserService.getUser", 50, "SUCCESS");
        addMethodEvent("req-2", "OrderService.placeOrder", 200, "SUCCESS");

        var results = searchService.search(new TraceSearchService.TraceSearchCriteria(
                "UserService", null, null, null, 10));

        assertEquals(1, results.size());
        assertEquals("req-1", results.get(0).requestId());
    }

    @Test
    void filtersByMinDuration() {
        addMethodEvent("fast", "Fast.method", 10, "SUCCESS");
        addMethodEvent("slow", "Slow.method", 500, "SUCCESS");

        var results = searchService.search(new TraceSearchService.TraceSearchCriteria(
                null, 100L, null, null, 10));

        assertEquals(1, results.size());
        assertEquals("slow", results.get(0).requestId());
    }

    @Test
    void filtersErrorsOnly() {
        addMethodEvent("ok", "Ok.method", 50, "SUCCESS");
        addMethodEvent("bad", "Bad.method", 50, "ERROR");

        var results = searchService.search(new TraceSearchService.TraceSearchCriteria(
                null, null, null, true, 10));

        assertEquals(1, results.size());
        assertEquals("bad", results.get(0).requestId());
    }

    private void addMethodEvent(String requestId, String method, long ms, String status) {
        TraceEvent event = TraceEvent.builder()
                .requestId(requestId).threadId(1L).timestamp(java.time.LocalDateTime.now())
                .method(method).executionTimeMs(ms)
                .parentMethod("ROOT").sourceLine(0).status(status)
                .threadName("main").threadCpuTimeMs(0L).threadState("RUNNABLE")
                .eventType(SqlTraceListener.EVENT_TYPE_METHOD)
                .spanId(java.util.UUID.randomUUID().toString())
                .build();
        collector.addEvent(event);
    }
}
