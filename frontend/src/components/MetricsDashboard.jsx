import React from "react";
import { COLORS, SHADOWS, SectionLabel } from "../theme.jsx";

export default function MetricsDashboard({ report, loading, error }) {
    if (loading) {
        return (
            <div style={{ padding: "16px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                    width: 14, height: 14, borderRadius: "50%",
                    border: `2px solid ${COLORS.blue}`,
                    borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                }} />
                <span style={{ fontSize: 11, color: COLORS.muted }}>Loading metrics…</span>
            </div>
        );
    }

    if (error && !report) return (
        <div style={{
            padding: "12px", borderRadius: 9,
            background: COLORS.surfaceHi, border: `1px solid ${COLORS.border}`,
            textAlign: "center", lineHeight: 1.8,
        }}>
            <div style={{ fontSize: 22, opacity: 0.15, marginBottom: 4 }}>◌</div>
            <div style={{ fontSize: 10.5, color: COLORS.muted }}>Method stats not yet available</div>
            <div style={{ fontSize: 9.5, color: COLORS.muted, opacity: 0.6 }}>Populate by running instrumented requests</div>
        </div>
    );

    if (!report) return null;

    const metrics   = report.methodMetrics || [];
    const anomalies = report.anomalies || [];
    const maxP99    = metrics.length > 0 ? Math.max(...metrics.map(m => m.p99Ms || 0)) : 1;

    return (
        <div style={{ paddingTop: 14 }}>
            <SectionLabel right={`${report.traceCount ?? 0} traces`}>Method Stats</SectionLabel>

            {/* Anomaly callout */}
            {anomalies.length > 0 && (
                <div style={{
                    marginBottom: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: `${COLORS.yellow}0a`,
                    border: `1px solid ${COLORS.yellow}25`,
                    boxShadow: `0 0 16px ${COLORS.yellowGlow}`,
                }}>
                    <div style={{
                        fontSize: 10, fontWeight: 800, color: COLORS.yellow,
                        marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8,
                        fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        ⚡ Anomalies Detected
                    </div>
                    {anomalies.slice(0, 3).map((a, i) => (
                        <div key={i} style={{
                            fontSize: 10.5, color: COLORS.yellow + "cc",
                            lineHeight: 1.6, paddingLeft: 8,
                            borderLeft: `2px solid ${COLORS.yellow}44`,
                            marginTop: i > 0 ? 4 : 0,
                        }}>
                            {a}
                        </div>
                    ))}
                </div>
            )}

            {/* Column headers */}
            <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1.2fr",
                gap: 4,
                fontSize: 9.5,
                color: COLORS.muted,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                padding: "0 6px 6px",
                borderBottom: `1px solid ${COLORS.border}`,
                marginBottom: 4,
                fontFamily: "'JetBrains Mono', monospace",
            }}>
                <span>Method</span>
                <span style={{ textAlign: "right" }}>Calls</span>
                <span style={{ textAlign: "right" }}>Err%</span>
                <span style={{ paddingLeft: 4 }}>Latency</span>
            </div>

            {metrics.length === 0 && (
                <div style={{ fontSize: 11, color: COLORS.muted, padding: "16px 4px", textAlign: "center", lineHeight: 1.7 }}>
                    No data yet.<br/>
                    <span style={{ fontSize: 10 }}>Run some instrumented requests.</span>
                </div>
            )}

            {metrics.slice(0, 15).map((m, idx) => {
                const errPct   = Math.round((m.errorRate || 0) * 100);
                const isHot    = (m.p99Ms || 0) > 500;
                const p50ratio = maxP99 > 0 ? Math.min((m.p50Ms || 0) / maxP99, 1) : 0;
                const p95ratio = maxP99 > 0 ? Math.min((m.p95Ms || 0) / maxP99, 1) : 0;
                const p99ratio = maxP99 > 0 ? Math.min((m.p99Ms || 0) / maxP99, 1) : 0;
                const rowColor = isHot ? COLORS.orange : errPct > 10 ? COLORS.red : "transparent";

                return (
                    <div key={m.method} style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1fr 1.2fr",
                        gap: 4,
                        padding: "6px 6px",
                        borderRadius: 8,
                        marginBottom: 2,
                        background: isHot ? `${COLORS.orange}06` : idx % 2 === 0 ? "rgba(56,189,248,0.02)" : "transparent",
                        border: `1px solid ${isHot ? COLORS.orange + "20" : "transparent"}`,
                        alignItems: "center",
                        transition: "background 0.15s",
                    }}>
                        {/* Method name + class */}
                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                fontSize: 10.5,
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                color: isHot ? COLORS.orange : COLORS.text,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: isHot ? 700 : 500,
                            }} title={m.method}>
                                {m.method.split(".").pop()}
                            </div>
                            <div style={{
                                fontSize: 9.5, color: COLORS.muted,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                fontFamily: "'JetBrains Mono', monospace",
                            }} title={m.method}>
                                {m.method.split(".").slice(-2, -1)[0] || ""}
                            </div>
                        </div>

                        {/* Call count */}
                        <div style={{
                            fontSize: 10.5, color: COLORS.muted, textAlign: "right",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: "tabular-nums",
                        }}>
                            {m.count}
                        </div>

                        {/* Error rate */}
                        <div style={{
                            fontSize: 10.5, fontWeight: errPct > 0 ? 800 : 400,
                            color: errPct > 10 ? COLORS.red : errPct > 0 ? COLORS.orange : COLORS.muted,
                            textAlign: "right",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontVariantNumeric: "tabular-nums",
                            textShadow: errPct > 10 ? `0 0 8px ${COLORS.redGlow}` : "none",
                        }}>
                            {errPct}%
                        </div>

                        {/* Latency sparkbar */}
                        <div style={{ paddingLeft: 4 }} title={`p50: ${m.p50Ms}ms · p95: ${m.p95Ms}ms · p99: ${m.p99Ms}ms`}>
                            <LatencySparkbar p50r={p50ratio} p95r={p95ratio} p99r={p99ratio} />
                            <div style={{
                                fontSize: 9, color: COLORS.muted, marginTop: 3,
                                fontFamily: "'JetBrains Mono', monospace",
                                fontVariantNumeric: "tabular-nums",
                            }}>
                                {m.p99Ms}ms p99
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function LatencySparkbar({ p50r, p95r, p99r }) {
    return (
        <div style={{
            position: "relative", height: 6, borderRadius: 99,
            background: "rgba(56,189,248,0.06)",
            overflow: "hidden",
        }}>
            <div style={{
                position: "absolute", left: 0, top: 0,
                width: `${p99r * 100}%`, height: "100%",
                borderRadius: 99,
                background: COLORS.red + "55",
            }} />
            <div style={{
                position: "absolute", left: 0, top: 0,
                width: `${p95r * 100}%`, height: "100%",
                borderRadius: 99,
                background: COLORS.orange + "bb",
            }} />
            <div style={{
                position: "absolute", left: 0, top: 0,
                width: `${p50r * 100}%`, height: "100%",
                borderRadius: 99,
                background: `linear-gradient(90deg, ${COLORS.green}88, ${COLORS.green})`,
                boxShadow: `0 0 6px ${COLORS.greenGlow}`,
            }} />
        </div>
    );
}
