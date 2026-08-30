import React, { useMemo } from "react";
import { COLORS, SHADOWS, Badge } from "../theme.jsx";

/**
 * SqlInspector — shows SQL-type nodes from the current trace,
 * grouped by query text to surface N+1 patterns.
 */
export default function SqlInspector({ flatEvents }) {
    const sqlNodes = useMemo(
        () => (flatEvents || []).filter(e => e.eventType === "SQL" || (e.method || "").startsWith("SQL:")),
        [flatEvents]
    );

    if (sqlNodes.length === 0) {
        return (
            <div style={{ color: COLORS.muted, fontSize: 12, padding: "16px 4px" }}>
                No SQL spans in this trace.
            </div>
        );
    }

    const groups = useMemo(() => {
        const map = new Map();
        for (const node of sqlNodes) {
            const raw = node.sql || node.method || "unknown";
            const key = raw.replace(/\s+/g, " ").trim();
            if (!map.has(key)) map.set(key, { sql: key, nodes: [], totalMs: 0 });
            const g = map.get(key);
            g.nodes.push(node);
            g.totalMs += node.executionTimeMs || 0;
        }
        return [...map.values()].sort((a, b) => b.nodes.length - a.nodes.length);
    }, [sqlNodes]);

    const totalSqlMs = sqlNodes.reduce((s, n) => s + (n.executionTimeMs || 0), 0);

    return (
        <div>
            {/* summary stats */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
                gap: 8, marginBottom: 16,
            }}>
                <StatCard label="SQL spans"    value={sqlNodes.length}    color={COLORS.blue} />
                <StatCard label="Total time"   value={`${totalSqlMs}ms`}  color={totalSqlMs > 500 ? COLORS.red : COLORS.green} />
                <StatCard label="Unique queries" value={groups.length}    color={COLORS.purple} />
                {groups.some(g => g.nodes.length > 2) && (
                    <StatCard
                        label="N+1 risk groups"
                        value={groups.filter(g => g.nodes.length > 2).length}
                        color={COLORS.orange}
                        warn
                    />
                )}
            </div>

            {/* query groups */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {groups.map((g, i) => {
                    const isNPlus    = g.nodes.length > 2;
                    const isSlowQuery = g.nodes.some(n => n.slowQuery);
                    const accentColor = isNPlus ? COLORS.orange : isSlowQuery ? COLORS.red : COLORS.borderMid;
                    const bgColor     = isNPlus ? `${COLORS.orange}09` : `${COLORS.surfaceHi}`;

                    return (
                        <div key={i} style={{
                            borderRadius: 10,
                            border: `1px solid ${accentColor}`,
                            background: bgColor,
                            overflow: "hidden",
                            boxShadow: isNPlus ? `0 0 14px ${COLORS.orangeGlow}` : "none",
                        }}>
                            {/* header row */}
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "7px 12px",
                                borderBottom: `1px solid ${accentColor}44`,
                                background: isNPlus ? `${COLORS.orange}14` : COLORS.glass,
                                backdropFilter: "blur(6px)",
                            }}>
                                {isNPlus && (
                                    <span style={{
                                        padding: "2px 7px", borderRadius: 4,
                                        fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
                                        background: `${COLORS.orange}30`, color: COLORS.orange,
                                        border: `1px solid ${COLORS.orange}55`, flexShrink: 0,
                                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                        boxShadow: `0 0 6px ${COLORS.orangeGlow}`,
                                    }}>N+1</span>
                                )}
                                {isSlowQuery && (
                                    <span style={{
                                        padding: "2px 7px", borderRadius: 4,
                                        fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
                                        background: `${COLORS.red}25`, color: COLORS.red,
                                        border: `1px solid ${COLORS.red}55`, flexShrink: 0,
                                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    }}>SLOW</span>
                                )}
                                <span style={{
                                    fontSize: 10.5, color: COLORS.textSoft, fontWeight: 600,
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                }}>
                                    {g.nodes.length}× call{g.nodes.length > 1 ? "s" : ""}
                                </span>
                                <span style={{ fontSize: 10, color: COLORS.muted }}>·</span>
                                <span style={{
                                    fontSize: 10.5, color: totalColor(g.totalMs), fontWeight: 700,
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                }}>
                                    {g.totalMs}ms total
                                </span>
                                <span style={{
                                    fontSize: 10, color: COLORS.muted, marginLeft: "auto",
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                }}>
                                    avg {Math.round(g.totalMs / g.nodes.length)}ms
                                </span>
                            </div>

                            {/* SQL text */}
                            <pre style={{
                                margin: 0, padding: "10px 14px",
                                fontSize: 10.5,
                                fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
                                color: COLORS.blue,
                                background: "transparent",
                                whiteSpace: "pre-wrap", wordBreak: "break-word",
                                maxHeight: 110, overflow: "auto",
                                lineHeight: 1.65,
                                textShadow: `0 0 20px ${COLORS.blueGlow}`,
                            }}>{g.sql}</pre>

                            {/* per-call timing chips */}
                            {g.nodes.length > 1 && (
                                <div style={{
                                    padding: "4px 12px 10px",
                                    display: "flex", flexWrap: "wrap", gap: 5,
                                }}>
                                    {g.nodes.map((n, j) => {
                                        const ms = n.executionTimeMs || 0;
                                        const chipColor = ms > 200 ? COLORS.red : ms > 50 ? COLORS.orange : COLORS.muted;
                                        return (
                                            <span key={j} style={{
                                                padding: "2px 8px", borderRadius: 5,
                                                fontSize: 9.5,
                                                background: ms > 200 ? `${COLORS.red}18` : COLORS.bg,
                                                color: chipColor,
                                                border: `1px solid ${chipColor}30`,
                                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                                fontVariantNumeric: "tabular-nums",
                                            }}>
                                                #{j + 1} {ms}ms
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, warn }) {
    return (
        <div style={{
            padding: "10px 12px",
            borderRadius: 9,
            background: warn ? `${color}10` : COLORS.surfaceHi,
            border: `1px solid ${color}${warn ? "40" : "20"}`,
            textAlign: "center",
            boxShadow: warn ? `0 0 12px ${color}22` : "none",
        }}>
            <div style={{
                fontSize: 17, fontWeight: 800, color,
                lineHeight: 1, marginBottom: 4,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 14px ${color}55`,
            }}>{value}</div>
            <div style={{
                fontSize: 9.5, color: COLORS.muted,
                textTransform: "uppercase", letterSpacing: 0.8,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}>{label}</div>
        </div>
    );
}

function totalColor(ms) {
    if (ms > 1000) return COLORS.red;
    if (ms > 200)  return COLORS.orange;
    return COLORS.green;
}
