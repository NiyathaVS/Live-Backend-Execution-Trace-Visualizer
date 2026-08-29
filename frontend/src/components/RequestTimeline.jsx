import React, { useEffect, useMemo, useRef, useState } from "react";

const C = {
    bg:        "#020617",
    surface:   "rgba(15,23,42,0.9)",
    border:    "rgba(55,65,81,0.7)",
    text:      "#94a3b8",
    textDim:   "#4b5563",
    rowEven:   "rgba(255,255,255,0.02)",
};
const ROW_H  = 22; // px per thread row
const LABEL_W = 110; // px reserved for thread name label

export default function RequestTimeline({ events }) {
    const [zoom, setZoom]         = useState(1);
    const [panRatio, setPanRatio] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [hovered, setHovered]   = useState(null); // { e, x, y }
    const dragRef  = useRef({ startX: 0, startPan: 0 });
    const trackRef = useRef(null);

    useEffect(() => {
        function onMove(ev) {
            if (!isDragging) return;
            const dx   = ev.clientX - dragRef.current.startX;
            const next = clamp(dragRef.current.startPan - dx * 0.002, 0, 1);
            setPanRatio(next);
        }
        function onUp() { setIsDragging(false); }
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup",   onUp);
        return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    }, [isDragging]);

    const sorted = useMemo(
        () => [...(events || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        [events]
    );

    if (!sorted.length) {
        return <div style={{ fontSize: 11, color: C.textDim, padding: "4px 8px" }}>No timing data yet.</div>;
    }

    // ── time window ────────────────────────────────────────────────────────
    const traceStart = new Date(sorted[0].timestamp).getTime();
    const traceEnd   = Math.max(...sorted.map(e => new Date(e.timestamp).getTime() + (e.executionTimeMs || 0)));
    const total      = Math.max(traceEnd - traceStart, 1);

    const windowDur   = total / zoom;
    const maxPan      = Math.max(total - windowDur, 0);
    const winStart    = traceStart + maxPan * panRatio;
    const winEnd      = winStart + windowDur;

    // ── group events into swim lanes by threadName ─────────────────────────
    // Preserve insertion order so lanes are stable as events arrive live.
    const laneOrder = useMemo(() => {
        const seen = new Set();
        for (const e of sorted) {
            const lane = e.threadName || "unknown";
            if (!seen.has(lane)) seen.add(lane);
        }
        return [...seen];
    }, [sorted]);

    const laneMap = useMemo(() => {
        const m = new Map(laneOrder.map(l => [l, []]));
        for (const e of sorted) m.get(e.threadName || "unknown").push(e);
        return m;
    }, [sorted, laneOrder]);

    const trackH = laneOrder.length * ROW_H;

    // ── helpers ────────────────────────────────────────────────────────────
    function toX(ms) {
        return ((ms - winStart) / windowDur) * 100;
    }
    function toW(durMs) {
        return Math.max((durMs / windowDur) * 100, 0.4);
    }

    return (
        <div style={{ padding: 8, borderTop: `1px solid ${C.border}`, background: C.surface, userSelect: "none" }}>

            {/* header row */}
            <div style={{
                fontSize: 11, color: C.text, marginBottom: 4,
                display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
                <span>Thread timeline — {laneOrder.length} thread{laneOrder.length !== 1 ? "s" : ""}</span>
                <span>{Math.round(total)}ms total · {events.length} spans</span>
            </div>

            {/* zoom control */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <label style={{ fontSize: 10, color: C.text }}>Zoom</label>
                <input type="range" min="1" max="20" step="0.5" value={zoom}
                    onChange={e => { setZoom(Number(e.target.value)); setPanRatio(0); }}
                    style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: "#cbd5e1", minWidth: 32 }}>{zoom.toFixed(1)}x</span>
            </div>

            {/* swimlane chart */}
            <div style={{ display: "flex", fontSize: 10 }}>

                {/* thread name labels */}
                <div style={{ width: LABEL_W, flexShrink: 0 }}>
                    {laneOrder.map((lane, i) => (
                        <div key={lane} style={{
                            height: ROW_H, display: "flex", alignItems: "center",
                            paddingRight: 6, color: C.text,
                            background: i % 2 ? "transparent" : C.rowEven,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }} title={lane}>
                            {shortThread(lane)}
                        </div>
                    ))}
                </div>

                {/* track area */}
                <div
                    ref={trackRef}
                    style={{
                        flex: 1, position: "relative", height: trackH,
                        background: C.bg, cursor: isDragging ? "grabbing" : "grab",
                        overflow: "hidden", borderRadius: 4,
                    }}
                    onMouseDown={ev => {
                        dragRef.current = { startX: ev.clientX, startPan: panRatio };
                        setIsDragging(true);
                    }}
                >
                    {/* row stripes */}
                    {laneOrder.map((_, i) => i % 2 === 0 && (
                        <div key={i} style={{
                            position: "absolute", left: 0, right: 0,
                            top: i * ROW_H, height: ROW_H,
                            background: C.rowEven, pointerEvents: "none",
                        }} />
                    ))}

                    {/* tick lines at 25% intervals */}
                    {[0.25, 0.5, 0.75].map(f => (
                        <div key={f} style={{
                            position: "absolute", top: 0, bottom: 0,
                            left: `${f * 100}%`, width: 1,
                            background: "rgba(255,255,255,0.05)", pointerEvents: "none",
                        }} />
                    ))}

                    {/* spans */}
                    {laneOrder.map((lane, laneIdx) => {
                        const evts = laneMap.get(lane) || [];
                        const top  = laneIdx * ROW_H;
                        return evts.map(e => {
                            const eSt  = new Date(e.timestamp).getTime();
                            const eEnd = eSt + (e.executionTimeMs || 1);
                            if (eEnd < winStart || eSt > winEnd) return null;

                            const x = clamp(toX(eSt), 0, 100);
                            const w = clamp(toW(e.executionTimeMs || 1), 0.4, 100 - x);
                            const color = spanColor(e);

                            return (
                                <div
                                    key={e.eventId ?? `${e.method}-${eSt}`}
                                    style={{
                                        position: "absolute",
                                        left:   `${x}%`,
                                        width:  `${w}%`,
                                        top:    top + 3,
                                        height: ROW_H - 6,
                                        borderRadius: 3,
                                        background: color,
                                        opacity: hovered?.e === e ? 1 : 0.78,
                                        transition: "opacity .1s",
                                        cursor: "default",
                                    }}
                                    onMouseEnter={ev => setHovered({ e, x: ev.clientX, y: ev.clientY })}
                                    onMouseLeave={() => setHovered(null)}
                                />
                            );
                        });
                    })}
                </div>
            </div>

            {/* time labels */}
            <div style={{
                marginTop: 3, fontSize: 10, color: C.text,
                display: "flex", paddingLeft: LABEL_W,
                justifyContent: "space-between",
            }}>
                <span>{Math.round(winStart - traceStart)}ms</span>
                <span>{Math.round((winStart - traceStart) + windowDur / 2)}ms</span>
                <span>{Math.round(winStart - traceStart + windowDur)}ms</span>
            </div>

            {/* legend */}
            <div style={{ marginTop: 6, display: "flex", gap: 10, fontSize: 10, color: C.text, paddingLeft: LABEL_W, flexWrap: "wrap" }}>
                {[
                    { color: "#22c55e", label: "OK" },
                    { color: "#f97316", label: "Slow / critical" },
                    { color: "#38bdf8", label: "SQL" },
                    { color: "#a78bfa", label: "Contention" },
                    { color: "#ef4444", label: "Error" },
                ].map(({ color, label }) => (
                    <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                        {label}
                    </span>
                ))}
            </div>

            {/* hover tooltip */}
            {hovered && <SpanTooltip e={hovered.e} x={hovered.x} y={hovered.y} traceStart={traceStart} />}
        </div>
    );
}

// ── SpanTooltip ───────────────────────────────────────────────────────────────
function SpanTooltip({ e, x, y, traceStart }) {
    const raw     = e.method ?? e.methodName ?? "";
    const bare    = raw.replace(/\(.*\)$/, "");
    const dot     = bare.lastIndexOf(".");
    const name    = dot !== -1 ? bare.slice(dot + 1) : bare;
    const cls     = dot !== -1 ? bare.slice(0, dot).split(".").pop() : "";
    const startMs = Math.round(new Date(e.timestamp).getTime() - traceStart);
    const flags   = [
        e.status === "ERROR" || e.hasError ? "ERROR" : null,
        e.contentionRisk  ? "CONTENTION" : null,
        e.slowPath        ? "SLOW"        : null,
        e.eventType === "SQL" ? "SQL"     : null,
    ].filter(Boolean);

    return (
        <div style={{
            position: "fixed", left: x + 12, top: y - 10, zIndex: 9999,
            background: "#1e293b", border: "1px solid rgba(99,120,160,0.4)",
            borderRadius: 8, padding: "7px 10px", fontSize: 11, color: "#e2e8f0",
            pointerEvents: "none", maxWidth: 240, boxShadow: "0 4px 16px rgba(0,0,0,.5)",
            lineHeight: 1.6,
        }}>
            <div style={{ fontWeight: 700 }}>{name}</div>
            {cls && <div style={{ color: "#64748b", fontSize: 10 }}>{cls}</div>}
            <div style={{ marginTop: 4, color: "#94a3b8" }}>
                <span>{e.executionTimeMs ?? "?"}ms</span>
                <span style={{ marginLeft: 8, color: "#4b5563" }}>@{startMs}ms</span>
            </div>
            {e.threadName && <div style={{ color: "#4b5563", fontSize: 10 }}>{e.threadName}</div>}
            {flags.length > 0 && (
                <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {flags.map(f => (
                        <span key={f} style={{
                            padding: "0 5px", borderRadius: 3, fontSize: 9, fontWeight: 700,
                            background: flagColor(f) + "33", color: flagColor(f),
                        }}>{f}</span>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function spanColor(e) {
    if (e.status === "ERROR" || e.hasError)           return "#ef4444";
    if (e.contentionRisk)                             return "#a78bfa";
    if (e.eventType === "SQL")                        return e.slowQuery ? "#f97316" : "#38bdf8";
    if (e.slowPath || e.isOnCriticalPath)             return "#f97316";
    return "#22c55e";
}

function flagColor(flag) {
    if (flag === "ERROR")      return "#ef4444";
    if (flag === "CONTENTION") return "#a78bfa";
    if (flag === "SLOW")       return "#f97316";
    if (flag === "SQL")        return "#38bdf8";
    return "#94a3b8";
}

function shortThread(name) {
    // "http-nio-8080-exec-3" → "exec-3", "pool-1-thread-2" → "thread-2"
    const parts = name.split("-");
    if (parts.length >= 2) return parts.slice(-2).join("-");
    return name;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
