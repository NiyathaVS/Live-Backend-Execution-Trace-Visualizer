import React, { useState } from "react";
import { COLORS, SHADOWS } from "../theme.jsx";
import { acknowledgeAlert } from "../services/traceApi";

export default function AlertRail({ alerts }) {
    const [dismissed, setDismissed] = useState(new Set());
    const [collapsed, setCollapsed] = useState(false);

    if (!alerts || alerts.length === 0) return null;

    const visible = alerts.filter((a) => !dismissed.has(a.id));
    if (visible.length === 0) return null;

    const criticals = visible.filter(a => a.severity === "ERROR");
    const topColor  = criticals.length > 0 ? COLORS.red : COLORS.yellow;

    const dismiss = (alert) => {
        // Optimistically hide immediately for snappy UX
        setDismissed(prev => { const n = new Set(prev); n.add(alert.id); return n; });
        // Persist to backend so it survives the next poll
        acknowledgeAlert(alert.id).catch(() => {
            // If the backend call fails, re-show the alert
            setDismissed(prev => { const n = new Set(prev); n.delete(alert.id); return n; });
        });
    };

    return (
        <div style={{
            flexShrink: 0,
            background: `linear-gradient(135deg, ${topColor}08 0%, transparent 100%)`,
            borderBottom: `1px solid ${topColor}30`,
            animation: "fadeSlideIn 0.3s ease",
        }}>
            {/* Rail header */}
            <div
                onClick={() => setCollapsed(c => !c)}
                style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 20px", cursor: "pointer",
                    userSelect: "none",
                }}
            >
                {/* Pulsing dot */}
                <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: topColor,
                    boxShadow: `0 0 0 2px ${topColor}33, 0 0 10px ${topColor}88`,
                    display: "inline-block", flexShrink: 0,
                    animation: "pulseBig 2s infinite",
                }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: topColor, letterSpacing: 0.3 }}>
                    {criticals.length > 0
                        ? `${criticals.length} critical alert${criticals.length > 1 ? "s" : ""}`
                        : `${visible.length} warning${visible.length > 1 ? "s" : ""}`}
                </span>
                {!collapsed && visible.length > 1 && (
                    <span style={{ fontSize: 10, color: COLORS.muted }}>
                        · {visible.length} total
                    </span>
                )}
                <div style={{
                    marginLeft: "auto",
                    fontSize: 10, color: COLORS.muted,
                    display: "flex", alignItems: "center", gap: 4,
                }}>
                    {collapsed ? "▾ Show" : "▴ Hide"}
                </div>
            </div>

            {/* Alert items */}
            {!collapsed && (
                <div style={{ padding: "0 20px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    {visible.map((a) => {
                        const isError = a.severity === "ERROR";
                        const c = isError ? COLORS.red : COLORS.yellow;
                        const glow = isError ? COLORS.redGlow : COLORS.yellowGlow;
                        return (
                            <div key={a.id} style={{
                                display: "flex", alignItems: "flex-start", gap: 10,
                                padding: "9px 12px",
                                borderRadius: 10,
                                background: `${c}0d`,
                                border: `1px solid ${c}28`,
                                borderLeft: `3px solid ${c}`,
                                boxShadow: `0 2px 12px ${glow}`,
                                animation: "fadeSlideIn 0.25s ease",
                            }}>
                                <span style={{
                                    fontSize: 9, fontWeight: 900, color: c,
                                    padding: "2px 6px", borderRadius: 4,
                                    background: `${c}20`, border: `1px solid ${c}40`,
                                    flexShrink: 0, marginTop: 1,
                                    fontFamily: "'JetBrains Mono', monospace",
                                    letterSpacing: 0.5,
                                }}>
                                    {isError ? "ERR" : "WARN"}
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: c }}>
                                        [{a.rule}]
                                    </span>
                                    <span style={{ fontSize: 11, color: COLORS.textSoft, marginLeft: 6 }}>
                                        {a.message}
                                    </span>
                                    {a.requestId && (
                                        <div style={{
                                            fontSize: 10, color: COLORS.muted, marginTop: 3,
                                            fontFamily: "'JetBrains Mono', monospace",
                                        }}>
                                            {a.requestId.slice(0, 20)}…
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); dismiss(a); }}
                                    style={{
                                        background: "none", border: "none", cursor: "pointer",
                                        color: COLORS.muted, fontSize: 15, lineHeight: 1,
                                        padding: "2px 4px", borderRadius: 4, flexShrink: 0,
                                        transition: "color 0.15s",
                                    }}
                                    title="Dismiss"
                                >×</button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
