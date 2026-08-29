import React from "react";
import { COLORS } from "../theme.jsx";

export default function AnalysisBanner({ report }) {
    const items = [
        ...(report.rootCauseHints    || []).map(h => ({ text: h, color: COLORS.yellow })),
        ...(report.nPlusOneWarnings  || []).map(w => ({ text: w, color: COLORS.orange })),
        ...(report.anomalies         || []).map(a => ({ text: a, color: COLORS.red    })),
        ...(report.warnings          || []).map(w => ({ text: w, color: COLORS.muted  })),
    ];
    if (items.length === 0) return null;
    return (
        <div style={{
            borderRadius: 10, border: `1px solid ${COLORS.yellow}33`,
            background: COLORS.yellow + "0a", padding: "10px 14px",
        }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.yellow, marginBottom: 8 }}>
                ⚡ Analysis &amp; Root-Cause Hints
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {items.slice(0, 8).map((item, i) => (
                    <div key={i} style={{
                        fontSize: 11, color: item.color,
                        padding: "3px 0", borderLeft: `2px solid ${item.color}55`, paddingLeft: 8,
                    }}>{item.text}</div>
                ))}
            </div>
        </div>
    );
}
