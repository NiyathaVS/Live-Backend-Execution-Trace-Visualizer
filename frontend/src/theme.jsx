import React from "react";

export const COLORS = {
    bg:          "#080e1f",
    surface:     "#0d1527",
    surfaceHi:   "#111e35",
    border:      "rgba(55,65,81,0.55)",
    borderBright:"rgba(99,120,160,0.4)",
    text:        "#e2e8f0",
    muted:       "#64748b",
    green:       "#22c55e",
    orange:      "#f97316",
    red:         "#ef4444",
    blue:        "#38bdf8",
    yellow:      "#fbbf24",
    purple:      "#a78bfa",
};

export function Badge({ color, children, title }) {
    return (
        <span title={title} style={{
            display: "inline-flex", alignItems: "center",
            padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
            letterSpacing: 0.4, background: color + "22", color, border: `1px solid ${color}55`,
            whiteSpace: "nowrap",
        }}>{children}</span>
    );
}

export function RiskBadges({ node }) {
    const flags = [];
    if (node.status === "ERROR" || node.hasError)
        flags.push(<Badge key="err" color={COLORS.red} title="Method threw an exception">ERR</Badge>);
    if (node.contentionRisk)
        flags.push(<Badge key="cont" color={COLORS.purple} title="Thread was blocked/waiting or CPU-starved during this span">CONTENTION</Badge>);
    if (node.resourceLeakSuspicion)
        flags.push(<Badge key="leak" color={COLORS.yellow} title="Open/connect/acquire without close detected">LEAK?</Badge>);
    if (node.slowQuery || (node.eventType === "SQL" && node.executionTimeMs >= 500))
        flags.push(<Badge key="slow-sql" color={COLORS.orange} title="SQL query ≥500ms">SLOW SQL</Badge>);
    if (node.slowPath && node.eventType !== "SQL")
        flags.push(<Badge key="slow" color={COLORS.orange} title="On critical execution path">SLOW</Badge>);
    if (node.logicGapRisk)
        flags.push(<Badge key="gap" color={COLORS.yellow} title="Unusually high execution time or error">LOGIC GAP</Badge>);
    if (node.isOnCriticalPath)
        flags.push(<Badge key="crit" color={COLORS.blue} title="On the longest execution path">CRITICAL PATH</Badge>);
    if (node.eventType === "SQL" && !node.slowQuery)
        flags.push(<Badge key="sql" color={COLORS.blue} title="JDBC query">SQL</Badge>);
    return flags.length > 0
        ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>{flags}</div>
        : null;
}

export function DurationBar({ ms, maxMs }) {
    if (ms == null || maxMs == null || maxMs === 0) return null;
    const pct   = Math.min(ms / maxMs, 1);
    const color = pct > 0.8 ? COLORS.red : pct > 0.5 ? COLORS.orange : COLORS.green;
    return (
        <div style={{ height: 3, borderRadius: 2, background: COLORS.border, marginTop: 5 }}>
            <div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 2, background: color }} />
        </div>
    );
}
