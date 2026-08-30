import React from "react";

// ─────────────────────────────────────────────────────────────────
// Design System — Glassmorphism + Neumorphism dark theme
// Base: deep space navy   Accent: electric blue → cyan gradient
// ─────────────────────────────────────────────────────────────────

export const COLORS = {
    // Backgrounds — layered depth
    bg:           "#050c1a",          // true deep navy
    surface:      "#070f1f",          // one step lighter
    surfaceHi:    "#0b1628",          // card surface
    surfaceMid:   "#0d1e38",          // elevated card
    glass:        "rgba(11,22,40,0.72)",   // glass panel backdrop
    glassBright:  "rgba(15,30,56,0.85)",   // bright glass

    // Borders
    border:       "rgba(56,189,248,0.10)", // very subtle cyan tint
    borderMid:    "rgba(56,189,248,0.18)",
    borderBright: "rgba(56,189,248,0.32)",
    borderGlow:   "rgba(56,189,248,0.55)",

    // Text
    text:         "#e8f0fe",
    textSoft:     "#b8c9e8",
    muted:        "#4d6690",

    // Brand gradient stops
    gradFrom:     "#3b82f6",   // blue-500
    gradMid:      "#06b6d4",   // cyan-500
    gradTo:       "#22c55e",   // green-500

    // Status palette (vivid, neon-adjacent)
    green:        "#22d3a0",
    greenGlow:    "rgba(34,211,160,0.35)",
    orange:       "#fb923c",
    orangeGlow:   "rgba(251,146,60,0.35)",
    red:          "#f43f5e",
    redGlow:      "rgba(244,63,94,0.35)",
    blue:         "#38bdf8",
    blueGlow:     "rgba(56,189,248,0.35)",
    yellow:       "#fcd34d",
    yellowGlow:   "rgba(252,211,77,0.35)",
    purple:       "#a78bfa",
    purpleGlow:   "rgba(167,139,250,0.35)",
    cyan:         "#22d3ee",
    cyanGlow:     "rgba(34,211,238,0.30)",
};

// ─── Reusable shadow recipes ──────────────────────────────────────
export const SHADOWS = {
    // Neumorphic inset (for input fields, inner panels)
    neo:       "inset 2px 2px 5px rgba(0,0,0,0.55), inset -1px -1px 3px rgba(56,189,248,0.04)",
    // Neumorphic raised (for cards)
    neoRaised: "4px 4px 12px rgba(0,0,0,0.6), -1px -1px 4px rgba(56,189,248,0.06)",
    // Glass glow
    glass:     "0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(56,189,248,0.10)",
    glassHover:"0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(56,189,248,0.22)",
    // Neon status glows
    green:  `0 0 12px rgba(34,211,160,0.45)`,
    red:    `0 0 12px rgba(244,63,94,0.45)`,
    blue:   `0 0 12px rgba(56,189,248,0.45)`,
    orange: `0 0 12px rgba(251,146,60,0.45)`,
    yellow: `0 0 12px rgba(252,211,77,0.45)`,
};

// ─── Gradient helpers ─────────────────────────────────────────────
export const GRADIENT = {
    brand:   "linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #22c55e 100%)",
    brandH:  "linear-gradient(135deg, #60a5fa 0%, #22d3ee 50%, #4ade80 100%)",
    blue:    "linear-gradient(135deg, #1d4ed8, #38bdf8)",
    green:   "linear-gradient(135deg, #065f46, #22d3a0)",
    red:     "linear-gradient(135deg, #9f1239, #f43f5e)",
    orange:  "linear-gradient(135deg, #92400e, #fb923c)",
    yellow:  "linear-gradient(135deg, #78350f, #fcd34d)",
    purple:  "linear-gradient(135deg, #4c1d95, #a78bfa)",
    surface: "linear-gradient(180deg, #070f1f 0%, #050c1a 100%)",
};

// ─── Badge ────────────────────────────────────────────────────────
export function Badge({ color, children, title, style: extraStyle }) {
    return (
        <span title={title} style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 7px", borderRadius: 5,
            fontSize: 9.5, fontWeight: 800,
            letterSpacing: 0.6,
            background: color + "1a",
            color,
            border: `1px solid ${color}40`,
            boxShadow: `0 0 6px ${color}22`,
            whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
            ...extraStyle,
        }}>{children}</span>
    );
}

// ─── RiskBadges ───────────────────────────────────────────────────
export function RiskBadges({ node }) {
    const flags = [];
    if (node.status === "ERROR" || node.hasError)
        flags.push(<Badge key="err" color={COLORS.red} title="Method threw an exception">ERR</Badge>);
    if (node.contentionRisk)
        flags.push(<Badge key="cont" color={COLORS.purple} title="Thread blocked/waiting or CPU-starved">CONTENTION</Badge>);
    if (node.resourceLeakSuspicion)
        flags.push(<Badge key="leak" color={COLORS.yellow} title="Open/connect/acquire without close">LEAK?</Badge>);
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
        ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 5 }}>{flags}</div>
        : null;
}

// ─── DurationBar ──────────────────────────────────────────────────
export function DurationBar({ ms, maxMs }) {
    if (ms == null || maxMs == null || maxMs === 0) return null;
    const pct   = Math.min(ms / maxMs, 1);
    const color = pct > 0.8 ? COLORS.red : pct > 0.5 ? COLORS.orange : COLORS.green;
    const glow  = pct > 0.8 ? COLORS.redGlow : pct > 0.5 ? COLORS.orangeGlow : COLORS.greenGlow;
    return (
        <div style={{
            height: 3, borderRadius: 99,
            background: "rgba(56,189,248,0.08)",
            marginTop: 7, overflow: "hidden",
        }}>
            <div style={{
                width: `${pct * 100}%`, height: "100%",
                borderRadius: 99,
                background: `linear-gradient(90deg, ${color}99, ${color})`,
                boxShadow: `0 0 6px ${glow}`,
                transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
            }} />
        </div>
    );
}

// ─── GlassCard ────────────────────────────────────────────────────
// Reusable glassmorphic container used across the dashboard
export function GlassCard({ children, style, glow, noPadding }) {
    return (
        <div style={{
            borderRadius: 16,
            background: COLORS.glass,
            border: `1px solid ${glow ? COLORS.borderMid : COLORS.border}`,
            boxShadow: glow ? SHADOWS.glassHover : SHADOWS.glass,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            padding: noPadding ? 0 : "16px 18px",
            ...style,
        }}>
            {children}
        </div>
    );
}

// ─── SectionLabel ─────────────────────────────────────────────────
export function SectionLabel({ children, right }) {
    return (
        <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10,
        }}>
            <span style={{
                fontSize: 10, fontWeight: 800, color: COLORS.muted,
                textTransform: "uppercase", letterSpacing: 1.2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}>{children}</span>
            {right && <span style={{ fontSize: 10, color: COLORS.muted }}>{right}</span>}
        </div>
    );
}

// ─── NeoInput ────────────────────────────────────────────────────
export function NeoInput({ style, ...props }) {
    return (
        <input style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${COLORS.border}`,
            background: "rgba(5,12,26,0.8)",
            color: COLORS.text,
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
            boxShadow: SHADOWS.neo,
            transition: "border-color 0.2s, box-shadow 0.2s",
            fontFamily: "inherit",
            ...style,
        }} {...props} />
    );
}
