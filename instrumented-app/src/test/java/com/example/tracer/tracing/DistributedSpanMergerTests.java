package com.example.tracer.tracing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DistributedSpanMergerTests {

    private DistributedSpanMerger merger;

    @BeforeEach
    void setUp() {
        merger = new DistributedSpanMerger("local-service");
    }

    @Test
    void mergesRemoteSpanUnderMatchingParent() {
        CallTreeNode root = new CallTreeNode("ROOT", System.currentTimeMillis());
        CallTreeNode parent = new CallTreeNode("OrderController.getOrder", System.currentTimeMillis());
        parent.setSpanId("parent-span-1");
        parent.setExecutionTime(100);
        root.addChild(parent);

        int merged = merger.mergeRemoteSpans(root, List.of(
                new DistributedSpanMerger.RemoteSpanPayload(
                        "remote-span-1",
                        "parent-span-1",
                        "payment-service",
                        "PaymentService.charge",
                        System.currentTimeMillis(),
                        80,
                        false,
                        null,
                        Map.of("amount", 99.99)
                )
        ));

        assertEquals(1, merged);
        assertEquals(1, parent.getChildren().size());
        assertTrue(parent.getChildren().get(0).getMethodName().contains("payment-service"));
    }

    @Test
    void skipsDuplicateSpanIds() {
        CallTreeNode root = new CallTreeNode("ROOT", System.currentTimeMillis());
        CallTreeNode existing = new CallTreeNode("Existing", System.currentTimeMillis());
        existing.setSpanId("remote-span-1");
        root.addChild(existing);

        int merged = merger.mergeRemoteSpans(root, List.of(
                new DistributedSpanMerger.RemoteSpanPayload(
                        "remote-span-1",
                        null,
                        "other",
                        "Other.method",
                        System.currentTimeMillis(),
                        10,
                        false,
                        null,
                        null
                )
        ));

        assertEquals(0, merged);
    }
}
