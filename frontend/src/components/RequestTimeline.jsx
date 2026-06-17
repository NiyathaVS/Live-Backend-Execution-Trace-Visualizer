import React, { useEffect, useMemo, useRef, useState } from "react";

export default function RequestTimeline({ events }) {
    const [zoom, setZoom] = useState(1); // 1x to 10x
    const [panRatio, setPanRatio] = useState(0); // 0..1
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startPan: 0 });

    if (!events || events.length === 0) {
        return (
            <div
                style={{
                    fontSize: 11,
                    color: "#6b7280",
                    padding: "4px 8px"
                }}
            >
                No timing data yet.
            </div>
        );
    }

    const sorted = useMemo(
        () => [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        [events]
    );

    const start = new Date(sorted[0].timestamp).getTime();
    const endCandidates = sorted.map((e) => {
        const t = new Date(e.timestamp).getTime();
        return t + (e.executionTimeMs || 0);
    });
    const end = Math.max(...endCandidates);
    const total = Math.max(end - start, 1);
    const windowDuration = total / zoom;
    const maxPanMs = Math.max(total - windowDuration, 0);
    const windowStart = start + maxPanMs * panRatio;
    const windowEnd = windowStart + windowDuration;

    useEffect(() => {
        function handleMouseMove(event) {
            if (!isDragging) return;
            const deltaX = event.clientX - dragRef.current.startX;
            const sensitivity = 0.002;
            const next = clamp(dragRef.current.startPan - deltaX * sensitivity, 0, 1);
            setPanRatio(next);
        }
        function handleMouseUp() {
            setIsDragging(false);
        }

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div
            style={{
                padding: 8,
                borderTop: "1px solid rgba(55,65,81,0.7)",
                background: "rgba(15,23,42,0.9)"
            }}
        >
            <div
                style={{
                    fontSize: 11,
                    color: "#9ca3af",
                    marginBottom: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                }}
            >
                <span>Request timeline (zoom + drag)</span>
                <span>
                    {Math.round(total)} ms total, {events.length} calls
                </span>
            </div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6
                }}
            >
                <label style={{ fontSize: 10, color: "#9ca3af" }}>Zoom</label>
                <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={zoom}
                    onChange={(e) => {
                        setZoom(Number(e.target.value));
                        setPanRatio(0);
                    }}
                    style={{ flex: 1 }}
                />
                <span style={{ fontSize: 10, color: "#cbd5e1", minWidth: 32 }}>
                    {zoom.toFixed(1)}x
                </span>
            </div>
            <div
                style={{
                    position: "relative",
                    height: 32,
                    borderRadius: 999,
                    background: "#020617",
                    overflow: "hidden"
                }}
                onMouseDown={(event) => {
                    dragRef.current = { startX: event.clientX, startPan: panRatio };
                    setIsDragging(true);
                }}
                title="Drag to pan timeline window"
            >
                {sorted.map((e) => {
                    const st = new Date(e.timestamp).getTime();
                    const dur = e.executionTimeMs || 1;
                    const evStart = st;
                    const evEnd = st + dur;
                    if (evEnd < windowStart || evStart > windowEnd) {
                        return null;
                    }

                    const clippedStart = Math.max(evStart, windowStart);
                    const clippedEnd = Math.min(evEnd, windowEnd);
                    const visibleDur = Math.max(clippedEnd - clippedStart, 1);

                    const offset = ((clippedStart - windowStart) / windowDuration) * 100;
                    const width = Math.max((visibleDur / windowDuration) * 100, 1.5);

                    return (
                        <div
                            key={e.eventId}
                            title={`${e.method} (${dur}ms)`}
                            style={{
                                position: "absolute",
                                left: `${offset}%`,
                                width: `${width}%`,
                                top: 4,
                                bottom: 4,
                                borderRadius: 999,
                                background:
                                    "linear-gradient(135deg,#22c55e,#f97316)",
                                opacity: 0.8
                            }}
                        />
                    );
                })}
            </div>
            <div
                style={{
                    marginTop: 4,
                    fontSize: 10,
                    color: "#94a3b8",
                    display: "flex",
                    justifyContent: "space-between"
                }}
            >
                <span>{Math.round(windowStart - start)}ms</span>
                <span>{Math.round(windowEnd - start)}ms</span>
            </div>
        </div>
    );
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

