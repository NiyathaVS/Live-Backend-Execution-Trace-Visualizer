import React from "react";
import { COLORS, Badge, RiskBadges, DurationBar } from "../theme.jsx";

export default function NodeDetailPanel({ node, maxExecution, tab, onTab, onClose, tabBtn }) {
    const isSql   = node.eventType === "SQL" || (node.method || "").startsWith("SQL:");
    const cpuPct  = node.executionTimeMs > 0 && node.threadCpuTimeMs > 0
        ? Math.round((node.threadCpuTimeMs / node.executionTimeMs) * 100)
        : null;

    return (
        <div style={{
            borderRadius: 12, border: `1px solid ${COLORS.borderBright}`,
            background: COLORS.surfaceHi, overflow: "hidden",
        }}>
            {/* header */}
            <div style={{
                padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`,
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
            }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 12, fontWeight: 700, color: COLORS.text,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                        {isSql ? "SQL Query" : (node.methodName ?? node.method ?? "ROOT")}
                    </div>
                    <RiskBadges node={node} />
                </div>
                <button onClick={onClose} style={{
                    background: "none", border: "none",
                    color: COLORS.muted, cursor: "pointer", fontSize: 16,
                }}>×</button>
            </div>

            {/* tab bar */}
            <div style={{ display: "flex", gap: 4, padding: "8px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                {["info", "params", "stack"].map(t => (
                    <button key={t} onClick={() => onTab(t)} style={tabBtn(tab === t)}>
                        {t === "info" ? "Info" : t === "params" ? "Params / Return" : "Stack Trace"}
                    </button>
                ))}
            </div>

            {/* tab body */}
            <div style={{ padding: "12px 14px" }}>
                {tab === "info" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                        <InfoRow label="Duration" value={
                            <span style={{
                                color: node.executionTimeMs > 500 ? COLORS.red
                                     : node.executionTimeMs > 200 ? COLORS.orange
                                     : COLORS.green,
                                fontWeight: 700,
                            }}>
                                {node.executionTimeMs} ms
                            </span>
                        } />
                        {cpuPct != null && (
                            <InfoRow label="CPU time" value={
                                <span>
                                    {node.threadCpuTimeMs}ms
                                    <span style={{ color: cpuPct < 30 ? COLORS.muted : COLORS.orange, marginLeft: 4 }}>
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
                            <code style={{ color: COLORS.blue }}>{node.threadName || node.threadId}</code>
                        } />
                        {node.threadState && (
                            <InfoRow label="Thread state" value={
                                <Badge color={
                                    node.threadState === "BLOCKED"                                    ? COLORS.red    :
                                    node.threadState === "WAITING" || node.threadState === "TIMED_WAITING" ? COLORS.yellow :
                                    COLORS.green
                                }>{node.threadState}</Badge>
                            } />
                        )}
                        <InfoRow label="Timestamp" value={
                            <span style={{ color: COLORS.muted }}>{node.timestamp}</span>
                        } />
                        {node.sourceFile && node.sourceLine > 0 && (
                            <InfoRow label="Source" value={
                                <code style={{ color: COLORS.muted }}>{node.sourceFile}:{node.sourceLine}</code>
                            } />
                        )}
                        {node.parentMethod && (
                            <InfoRow label="Parent" value={
                                <code style={{ color: COLORS.muted, fontSize: 10 }}>{node.parentMethod}</code>
                            } />
                        )}
                        {isSql && (
                            <InfoRow label="Slow query" value={
                                <Badge color={node.slowQuery ? COLORS.red : COLORS.green}>
                                    {node.slowQuery ? "YES (≥500ms)" : "no"}
                                </Badge>
                            } />
                        )}
                        {node.errorType && (
                            <InfoRow label="Error type" value={
                                <Badge color={COLORS.red}>{node.errorType}</Badge>
                            } />
                        )}
                        {node.errorMessage && (
                            <div style={{ gridColumn: "1/-1" }}>
                                <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 3 }}>Error message</div>
                                <div style={{
                                    padding: "6px 10px", borderRadius: 6,
                                    background: COLORS.red + "15", border: `1px solid ${COLORS.red}33`,
                                    color: COLORS.red, fontSize: 11,
                                }}>{node.errorMessage}</div>
                            </div>
                        )}
                        <div style={{ gridColumn: "1/-1" }}>
                            <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>
                                Duration relative to slowest span
                            </div>
                            <DurationBar ms={node.executionTimeMs} maxMs={maxExecution} />
                        </div>
                    </div>
                )}

                {tab === "params" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>Parameters</div>
                            <pre style={{
                                margin: 0, padding: "8px 10px", borderRadius: 8,
                                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                                color: COLORS.text, fontSize: 11, maxHeight: 180, overflow: "auto",
                            }}>{JSON.stringify(node.params, null, 2) || "none"}</pre>
                        </div>
                        <div>
                            <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>Return value</div>
                            <pre style={{
                                margin: 0, padding: "8px 10px", borderRadius: 8,
                                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                                color: COLORS.text, fontSize: 11, maxHeight: 180, overflow: "auto",
                            }}>{JSON.stringify(node.returnValue, null, 2) ?? "null"}</pre>
                        </div>
                        {isSql && node.sql && (
                            <div>
                                <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4 }}>SQL</div>
                                <pre style={{
                                    margin: 0, padding: "8px 10px", borderRadius: 8,
                                    background: COLORS.bg, border: `1px solid ${COLORS.blue}33`,
                                    color: COLORS.blue, fontSize: 11,
                                    maxHeight: 120, overflow: "auto", whiteSpace: "pre-wrap",
                                }}>{node.sql}</pre>
                            </div>
                        )}
                    </div>
                )}

                {tab === "stack" && (
                    node.errorStackTrace ? (
                        <pre style={{
                            margin: 0, padding: "8px 10px", borderRadius: 8,
                            background: COLORS.red + "10", border: `1px solid ${COLORS.red}33`,
                            color: COLORS.red, fontSize: 10.5, maxHeight: 320, overflow: "auto", lineHeight: 1.6,
                        }}>{node.errorStackTrace}</pre>
                    ) : (
                        <div style={{ color: COLORS.muted, fontSize: 12, padding: "12px 0" }}>
                            No stack trace — method completed without error.
                        </div>
                    )
                )}
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div>
            <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 12 }}>{value}</div>
        </div>
    );
}
