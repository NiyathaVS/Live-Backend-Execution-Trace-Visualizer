import React, { useMemo } from "react";

export default function OverlayTimeline({ baseEvents, compareEvents }) {
    const model = useMemo(
        () => buildOverlayModel(baseEvents || [], compareEvents || []),
        [baseEvents, compareEvents]
    );

    if (!model) {
        return (
            <div style={{ fontSize: 11, color: "#6b7280", padding: 8 }}>
                Overlay timeline unavailable.
            </div>
        );
    }

    const { total, baseBars, compareBars, divergenceMs } = model;

    return (
        <div
            style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(55,65,81,0.8)",
                background: "rgba(2,6,23,0.85)"
            }}
        >
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 6,
                    display: "flex",
                    justifyContent: "space-between"
                }}
            >
                <span>Cross-request overlay timeline</span>
                <span style={{ color: "#93c5fd", fontSize: 11 }}>
                    Divergence ~ {Math.round(divergenceMs)}ms
                </span>
            </div>

            <Track label="Base" bars={baseBars} total={total} color="#22c55e" />
            <Track label="Compare" bars={compareBars} total={total} color="#f97316" />
        </div>
    );
}

function Track({ label, bars, total, color }) {
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>
                {label}
            </div>
            <div
                style={{
                    position: "relative",
                    height: 24,
                    borderRadius: 999,
                    background: "#020617",
                    overflow: "hidden"
                }}
            >
                {bars.map((bar) => {
                    const left = (bar.startMs / total) * 100;
                    const width = Math.max((bar.durationMs / total) * 100, 1);
                    return (
                        <div
                            key={bar.eventId || `${bar.method}-${bar.startMs}`}
                            title={`${bar.method} (${bar.durationMs}ms)`}
                            style={{
                                position: "absolute",
                                left: `${left}%`,
                                width: `${width}%`,
                                top: 3,
                                bottom: 3,
                                borderRadius: 999,
                                background: color,
                                opacity: 0.75
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function buildOverlayModel(baseEvents, compareEvents) {
    if (!baseEvents.length || !compareEvents.length) return null;
    const a = normalize(baseEvents);
    const b = normalize(compareEvents);
    const total = Math.max(a.total, b.total, 1);
    const divergenceMs = estimateDivergence(a.sorted, b.sorted);

    return {
        total,
        baseBars: a.bars,
        compareBars: b.bars,
        divergenceMs
    };
}

function normalize(events) {
    const sorted = [...events].sort(
        (x, y) => new Date(x.timestamp) - new Date(y.timestamp)
    );
    const start = new Date(sorted[0].timestamp).getTime();
    const bars = sorted.map((e) => {
        const t = new Date(e.timestamp).getTime();
        return {
            eventId: e.eventId,
            method: e.method,
            startMs: t - start,
            durationMs: Math.max(e.executionTimeMs || 1, 1)
        };
    });
    const total = bars.reduce((m, x) => Math.max(m, x.startMs + x.durationMs), 1);
    return { sorted, bars, total };
}

/**
 * Estimate divergence by matching events that share the same method name
 * across both traces, then averaging the absolute timestamp differences.
 * This is meaningful even when the two traces have different numbers of events,
 * unlike the previous position-based approach.
 */
function estimateDivergence(a, b) {
    // Build a method → first-occurrence timestamp map for each trace
    const mapA = new Map();
    for (const e of a) {
        if (e.method && !mapA.has(e.method)) {
            mapA.set(e.method, new Date(e.timestamp).getTime());
        }
    }

    let total = 0;
    let matched = 0;
    for (const e of b) {
        if (e.method && mapA.has(e.method)) {
            total += Math.abs(new Date(e.timestamp).getTime() - mapA.get(e.method));
            matched++;
        }
    }

    return matched === 0 ? 0 : total / matched;
}

