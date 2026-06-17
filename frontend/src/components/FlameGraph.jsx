import React, { useMemo } from "react";

export default function FlameGraph({ data }) {
    const bars = useMemo(() => buildBars(data), [data]);

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

    const maxEnd = Math.max(...bars.map((bar) => bar.endMs), 1);
    const maxDepth = Math.max(...bars.map((bar) => bar.depth), 0);
    const rowHeight = 28;
    const graphHeight = (maxDepth + 1) * rowHeight + 24;

    return (
        <div style={{ width: "100%", overflowX: "auto", overflowY: "hidden" }}>
            <svg width="100%" height={graphHeight} viewBox={`0 0 1000 ${graphHeight}`}>
                {bars.map((bar) => {
                    const x = (bar.startMs / maxEnd) * 980 + 10;
                    const width = Math.max((bar.durationMs / maxEnd) * 980, 2);
                    const y = bar.depth * rowHeight + 8;

                    return (
                        <g key={bar.eventId || `${bar.method}-${bar.depth}-${bar.startMs}`}>
                            <rect
                                x={x}
                                y={y}
                                width={width}
                                height={22}
                                rx={4}
                                fill={
                                    bar.status === "ERROR"
                                        ? "#7f1d1d"
                                        : colorForDuration(bar.durationMs)
                                }
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth={0.8}
                            />
                            {width > 70 && (
                                <text x={x + 6} y={y + 14} fontSize="10" fill="#e5e7eb">
                                    {truncate(simpleName(bar.method), 22)} ({bar.durationMs}ms)
                                </text>
                            )}
                            <title>
                                {`${bar.method}\nDuration: ${bar.durationMs}ms\nStatus: ${
                                    bar.status || "SUCCESS"
                                }`}
                            </title>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function buildBars(root) {
    if (!root || !root.children) return [];
    const bars = [];
    let cursor = 0;

    function dfs(node, depth, inheritedStart) {
        const durationMs = Math.max(node.executionTimeMs || 1, 1);
        const startMs = inheritedStart;
        const endMs = startMs + durationMs;

        if (node.method && node.method !== "ROOT") {
            bars.push({
                eventId: node.eventId,
                method: node.method,
                status: node.status,
                depth,
                startMs,
                endMs,
                durationMs
            });
        }

        let childCursor = startMs;
        (node.children || []).forEach((child) => {
            dfs(child, depth + 1, childCursor);
            childCursor += Math.max(child.executionTimeMs || 1, 1);
        });
    }

    (root.children || []).forEach((child) => {
        dfs(child, 0, cursor);
        cursor += Math.max(child.executionTimeMs || 1, 1);
    });

    return bars;
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

