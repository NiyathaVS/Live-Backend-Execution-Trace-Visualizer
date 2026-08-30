import React from "react";
import { COLORS, SHADOWS, GRADIENT } from "../theme.jsx";

export default function KpiBar({ metricsReport, requestStats, alerts, totalRequests }) {
    const allStats    = Object.values(requestStats || {});
    const totalErrors = allStats.reduce((s, r) => s + (r.errors || 0), 0);
    const totalSpans  = allStats.reduce((s, r) => s + (r.count  || 0), 0);
    const errorRate   = totalSpans > 0 ? ((totalErrors / totalSpans) * 100).toFixed(1) : null;

    const methodMetrics = metricsReport?.methodMetrics || [];
    const p99 = methodMetrics.length > 0 ? Math.max(...methodMetrics.map(m => m.p99Ms || 0)) : null;
    const slowestMethod = methodMetrics.length > 0
        ? [...methodMetrics].sort((a, b) => (b.p99Ms || 0) - (a.p99Ms || 0))[0]
        : null;

    const criticalAlerts = (alerts || []).filter(a => a.severity === "ERROR").length;
    const warnAlerts     = (alerts || []).filter(a => a.severity !== "ERROR").length;

    const cards = [
        {
            label: "Live Traces",
            value: totalRequests || "—",
            sub: totalRequests === 1 ? "active request" : "active requests",
            color: COLORS.blue,
            glow: COLORS.blueGlow,
            icon: "◈",
            isEmpty: totalRequests === 0,
        },
        {
            label: "Error Rate",
            value: errorRate != null ? `${errorRate}%` : "—",
            sub: totalErrors > 0 ? `${totalErrors} errors / ${totalSpans} spans` : "No errors detected",
            color: errorRate > 5 ? COLORS.red : errorRate > 1 ? COLORS.orange : COLORS.green,
            glow: errorRate > 5 ? COLORS.redGlow : errorRate > 1 ? COLORS.orangeGlow : COLORS.greenGlow,
            icon: "◎",
            isEmpty: errorRate === null,
        },
        {
            label: "Peak p99",
            value: p99 != null ? `${p99}ms` : "—",
            sub: slowestMethod ? slowestMethod.method.split(".").pop() : "No data yet",
            color: p99 > 1000 ? COLORS.red : p99 > 300 ? COLORS.orange : COLORS.green,
            glow: p99 > 1000 ? COLORS.redGlow : p99 > 300 ? COLORS.orangeGlow : COLORS.greenGlow,
            icon: "◷",
            isEmpty: p99 === null,
        },
        {
            label: "Active Alerts",
            value: (criticalAlerts + warnAlerts) || "—",
            sub: criticalAlerts > 0 ? `${criticalAlerts} critical` : warnAlerts > 0 ? `${warnAlerts} warnings` : "All clear",
            color: criticalAlerts > 0 ? COLORS.red : warnAlerts > 0 ? COLORS.yellow : COLORS.green,
            glow: criticalAlerts > 0 ? COLORS.redGlow : warnAlerts > 0 ? COLORS.yellowGlow : COLORS.greenGlow,
            icon: "◉",
            isEmpty: alerts == null,
        },
    ];

    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
            background: "rgba(5,12,26,0.6)",
        }}>
            {cards.map((c, i) => (
                <div key={c.label} style={{
                    position: "relative",
                    padding: "18px 24px",
                    borderRight: i < cards.length - 1 ? `1px solid ${COLORS.border}` : "none",
                    overflow: "hidden",
                    transition: "background 0.3s",
                }}>
                    {/* Ambient glow blob behind the number */}
                    {!c.isEmpty && (
                        <div style={{
                            position: "absolute",
                            top: -20, right: -10,
                            width: 80, height: 80,
                            borderRadius: "50%",
                            background: c.glow,
                            filter: "blur(28px)",
                            pointerEvents: "none",
                            opacity: 0.7,
                        }} />
                    )}

                    {/* Top row: icon + label */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: 7, marginBottom: 10,
                    }}>
                        <span style={{
                            fontSize: 11, color: c.isEmpty ? COLORS.muted : c.color,
                            opacity: 0.8,
                        }}>{c.icon}</span>
                        <span style={{
                            fontSize: 10, fontWeight: 700, color: COLORS.muted,
                            textTransform: "uppercase", letterSpacing: 1.1,
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        }}>{c.label}</span>
                    </div>

                    {/* Main value */}
                    <div style={{
                        fontSize: 28, fontWeight: 900, lineHeight: 1,
                        color: c.isEmpty ? COLORS.muted + "66" : c.color,
                        fontVariantNumeric: "tabular-nums",
                        letterSpacing: -1,
                        textShadow: c.isEmpty ? "none" : `0 0 20px ${c.glow}`,
                        marginBottom: 8,
                        transition: "color 0.3s",
                    }}>
                        {c.isEmpty ? "—" : c.value}
                    </div>

                    {/* Sub-label */}
                    <div style={{
                        fontSize: 11, color: COLORS.muted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        lineHeight: 1.4,
                    }}>
                        {c.sub}
                    </div>

                    {/* Bottom accent line */}
                    {!c.isEmpty && (
                        <div style={{
                            position: "absolute", bottom: 0, left: 0,
                            width: "100%", height: 2,
                            background: `linear-gradient(90deg, transparent, ${c.color}55, transparent)`,
                        }} />
                    )}
                </div>
            ))}
        </div>
    );
}
