import React from "react";
import { COLORS, SHADOWS } from "../theme.jsx";

export default function AnalysisBanner({ report }) {
    const items = [
        ...(report.rootCauseHints    || []).map(h => ({ text: h, color: COLORS.yellow, glow: COLORS.yellowGlow, icon: "⚡" })),
        ...(report.nPlusOneWarnings  || []).map(w => ({ text: w, color: COLORS.orange, glow: COLORS.orangeGlow, icon: "⧊" })),
        ...(report.anomalies         || []).map(a => ({ text: a, color: COLORS.red,    glow: COLORS.redGlow,    icon: "⚠" })),
        ...(report.warnings          || []).map(w => ({ text: w, color: COLORS.muted,  glow: "transparent",     icon: "›" })),
    ];
    if (items.length === 0) return null;

    return (
        <div style={{
            borderRadius: 14,
            border: `1px solid ${COLORS.yellow}28`,
            background: `linear-gradient(135deg, ${COLORS.yellow}07 0%, ${COLORS.orange}04 100%)`,
            boxShadow: `0 4px 24px ${COLORS.yellowGlow}`,
            padding: "12px 16px",
            animation: "fadeSlideIn 0.3s ease",
        }}>
            <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
            }}>
                <div style={{
                    width: 20, height: 20, borderRadius: 6,
                    background: `linear-gradient(135deg, ${COLORS.yellow}33, ${COLORS.orange}33)`,
                    border: `1px solid ${COLORS.yellow}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11,
                }}>⚡</div>
                <span style={{
                    fontSize: 11, fontWeight: 800, color: COLORS.yellow,
                    textTransform: "uppercase", letterSpacing: 0.8,
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    Root-Cause Analysis
                </span>
                <span style={{
                    marginLeft: "auto",
                    fontSize: 9, fontWeight: 700, color: COLORS.muted,
                    padding: "2px 7px", borderRadius: 99,
                    background: `${COLORS.yellow}15`,
                    border: `1px solid ${COLORS.yellow}25`,
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {items.length} hint{items.length > 1 ? "s" : ""}
                </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {items.slice(0, 8).map((item, i) => (
                    <div key={i} style={{
                        display: "flex", gap: 9, alignItems: "flex-start",
                        padding: "5px 8px",
                        borderRadius: 8,
                        background: `${item.color}08`,
                        border: `1px solid ${item.color}18`,
                        borderLeft: `2px solid ${item.color}66`,
                    }}>
                        <span style={{
                            fontSize: 11, color: item.color,
                            flexShrink: 0, marginTop: 1,
                            textShadow: `0 0 8px ${item.glow}`,
                        }}>{item.icon}</span>
                        <span style={{
                            fontSize: 11, color: item.color === COLORS.muted ? COLORS.textSoft : item.color + "dd",
                            lineHeight: 1.5,
                        }}>{item.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
