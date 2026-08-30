import React from "react";
import { COLORS, SHADOWS, Badge, RiskBadges, DurationBar } from "../theme.jsx";

export default function NodeDetailPanel({ node, maxExecution, tab, onTab, onClose, tabBtn, flatEvents }) {
    const isSql  = node.eventType === "SQL" || (node.method || "").startsWith("SQL:");
    const cpuPct = node.executionTimeMs > 0 && node.threadCpuTimeMs > 0
        ? Math.round((node.threadCpuTimeMs / node.executionTimeMs) * 100)
        : null;

    const styledTab = (active) => ({
        padding: "6px 14px", borderRadius: 8,
        fontSize: 11, fontWeight: 700, cursor: "pointer",
        border: active ? `1px solid ${COLORS.blue}44` : "1px solid transparent",
        background: active
            ? `linear-gradient(135deg, ${COLORS.blue}18, ${COLORS.cyan}10)`
            : "transparent",
        color: active ? COLORS.blue : COLORS.muted,
        boxShadow: active ? `0 0 12px ${COLORS.blueGlow}` : "none",
        transition: "all 0.2s",
        letterSpacing: 0.2,
    });

    return (
        <div style={{
            borderRadius: 16,
            border: `1px solid ${COLORS.borderMid}`,
            background: COLORS.glassBright,
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            boxShadow: SHADOWS.glassHover,
            overflow: "hidden",
            animation: "fadeSlideIn 0.25s ease",
        }}>
            {/* Header */}
            <div style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${COLORS.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                background: "rgba(56,189,248,0.04)",
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 12.5, fontWeight: 700, color: COLORS.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        letterSpacing: -0.3,
                    }}>
                        {isSql ? "SQL Query" : (node.methodName ?? node.method ?? "ROOT")}
                    </div>
                    <RiskBadges node={node} />
                </div>
                <button onClick={onClose} style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: "rgba(244,63,94,0.1)",
                    border: `1px solid rgba(244,63,94,0.2)`,
                    color: COLORS.muted, cursor: "pointer",
                    fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                    flexShrink: 0,
                }}>×</button>
            </div>

            {/* Tab bar */}
            <div style={{
                display: "flex", gap: 4, padding: "8px 12px",
                borderBottom: `1px solid ${COLORS.border}`,
                background: "rgba(5,12,26,0.3)",
            }}>
                {["info", "params", "stack", "sql"].map(t => (
                    <button key={t} onClick={() => onTab(t)} style={styledTab(tab === t)}>
                        {t === "info" ? "Info" : t === "params" ? "Params" : t === "stack" ? "Stack" : "SQL"}
                    </button>
                ))}
            </div>

            {/* Tab body */}
            <div style={{ padding: "14px 16px" }}>
                {tab === "info" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                        <InfoRow label="Duration" value={
                            <span style={{
                                color: node.executionTimeMs > 500 ? COLORS.red
                                     : node.executionTimeMs > 200 ? COLORS.orange
                                     : COLORS.green,
                                fontWeight: 800, fontSize: 13,
                                textShadow: `0 0 10px ${node.executionTimeMs > 500 ? COLORS.redGlow : node.executionTimeMs > 200 ? COLORS.orangeGlow : COLORS.greenGlow}`,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                {node.executionTimeMs} ms
                            </span>
                        } />
                        {cpuPct != null && (
                            <InfoRow label="CPU Time" value={
                                <span>
                                    <span style={{ color: COLORS.text, fontFamily: "'JetBrains Mono', monospace" }}>
                                        {node.threadCpuTimeMs}ms
                                    </span>
                                    <span style={{ color: cpuPct < 30 ? COLORS.muted : COLORS.orange, marginLeft: 5, fontSize: 10 }}>
                                        ({cpuPct}% of wall)
                                    </span>
                                </span>
                            } />
                        )}
                        <InfoRow label="Status" value={
                            <Badge color={node.status === "ERROR" ? COLORS.red : COLORS.green}>
                                {node.status || "SUCCESS"}
                            </Badge>
                        } />
                        <InfoRow label="Thread" value={
                            <code style={{
                                color: COLORS.blue, fontSize: 10.5,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>{node.threadName || node.threadId}</code>
                        } />
                        {node.threadState && (
                            <InfoRow label="Thread State" value={
                                <Badge color={
                                    node.threadState === "BLOCKED"                                        ? COLORS.red    :
                                    node.threadState === "WAITING" || node.threadState === "TIMED_WAITING" ? COLORS.yellow :
                                    COLORS.green
                                }>{node.threadState}</Badge>
                            } />
                        )}
                        <InfoRow label="Timestamp" value={
                            <span style={{ color: COLORS.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>{node.timestamp}</span>
                        } />
                        {node.sourceFile && node.sourceLine > 0 && (
                            <InfoRow label="Source" value={
                                <code style={{ color: COLORS.cyan, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {node.sourceFile}:{node.sourceLine}
                                </code>
                            } />
                        )}
                        {node.parentMethod && (
                            <InfoRow label="Parent" value={
                                <code style={{ color: COLORS.muted, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {node.parentMethod.split(".").pop()}
                                </code>
                            } />
                        )}
                        {isSql && (
                            <InfoRow label="Slow Query" value={
                                <Badge color={node.slowQuery ? COLORS.red : COLORS.green}>
                                    {node.slowQuery ? "YES ≥500ms" : "No"}
                                </Badge>
                            } />
                        )}
                        {node.errorType && (
                            <InfoRow label="Error Type" value={
                                <Badge color={COLORS.red}>{node.errorType}</Badge>
                            } />
                        )}
                        {node.errorMessage && (
                            <div style={{ gridColumn: "1/-1" }}>
                                <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Error Message</div>
                                <div style={{
                                    padding: "8px 12px", borderRadius: 10,
                                    background: `${COLORS.red}0d`,
                                    border: `1px solid ${COLORS.red}28`,
                                    borderLeft: `3px solid ${COLORS.red}`,
                                    color: COLORS.red, fontSize: 11, lineHeight: 1.5,
                                }}>{node.errorMessage}</div>
                            </div>
                        )}
                        <div style={{ gridColumn: "1/-1", marginTop: 4 }}>
                            <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>
                                Duration vs Slowest Span
                            </div>
                            <DurationBar ms={node.executionTimeMs} maxMs={maxExecution} />
                        </div>
                    </div>
                )}

                {tab === "params" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                            { label: "Parameters", value: JSON.stringify(node.params, null, 2) || "none", color: COLORS.blue },
                            { label: "Return Value", value: JSON.stringify(node.returnValue, null, 2) ?? "null", color: COLORS.green },
                            ...(isSql && node.sql ? [{ label: "SQL Statement", value: node.sql, color: COLORS.cyan }] : []),
                        ].map(({ label, value, color }) => (
                            <div key={label}>
                                <div style={{
                                    fontSize: 10, color: COLORS.muted, marginBottom: 6,
                                    fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6,
                                }}>{label}</div>
                                <pre style={{
                                    margin: 0, padding: "10px 12px", borderRadius: 10,
                                    background: `${color}08`,
                                    border: `1px solid ${color}20`,
                                    color: color + "dd",
                                    fontSize: 11, maxHeight: 180, overflow: "auto",
                                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                    lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                }}>{value}</pre>
                            </div>
                        ))}
                    </div>
                )}

                {tab === "stack" && (
                    node.errorStackTrace ? (
                        <pre style={{
                            margin: 0, padding: "10px 12px", borderRadius: 10,
                            background: `${COLORS.red}08`,
                            border: `1px solid ${COLORS.red}22`,
                            color: COLORS.red + "cc", fontSize: 10.5,
                            maxHeight: 320, overflow: "auto", lineHeight: 1.7,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}>{node.errorStackTrace}</pre>
                    ) : (
                        <div style={{
                            color: COLORS.muted, fontSize: 12, padding: "20px 0",
                            textAlign: "center", lineHeight: 1.7,
                        }}>
                            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>✓</div>
                            No stack trace — method completed without error.
                        </div>
                    )
                )}

                {tab === "sql" && (() => {
                    const sqlNodes = (flatEvents || []).filter(e => e.eventType === "SQL" || (e.method || "").startsWith("SQL:"));
                    if (sqlNodes.length === 0) {
                        return (
                            <div style={{ color: COLORS.muted, fontSize: 12, padding: "20px 0", textAlign: "center" }}>
                                No SQL spans in this trace.
                            </div>
                        );
                    }
                    return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                                {sqlNodes.length} SQL span{sqlNodes.length > 1 ? "s" : ""}
                            </div>
                            {sqlNodes.map((s, i) => (
                                <div key={i} style={{
                                    padding: "9px 12px", borderRadius: 10,
                                    background: s.slowQuery ? `${COLORS.red}08` : `${COLORS.blue}06`,
                                    border: `1px solid ${s.slowQuery ? COLORS.red + "30" : COLORS.border}`,
                                    borderLeft: `2px solid ${s.slowQuery ? COLORS.red : COLORS.blue}`,
                                }}>
                                    <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                                        <span style={{
                                            fontSize: 11, fontWeight: 800,
                                            color: s.slowQuery ? COLORS.red : COLORS.blue,
                                            textShadow: `0 0 8px ${s.slowQuery ? COLORS.redGlow : COLORS.blueGlow}`,
                                            fontFamily: "'JetBrains Mono', monospace",
                                        }}>{s.executionTimeMs ?? "?"}ms</span>
                                        {s.slowQuery && <Badge color={COLORS.red}>SLOW</Badge>}
                                        <span style={{ fontSize: 9, color: COLORS.muted, marginLeft: "auto", fontFamily: "monospace" }}>{s.threadName || ""}</span>
                                    </div>
                                    {s.sql && (
                                        <pre style={{
                                            margin: 0, fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace",
                                            color: COLORS.blue + "cc", whiteSpace: "pre-wrap", wordBreak: "break-word",
                                        }}>{s.sql}</pre>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div>
            <div style={{
                fontSize: 9.5, color: COLORS.muted, marginBottom: 4,
                textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
            }}>{label}</div>
            <div style={{ fontSize: 12 }}>{value}</div>
        </div>
    );
}
