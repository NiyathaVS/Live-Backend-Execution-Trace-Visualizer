import React, { useMemo } from "react";

/**
 * Speedscope-style flame graph: each bar's horizontal position and width reflect
 * wall-clock start offset and inclusive duration. Children nest within the
 * parent's time window rather than being laid out sequentially.
 */
export default function FlameGraph({ data }) {
    const { bars, maxEnd, maxDepth } = useMemo(() => buildInclusiveBars(data), [data]);

    if (!data || bars.length === 0) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#6b7280",
                    fontSize: 12
                }}
            >
                No flame graph data.
            </div>
        );
    }

    const rowHeight = 28;
    const graphHeight = (maxDepth + 1) * rowHeight + 24;
    const chartWidth = 1000;

    return (
        <div style={{ width: "100%", overflowX: "auto", overflowY: "hidden" }}>
            <svg
                width="100%"
                height={graphHeight}
                viewBox={`0 0 ${chartWidth} ${graphHeight}`}
                role="img"
                aria-label="Flame graph showing inclusive execution time per method"
            >
                {bars.map((bar) => {
                    const x = (bar.startMs / maxEnd) * (chartWidth - 20) + 10;
                    const width = Math.max((bar.durationMs / maxEnd) * (chartWidth - 20), 2);
                    const y = bar.depth * rowHeight + 8;

                    return (
                        <g key={bar.key}>
                            <rect
                                x={x}
                                y={y}
                                width={width}
                                height={22}
                                rx={4}
                                fill={
                                    bar.status === "ERROR"
                                        ? "#991b1b"
                                        : colorForDuration(bar.durationMs)
                                }
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth={0.8}
                            />
                            {width > 70 && (
                                <text x={x + 6} y={y + 14} fontSize="10" fill="#f9fafb">
                                    {truncate(simpleName(bar.method), 22)} ({bar.durationMs}ms)
                                </text>
                            )}
                            <title>
                                {`${bar.method}\nInclusive: ${bar.durationMs}ms\nSelf: ${bar.selfMs}ms\nStart: ${bar.startMs}ms\nStatus: ${bar.status || "SUCCESS"}`}
                            </title>
                        </g>
                    );
                })}
            </svg>
            <div style={{ fontSize: 10, color: "#6b7280", padding: "4px 10px" }}>
                Inclusive-width flame graph (Speedscope semantics): bar width = wall-clock span, nested within parent.
            </div>
        </div>
    );
}

function buildInclusiveBars(root) {
    if (!root) return { bars: [], maxEnd: 1, maxDepth: 0 };

    const traceStartMs = findTraceStartMs(root);
    const bars = [];

    function visit(node, depth, parentStartMs, parentEndMs) {
        const durationMs = Math.max(node.executionTimeMs ?? node.executionTime ?? 1, 1);
        const nodeStartMs = toRelativeStartMs(node, traceStartMs, parentStartMs);
        const clampedStart = Math.max(nodeStartMs, parentStartMs);
        const clampedEnd = Math.min(clampedStart + durationMs, parentEndMs);
        const clampedDuration = Math.max(clampedEnd - clampedStart, 1);

        const childTotal = (node.children || []).reduce(
            (sum, c) => sum + Math.max(c.executionTimeMs ?? c.executionTime ?? 0, 0),
            0
        );
        const selfMs = Math.max(clampedDuration - Math.min(childTotal, clampedDuration), 0);

        if (node.method && node.method !== "ROOT") {
            bars.push({
                key: node.eventId || node.spanId || `${node.method}-${depth}-${clampedStart}`,
                eventId: node.eventId,
                method: node.methodName ?? node.method,
                status: node.status,
                depth,
                startMs: clampedStart,
                durationMs: clampedDuration,
                selfMs
            });
        }

        let childOffset = clampedStart;
        for (const child of node.children || []) {
            visit(child, depth + 1, childOffset, clampedEnd);
            childOffset += Math.max(child.executionTimeMs ?? child.executionTime ?? 1, 1);
        }
    }

    const rootDuration = computeTraceDuration(root);
    for (const child of root.children || []) {
        visit(child, 0, 0, rootDuration);
    }

    const maxEnd = Math.max(rootDuration, ...bars.map((b) => b.startMs + b.durationMs), 1);
    const maxDepth = bars.length > 0 ? Math.max(...bars.map((b) => b.depth)) : 0;

    return { bars, maxEnd, maxDepth };
}

function findTraceStartMs(root) {
    let earliest = Infinity;
    function walk(node) {
        if (!node) return;
        const t = parseTimestampMs(node);
        if (t != null && t < earliest) earliest = t;
        (node.children || []).forEach(walk);
    }
    walk(root);
    return Number.isFinite(earliest) ? earliest : 0;
}

function parseTimestampMs(node) {
    if (node.startTime != null && node.startTime > 1e12) return node.startTime;
    if (typeof node.timestamp === "number") return node.timestamp;
    if (typeof node.timestamp === "string") {
        const parsed = Date.parse(node.timestamp);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
}

function toRelativeStartMs(node, traceStartMs, fallback) {
    const t = parseTimestampMs(node);
    if (t != null) return Math.max(t - traceStartMs, 0);
    return fallback;
}

function computeTraceDuration(root) {
    let max = 0;
    function walk(node, offset) {
        const dur = Math.max(node.executionTimeMs ?? node.executionTime ?? 0, 0);
        max = Math.max(max, offset + dur);
        let cursor = offset;
        for (const child of node.children || []) {
            walk(child, cursor);
            cursor += Math.max(child.executionTimeMs ?? child.executionTime ?? 0, 0);
        }
    }
    let cursor = 0;
    for (const child of root.children || []) {
        walk(child, cursor);
        cursor += Math.max(child.executionTimeMs ?? child.executionTime ?? 0, 0);
    }
    return Math.max(max, cursor, 1);
}

function colorForDuration(durationMs) {
    const ratio = Math.min(durationMs / 250, 1);
    const r = Math.round(34 + (239 - 34) * ratio);
    const g = Math.round(197 + (68 - 197) * ratio);
    const b = Math.round(94 + (68 - 94) * ratio);
    return `rgb(${r},${g},${b})`;
}

function simpleName(method) {
    if (!method) return "unknown";
    const idx = method.lastIndexOf(".");
    return idx === -1 ? method : method.slice(idx + 1);
}

function truncate(value, max) {
    if (!value) return "";
    return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
