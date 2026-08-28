import { describe, it, expect } from "vitest";
import {
    computeMetrics,
    flattenEvents,
    extractClassNameFromMethod,
    buildTracesFromEvents
} from "../services/traceUtils";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeNode(id, method, executionTimeMs, children = []) {
    return { eventId: id, method, executionTimeMs, children };
}

function makeRoot(children = []) {
    return { method: "ROOT", children };
}

// ─── computeMetrics ─────────────────────────────────────────────────────────

describe("computeMetrics", () => {
    it("returns zeros for null input", () => {
        const result = computeMetrics(null);
        expect(result.nodeCount).toBe(0);
        expect(result.maxExecution).toBeNull();
        expect(result.slowPathEventIds.size).toBe(0);
    });

    it("counts a single node correctly", () => {
        const root = makeRoot([makeNode("e1", "Svc.m", 100)]);
        const { nodeCount, maxExecution } = computeMetrics(root);
        expect(nodeCount).toBe(2); // ROOT + 1 child
        expect(maxExecution).toBe(100);
    });

    it("marks the longest path as the slow path", () => {
        // ROOT → fast (50ms) → leaf-a (10ms)
        //      → slow (200ms) → leaf-b (5ms)
        const fast = makeNode("fast", "Svc.fast", 50, [makeNode("la", "Svc.la", 10)]);
        const slow = makeNode("slow", "Svc.slow", 200, [makeNode("lb", "Svc.lb", 5)]);
        const root = makeRoot([fast, slow]);

        const { slowPathEventIds } = computeMetrics(root);
        expect(slowPathEventIds.has("slow")).toBe(true);
        expect(slowPathEventIds.has("lb")).toBe(true);
        // fast branch should NOT be on the slow path
        expect(slowPathEventIds.has("fast")).toBe(false);
    });

    it("returns the max execution across all nodes", () => {
        const root = makeRoot([
            makeNode("e1", "Svc.a", 300),
            makeNode("e2", "Svc.b", 150)
        ]);
        const { maxExecution } = computeMetrics(root);
        expect(maxExecution).toBe(300);
    });
});

// ─── flattenEvents ───────────────────────────────────────────────────────────

describe("flattenEvents", () => {
    it("returns empty array for null", () => {
        expect(flattenEvents(null)).toEqual([]);
    });

    it("skips the ROOT node (no eventId) but includes children", () => {
        const child = makeNode("e1", "Svc.m", 100);
        const root = makeRoot([child]);
        const flat = flattenEvents(root);
        expect(flat).toHaveLength(1);
        expect(flat[0].eventId).toBe("e1");
    });

    it("flattens a nested tree in DFS order", () => {
        const grandchild = makeNode("e3", "Svc.c", 10);
        const child = makeNode("e2", "Svc.b", 50, [grandchild]);
        const root = makeRoot([makeNode("e1", "Svc.a", 100), child]);
        const ids = flattenEvents(root).map(n => n.eventId);
        expect(ids).toEqual(["e1", "e2", "e3"]);
    });
});

// ─── extractClassNameFromMethod ──────────────────────────────────────────────

describe("extractClassNameFromMethod", () => {
    it("returns null for null / undefined input", () => {
        expect(extractClassNameFromMethod(null)).toBeNull();
        expect(extractClassNameFromMethod(undefined)).toBeNull();
    });

    it("returns null for 'ROOT'", () => {
        expect(extractClassNameFromMethod("ROOT")).toBeNull();
    });

    it("extracts a fully-qualified class name", () => {
        expect(
            extractClassNameFromMethod("com.example.UserService.findById(..)")
        ).toBe("com.example.UserService");
    });

    it("handles a simple one-level class name", () => {
        expect(extractClassNameFromMethod("MyService.doWork()")).toBe("MyService");
    });

    it("returns null when there is no dot", () => {
        expect(extractClassNameFromMethod("noPackageMethod()")).toBeNull();
    });
});

// ─── buildTracesFromEvents ───────────────────────────────────────────────────

describe("buildTracesFromEvents", () => {
    it("creates a ROOT node for an empty events list", () => {
        const result = buildTracesFromEvents({ req1: [] });
        expect(result.req1.method).toBe("ROOT");
        expect(result.req1.children).toHaveLength(0);
    });

    it("attaches top-level events (no parent) directly to ROOT", () => {
        const events = [{ spanId: "s1", eventId: "e1", method: "Svc.a" }];
        const result = buildTracesFromEvents({ req1: events });
        expect(result.req1.children).toHaveLength(1);
        expect(result.req1.children[0].spanId).toBe("s1");
    });

    it("links parent and child by spanId / parentSpanId", () => {
        const events = [
            { spanId: "s1", parentSpanId: null, eventId: "e1", method: "Svc.parent" },
            { spanId: "s2", parentSpanId: "s1",  eventId: "e2", method: "Svc.child"  }
        ];
        const result = buildTracesFromEvents({ req1: events });
        const parentNode = result.req1.children[0];
        expect(parentNode.spanId).toBe("s1");
        expect(parentNode.children).toHaveLength(1);
        expect(parentNode.children[0].spanId).toBe("s2");
    });

    it("handles multiple independent requests", () => {
        const e = (spanId, method) => ({ spanId, eventId: spanId, method });
        const result = buildTracesFromEvents({
            reqA: [e("s1", "Svc.a")],
            reqB: [e("s2", "Svc.b")]
        });
        expect(result.reqA.children[0].spanId).toBe("s1");
        expect(result.reqB.children[0].spanId).toBe("s2");
    });

    it("falls back to ROOT when parentSpanId not found in the same request", () => {
        const events = [
            { spanId: "s1", parentSpanId: "unknown-parent", eventId: "e1", method: "Svc.orphan" }
        ];
        const result = buildTracesFromEvents({ req1: events });
        // orphan should be attached to ROOT, not lost
        expect(result.req1.children).toHaveLength(1);
        expect(result.req1.children[0].spanId).toBe("s1");
    });
});
