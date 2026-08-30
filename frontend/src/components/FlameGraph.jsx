import React, { useMemo, useState, useRef, useCallback } from "react";

/*
 * FlameGraph — Speedscope-style interactive flame chart with:
 *   • Click to zoom into any frame (click ROOT bar / breadcrumb to zoom out)
 *   • Hover tooltip showing inclusive time, self time, % of trace, risk flags
 *   • Hotspot ranking sidebar: top-5 frames by self time
 *   • Critical-path frames highlighted with a glow border
 *   • Per-frame risk chips (ERR / SLOW / SQL / WAIT / LEAK)
 *   • Color: green→red heat by self-time ratio relative to total trace
 */
export default function FlameGraph({ data }) {
    const [zoomNode, setZoomNode]   = useState(null); // currently zoomed bar
    const [hoveredBar, setHoveredBar] = useState(null); // { bar, mouseX, mouseY }
    const containerRef = useRef(null);

    const { bars, totalMs } = useMemo(() => buildBars(data), [data]);

    if (!data || bars.length === 0) {
        return (
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                height: 200, color: "#4b5563", fontSize: 13,
            }}>
                No trace data to display.
            </div>
        );
    }

    // ── zoom window ──────────────────────────────────────────────────────────
    const viewStart = zoomNode ? zoomNode.startMs : 0;
    const viewEnd   = zoomNode ? zoomNode.startMs + zoomNode.durationMs : totalMs;
    const viewDur   = Math.max(viewEnd - viewStart, 1);

    // Only show bars that overlap the current view window
    const visibleBars = bars.filter(b => b.startMs < viewEnd && b.startMs + b.durationMs > viewStart);

    // ── hotspot ranking (by self time) ───────────────────────────────────────
    const hotspots = useMemo(() => {
        const byCls = new Map();
        bars.forEach(b => {
            const existing = byCls.get(b.method) ?? { method: b.method, selfMs: 0, count: 0, hasError: false, isSlowPath: false };
            existing.selfMs += b.selfMs;
            existing.count  += 1;
            if (b.status === "ERROR" || b.hasError) existing.hasError = true;
            if (b.isOnCriticalPath) existing.isSlowPath = true;
            byCls.set(b.method, existing);
        });
        return [...byCls.values()]
            .sort((a, b) => b.selfMs - a.selfMs)
            .slice(0, 5);
    }, [bars]);

    const ROW_H = 26;
    const maxDepth = visibleBars.length > 0 ? Math.max(...visibleBars.map(b => b.depth)) : 0;
    const svgH = (maxDepth + 1) * ROW_H + 8;

    // Breadcrumb path
    const breadcrumbs = useMemo(() => {
        if (!zoomNode) return [];
        // Walk up via parentKey
        const crumbs = [zoomNode];
        const byKey  = new Map(bars.map(b => [b.key, b]));
        let cur = zoomNode;
        while (cur.parentKey) {
            const p = byKey.get(cur.parentKey);
            if (!p) break;
            crumbs.unshift(p);
            cur = p;
        }
        return crumbs;
    }, [zoomNode, bars]);

    const handleBarClick = useCallback((bar) => {
        setZoomNode(prev => (prev?.key === bar.key ? null : bar));
        setHoveredBar(null);
    }, []);

    const handleMouseMove = useCallback((e, bar) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        setHoveredBar({ bar, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top });
    }, []);

    const handleMouseLeave = useCallback(() => setHoveredBar(null), []);

    return (
        <div style={{ width: "100%", fontFamily: "system-ui,sans-serif", display: "flex", flexDirection: "column", height: "100%", minHeight: 380 }}>
            {/* ── toolbar / breadcrumb ─────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 12px", borderBottom: "1px solid rgba(55,65,81,0.5)",
                background: "rgba(13,21,39,0.8)", flexWrap: "wrap",
                flexShrink: 0,
            }}>
                <span style={{ fontSize: 11, color: "#64748b", marginRight: 4 }}>
                    {zoomNode ? "Zoomed:" : "Flame chart"} •
                </span>
                {zoomNode && (
                    <button onClick={() => setZoomNode(null)} style={crumbBtn(false)}>
                        ← All frames
                    </button>
                )}
                {breadcrumbs.map((b, i) => (
                    <React.Fragment key={b.key}>
                        {i > 0 && <span style={{ color: "#374151", fontSize: 11 }}>/</span>}
                        <button onClick={() => setZoomNode(b)} style={crumbBtn(i === breadcrumbs.length - 1)}>
                            {simpleName(b.method)}
                        </button>
                    </React.Fragment>
                ))}
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#374151" }}>
                    {Math.round(viewDur)}ms shown  ·  {visibleBars.length} frames  ·  click to zoom
                </span>
            </div>

            <div style={{ display: "flex", gap: 0, flex: 1, overflow: "hidden", minHeight: 0 }}>
                {/* ── main chart ─────────────────────────────────────────── */}
                <div
                    ref={containerRef}
                    style={{ flex: 1, position: "relative", overflow: "auto" }}
                    onMouseLeave={handleMouseLeave}
                >
                    <svg
                        width="100%"
                        height={svgH}
                        style={{ display: "block" }}
                        role="img"
                        aria-label="Flame graph"
                    >
                        <defs>
                            <filter id="fg-glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="2" result="blur" />
                                <feFlood floodColor="#f97316" floodOpacity="0.8" result="c" />
                                <feComposite in="c" in2="blur" operator="in" result="sh" />
                                <feMerge><feMergeNode in="sh" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>

                        {visibleBars.map(bar => {
                            const clippedStart = Math.max(bar.startMs, viewStart);
                            const clippedEnd   = Math.min(bar.startMs + bar.durationMs, viewEnd);
                            const xPct  = ((clippedStart - viewStart) / viewDur) * 100;
                            const wPct  = Math.max(((clippedEnd - clippedStart) / viewDur) * 100, 0.15);
                            const yPx   = bar.depth * ROW_H + 4;
                            const hPx   = ROW_H - 2;
                            const isCritical = bar.isOnCriticalPath;
                            const fillCol = barFill(bar, totalMs);
                            const isHovered = hoveredBar?.bar?.key === bar.key;
                            const isZoomed  = zoomNode?.key === bar.key;

                            return (
                                <g
                                    key={bar.key}
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleBarClick(bar)}
                                    onMouseMove={e => handleMouseMove(e, bar)}
                                >
                                    <rect
                                        x={`${xPct}%`} y={yPx}
                                        width={`${wPct}%`} height={hPx}
                                        rx={3}
                                        fill={fillCol}
                                        stroke={
                                            bar.status === "ERROR" || bar.hasError ? "#ef4444" :
                                            isCritical ? "#f97316" :
                                            isHovered || isZoomed ? "#94a3b8" :
                                            "rgba(255,255,255,0.06)"
                                        }
                                        strokeWidth={isCritical || bar.status === "ERROR" ? 1.5 : isHovered ? 1 : 0.5}
                                        filter={isCritical ? "url(#fg-glow)" : undefined}
                                        opacity={isHovered ? 1 : 0.88}
                                    />
                                    {/* Risk stripe on left edge */}
                                    {(bar.status === "ERROR" || bar.contentionRisk || bar.resourceLeakSuspicion) && (
                                        <rect
                                            x={`${xPct}%`} y={yPx}
                                            width={3} height={hPx}
                                            rx={2}
                                            fill={
                                                bar.status === "ERROR" ? "#ef4444" :
                                                bar.contentionRisk ? "#a78bfa" : "#fbbf24"
                                            }
                                        />
                                    )}
                                    {/* Label — only when wide enough */}
                                    {wPct > 5 && (
                                        <foreignObject
                                            x={`${xPct}%`} y={yPx + 2}
                                            width={`${wPct}%`} height={hPx - 2}
                                            style={{ pointerEvents: "none", overflow: "hidden" }}
                                        >
                                            <div xmlns="http://www.w3.org/1999/xhtml" style={{
                                                display: "flex", alignItems: "center",
                                                padding: "0 5px", height: "100%",
                                                overflow: "hidden", whiteSpace: "nowrap",
                                            }}>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 600,
                                                    color: "#f1f5f9",
                                                    overflow: "hidden", textOverflow: "ellipsis",
                                                }}>
                                                    {simpleName(bar.method)}
                                                </span>
                                                {wPct > 10 && (
                                                    <span style={{ fontSize: 9, color: "rgba(241,245,249,0.55)", marginLeft: 5, flexShrink: 0 }}>
                                                        {bar.selfMs}ms self
                                                    </span>
                                                )}
                                                {/* chips */}
                                                {wPct > 15 && (bar.status === "ERROR" || bar.contentionRisk || bar.slowPath || bar.isOnCriticalPath) && (
                                                    <span style={{ marginLeft: 4, display: "flex", gap: 2, flexShrink: 0 }}>
                                                        {(bar.status === "ERROR" || bar.hasError) && <Chip label="ERR"  color="#ef4444" />}
                                                        {bar.contentionRisk                       && <Chip label="WAIT" color="#a78bfa" />}
                                                        {bar.slowPath && bar.eventType !== "SQL"   && <Chip label="SLOW" color="#f97316" />}
                                                        {bar.isOnCriticalPath                     && <Chip label="★"   color="#06b6d4" />}
                                                    </span>
                                                )}
                                            </div>
                                        </foreignObject>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {/* ── hover tooltip ─────────────────────────────────── */}
                    {hoveredBar && (
                        <Tooltip bar={hoveredBar.bar} x={hoveredBar.mouseX} y={hoveredBar.mouseY} totalMs={totalMs} />
                    )}
                </div>

                {/* ── hotspot sidebar ────────────────────────────────────── */}
                <div style={{
                    width: 200, flexShrink: 0,
                    borderLeft: "1px solid rgba(55,65,81,0.5)",
                    background: "rgba(8,14,31,0.6)",
                    padding: "10px 10px",
                    overflowY: "auto",
                }}>
                    <div style={{
                        fontSize: 10, fontWeight: 700, color: "#64748b",
                        letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 8,
                    }}>
                        Top Hotspots
                    </div>
                    {hotspots.map((h, i) => {
                        const pct = Math.round((h.selfMs / Math.max(totalMs, 1)) * 100);
                        const bar = (pct / 100);
                        const col = bar > 0.5 ? "#ef4444" : bar > 0.2 ? "#f97316" : "#22c55e";
                        return (
                            <div key={h.method} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                    <span style={{ fontSize: 10, color: "#e2e8f0", fontWeight: 600 }}>
                                        #{i + 1} {simpleName(h.method)}
                                    </span>
                                    <span style={{ fontSize: 9, color: col, fontWeight: 700 }}>{pct}%</span>
                                </div>
                                <div style={{ height: 3, borderRadius: 2, background: "rgba(55,65,81,0.4)" }}>
                                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: col }} />
                                </div>
                                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>
                                    {h.selfMs}ms self · {h.count} call{h.count > 1 ? "s" : ""}
                                    {h.hasError && <span style={{ color: "#ef4444", marginLeft: 4 }}>ERR</span>}
                                    {h.isSlowPath && <span style={{ color: "#f97316", marginLeft: 4 }}>CRIT</span>}
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ marginTop: 12, borderTop: "1px solid rgba(55,65,81,0.4)", paddingTop: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 6 }}>
                            Legend
                        </div>
                        {[
                            { color: "#22c55e", label: "Fast" },
                            { color: "#f97316", label: "Slow" },
                            { color: "#ef4444", label: "Error" },
                            { color: "#38bdf8", label: "SQL" },
                            { color: "#a78bfa", label: "Wait / Contention" },
                        ].map(({ color, label }) => (
                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                                <span style={{ fontSize: 10, color: "#94a3b8" }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── sub-components ───────────────────────────────────────────────────────────

function Chip({ label, color }) {
    return (
        <span style={{
            fontSize: 7.5, fontWeight: 700, color,
            background: color + "22", border: `1px solid ${color}66`,
            borderRadius: 2, padding: "0 3px", lineHeight: "11px",
        }}>{label}</span>
    );
}

function Tooltip({ bar, x, y, totalMs }) {
    const pctOfTotal = ((bar.durationMs / Math.max(totalMs, 1)) * 100).toFixed(1);
    const selfPct    = ((bar.selfMs / Math.max(totalMs, 1)) * 100).toFixed(1);
    const flags = [
        bar.status === "ERROR" || bar.hasError ? "ERROR" : null,
        bar.contentionRisk ? "CONTENTION / WAIT" : null,
        bar.slowPath ? "SLOW PATH" : null,
        bar.isOnCriticalPath ? "CRITICAL PATH" : null,
        bar.resourceLeakSuspicion ? "RESOURCE LEAK?" : null,
        bar.eventType === "SQL" ? "SQL QUERY" : null,
    ].filter(Boolean);

    const COLORS = {
        ERROR: "#ef4444",
        "CONTENTION / WAIT": "#a78bfa",
        "SLOW PATH": "#f97316",
        "CRITICAL PATH": "#06b6d4",
        "RESOURCE LEAK?": "#fbbf24",
        "SQL QUERY": "#38bdf8",
    };

    return (
        <div style={{
            position: "absolute", left: Math.min(x + 12, 520), top: Math.max(y - 10, 0),
            maxWidth: 300, zIndex: 50, pointerEvents: "none",
            background: "rgba(8,14,31,0.97)", border: "1px solid rgba(99,120,160,0.4)",
            borderRadius: 8, padding: "10px 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
        }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", marginBottom: 6, wordBreak: "break-word" }}>
                {simpleName(bar.method)}
            </div>
            <div style={{ fontSize: 9, color: "#64748b", marginBottom: 8 }}>
                {bar.method.replace(/\(.*\)$/, "")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: 8 }}>
                <TooltipRow label="Inclusive" value={`${bar.durationMs}ms (${pctOfTotal}%)`} />
                <TooltipRow label="Self time"  value={`${bar.selfMs}ms (${selfPct}%)`} />
                <TooltipRow label="Depth"      value={`Level ${bar.depth}`} />
                <TooltipRow label="Status"     value={bar.status || "SUCCESS"} color={bar.status === "ERROR" ? "#ef4444" : "#22c55e"} />
                {bar.eventType === "SQL" && <TooltipRow label="SQL" value={bar.slowQuery ? "slow (≥500ms)" : "fast"} color={bar.slowQuery ? "#f97316" : "#38bdf8"} />}
            </div>
            {flags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {flags.map(f => (
                        <span key={f} style={{
                            fontSize: 9, fontWeight: 700, color: COLORS[f],
                            background: COLORS[f] + "22", border: `1px solid ${COLORS[f]}55`,
                            borderRadius: 3, padding: "1px 5px",
                        }}>{f}</span>
                    ))}
                </div>
            )}
            {bar.sql && (
                <div style={{
                    marginTop: 8, padding: "5px 8px", borderRadius: 5,
                    background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)",
                    fontSize: 9, color: "#7dd3fc", wordBreak: "break-word",
                }}>
                    {bar.sql.slice(0, 140)}{bar.sql.length > 140 ? "…" : ""}
                </div>
            )}
            <div style={{ marginTop: 8, fontSize: 9, color: "#374151", borderTop: "1px solid rgba(55,65,81,0.4)", paddingTop: 6 }}>
                Click to zoom · double-click parent to zoom out
            </div>
        </div>
    );
}

function TooltipRow({ label, value, color }) {
    return (
        <div>
            <div style={{ fontSize: 9, color: "#475569", marginBottom: 1 }}>{label}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: color ?? "#cbd5e1" }}>{value}</div>
        </div>
    );
}

// ── build bars ───────────────────────────────────────────────────────────────

function buildBars(root) {
    if (!root) return { bars: [], totalMs: 1 };

    const traceStartMs = findEarliestMs(root);
    const bars = [];

    function visit(node, depth, parentStartMs, parentEndMs, parentKey) {
        const durationMs  = Math.max(node.executionTimeMs ?? node.executionTime ?? 1, 1);
        const nodeStartMs = toRelativeMs(node, traceStartMs, parentStartMs);
        const cStart = Math.max(nodeStartMs, parentStartMs);
        const cEnd   = Math.min(cStart + durationMs, parentEndMs);
        const cDur   = Math.max(cEnd - cStart, 1);

        const childTotal = (node.children || []).reduce(
            (s, c) => s + Math.max(c.executionTimeMs ?? c.executionTime ?? 0, 0), 0
        );
        const selfMs = Math.max(cDur - Math.min(childTotal, cDur), 0);

        const key = node.eventId || node.spanId || `${node.method}-${depth}-${cStart}`;

        if (node.method && node.method !== "ROOT") {
            bars.push({
                key,
                parentKey,
                method:   node.methodName ?? node.method,
                sql:      node.sql,
                status:   node.status,
                hasError: node.hasError,
                eventType:            node.eventType,
                slowPath:             node.slowPath,
                slowQuery:            node.slowQuery,
                isOnCriticalPath:     node.isOnCriticalPath,
                contentionRisk:       node.contentionRisk,
                resourceLeakSuspicion: node.resourceLeakSuspicion,
                depth,
                startMs:    cStart,
                durationMs: cDur,
                selfMs,
            });
        }

        let childOffset = cStart;
        for (const child of node.children || []) {
            visit(child, depth + 1, childOffset, cEnd, key);
            childOffset += Math.max(child.executionTimeMs ?? child.executionTime ?? 1, 1);
        }
    }

    const totalMs = computeTotal(root);
    for (const child of root.children || []) {
        visit(child, 0, 0, totalMs, null);
    }

    return {
        bars,
        totalMs: Math.max(totalMs, ...bars.map(b => b.startMs + b.durationMs), 1),
    };
}

function findEarliestMs(root) {
    let earliest = Infinity;
    function walk(n) {
        if (!n) return;
        const t = parseTs(n);
        if (t != null && t < earliest) earliest = t;
        (n.children || []).forEach(walk);
    }
    walk(root);
    return Number.isFinite(earliest) ? earliest : 0;
}

function parseTs(node) {
    if (node.startTime != null && node.startTime > 1e12) return node.startTime;
    if (typeof node.timestamp === "number") return node.timestamp;
    if (typeof node.timestamp === "string") {
        const p = Date.parse(node.timestamp);
        return Number.isNaN(p) ? null : p;
    }
    return null;
}

function toRelativeMs(node, traceStartMs, fallback) {
    const t = parseTs(node);
    return t != null ? Math.max(t - traceStartMs, 0) : fallback;
}

function computeTotal(root) {
    let max = 0;
    function walk(n, offset) {
        const d = Math.max(n.executionTimeMs ?? n.executionTime ?? 0, 0);
        max = Math.max(max, offset + d);
        let cursor = offset;
        for (const c of n.children || []) {
            walk(c, cursor);
            cursor += Math.max(c.executionTimeMs ?? c.executionTime ?? 0, 0);
        }
    }
    let cursor = 0;
    for (const c of root.children || []) {
        walk(c, cursor);
        cursor += Math.max(c.executionTimeMs ?? c.executionTime ?? 0, 0);
    }
    return Math.max(max, cursor, 1);
}

function barFill(bar, totalMs) {
    if (bar.status === "ERROR" || bar.hasError) return "#7f1d1d";
    if (bar.eventType === "SQL") {
        if (bar.slowQuery) return "#78350f";
        return "#164e63";
    }
    if (bar.contentionRisk) return "#3b0764";
    // Heat: self time as % of total → green→red
    const ratio = Math.min(bar.selfMs / Math.max(totalMs * 0.5, 1), 1);
    const r = Math.round(22  + (190 - 22)  * ratio);
    const g = Math.round(197 + (29  - 197) * ratio);
    const b = Math.round(94  + (36  - 94)  * ratio);
    return `rgb(${r},${g},${b})`;
}

function simpleName(method) {
    if (!method) return "unknown";
    const stripped = method.replace(/\(.*\)$/, "");
    const dot = stripped.lastIndexOf(".");
    return dot === -1 ? stripped : stripped.slice(dot + 1);
}

function crumbBtn(active) {
    return {
        background: active ? "rgba(56,189,248,0.15)" : "transparent",
        border: active ? "1px solid rgba(56,189,248,0.3)" : "1px solid transparent",
        color: active ? "#38bdf8" : "#94a3b8",
        borderRadius: 5, padding: "2px 8px", fontSize: 11,
        cursor: "pointer", fontWeight: active ? 700 : 400,
    };
}
