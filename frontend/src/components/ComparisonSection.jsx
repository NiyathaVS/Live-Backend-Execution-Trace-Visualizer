import React from "react";
import { COLORS } from "../theme.jsx";
import ComparisonView from "./ComparisonView";
import OverlayTimeline from "./OverlayTimeline";

export default function ComparisonSection({
    selectedTrace, compareTrace,
    selectedRequestId, compareRequestId,
    flatEvents, compareFlatEvents,
    diffReport, diffLoading,
}) {
    return (
        <div style={{
            borderRadius: 12, border: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceHi, overflow: "hidden",
        }}>
            <div style={{
                padding: "10px 14px", borderBottom: `1px solid ${COLORS.border}`,
                fontWeight: 700, fontSize: 12,
            }}>
                Comparison &amp; Diff
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                <ComparisonView
                    data1={selectedTrace} data2={compareTrace}
                    label1={selectedRequestId?.slice(0, 16) + "…"}
                    label2={compareRequestId?.slice(0, 16) + "…"}
                    addedMethods={diffReport?.addedMethods   || []}
                    removedMethods={diffReport?.removedMethods || []}
                />
                <OverlayTimeline baseEvents={flatEvents} compareEvents={compareFlatEvents} />
                {(diffReport || diffLoading) && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.green, marginBottom: 6 }}>
                                + Added
                            </div>
                            {diffReport?.addedMethods?.length > 0
                                ? diffReport.addedMethods.map(m => (
                                    <div key={m} style={{ fontSize: 10, color: COLORS.green, marginBottom: 3 }}>
                                        + {m.split(".").pop()}
                                    </div>
                                ))
                                : <div style={{ fontSize: 10, color: COLORS.muted }}>None</div>}
                        </div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, marginBottom: 6 }}>
                                - Removed
                            </div>
                            {diffReport?.removedMethods?.length > 0
                                ? diffReport.removedMethods.map(m => (
                                    <div key={m} style={{ fontSize: 10, color: COLORS.red, marginBottom: 3 }}>
                                        - {m.split(".").pop()}
                                    </div>
                                ))
                                : <div style={{ fontSize: 10, color: COLORS.muted }}>None</div>}
                        </div>
                        <div style={{ gridColumn: "1/-1" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.blue, marginBottom: 6 }}>
                                Timing Δ
                            </div>
                            {diffReport?.timingDeltas?.length > 0
                                ? diffReport.timingDeltas.map(d => (
                                    <div key={d.method} style={{
                                        display: "flex", justifyContent: "space-between",
                                        fontSize: 11, marginBottom: 4,
                                        color: d.deltaMs > 0 ? COLORS.red : COLORS.green,
                                    }}>
                                        <span style={{ fontFamily: "monospace", fontSize: 10 }}>
                                            {d.method.split(".").pop()}
                                        </span>
                                        <strong>{d.deltaMs > 0 ? "+" : ""}{d.deltaMs}ms</strong>
                                    </div>
                                ))
                                : <div style={{ fontSize: 10, color: COLORS.muted }}>
                                    No overlapping methods to compare.
                                </div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
