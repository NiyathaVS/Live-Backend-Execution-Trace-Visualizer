/**
 * Pure utility functions extracted from App.jsx.
 * No React dependencies — these are plain JS and fully unit-testable.
 */

/**
 * Walk a call-tree node and return:
 *   - nodeCount       total number of non-ROOT nodes visited
 *   - maxExecution    highest executionTimeMs seen across all nodes
 *   - slowPathEventIds  Set of eventIds along the longest-duration path
 *
 * @param {object|null} root - root call tree node (may be the synthetic ROOT)
 * @returns {{ nodeCount: number, maxExecution: number|null, slowPathEventIds: Set<string> }}
 */
export function computeMetrics(root) {
    if (!root) {
        return { nodeCount: 0, maxExecution: null, slowPathEventIds: new Set() };
    }

    let nodeCount = 0;
    let maxExecution = null;

    function dfs(node) {
        nodeCount += 1;

        if (node.executionTimeMs != null) {
            maxExecution =
                maxExecution == null
                    ? node.executionTimeMs
                    : Math.max(maxExecution, node.executionTimeMs);
        }

        if (!node.children || node.children.length === 0) {
            return {
                bestDuration: node.executionTimeMs || 0,
                bestPath: node.eventId ? [node.eventId] : []
            };
        }

        let bestChild = { bestDuration: 0, bestPath: [] };

        for (const child of node.children) {
            const candidate = dfs(child);
            if (candidate.bestDuration > bestChild.bestDuration) {
                bestChild = candidate;
            }
        }

        const selfDuration = node.executionTimeMs || 0;
        const total = selfDuration + bestChild.bestDuration;
        const path = node.eventId
            ? [node.eventId, ...bestChild.bestPath]
            : bestChild.bestPath;

        return { bestDuration: total, bestPath: path };
    }

    const { bestPath } = dfs(root);
    const slowPathEventIds = new Set(bestPath);

    return { nodeCount, maxExecution, slowPathEventIds };
}

/**
 * Flatten a call-tree into an ordered array of nodes (skipping the synthetic ROOT).
 *
 * @param {object|null} root
 * @returns {object[]}
 */
export function flattenEvents(root) {
    const result = [];
    function dfs(node) {
        if (!node) return;
        if (node.eventId) result.push(node);
        if (node.children) node.children.forEach(dfs);
    }
    dfs(root);
    return result;
}

/**
 * Extract the fully-qualified class name from a method signature string.
 *
 * @example
 * extractClassNameFromMethod("com.example.UserService.findById(..)")
 * // => "com.example.UserService"
 *
 * @param {string|null|undefined} methodSig
 * @returns {string|null}
 */
export function extractClassNameFromMethod(methodSig) {
    if (!methodSig || methodSig === "ROOT") return null;
    const withoutArgs = methodSig.split("(")[0];
    const lastDot = withoutArgs.lastIndexOf(".");
    if (lastDot <= 0) return null;
    return withoutArgs.substring(0, lastDot);
}

/**
 * Build per-request call-tree objects from a raw map of { requestId → TraceEvent[] }.
 * Parent–child linkage uses spanId / parentSpanId.
 *
 * @param {{ [requestId: string]: object[] }} eventsByRequest
 * @returns {{ [requestId: string]: object }}
 */
export function buildTracesFromEvents(eventsByRequest) {
    const result = {};

    Object.entries(eventsByRequest).forEach(([requestId, events]) => {
        const root = { requestId, method: "ROOT", children: [] };

        if (!events || events.length === 0) {
            result[requestId] = root;
            return;
        }

        const nodesBySpanId = new Map();

        for (const e of events) {
            const node = { ...e, children: [] };
            if (e.spanId) nodesBySpanId.set(e.spanId, node);
        }

        for (const e of events) {
            const node = nodesBySpanId.get(e.spanId);
            if (!node) continue;

            const parentSpanId = e.parentSpanId;
            if (parentSpanId && nodesBySpanId.has(parentSpanId)) {
                nodesBySpanId.get(parentSpanId).children.push(node);
            } else {
                root.children.push(node);
            }
        }

        result[requestId] = root;
    });

    return result;
}
