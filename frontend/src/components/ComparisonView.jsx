import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

/**
 * Side-by-side trace comparison with diff highlighting.
 * addedMethods / removedMethods come from the backend diff API.
 */
export default function ComparisonView({
    data1,
    data2,
    label1,
    label2,
    addedMethods = [],
    removedMethods = []
}) {
    const ref1 = useRef(null);
    const ref2 = useRef(null);
    const containerRef = useRef(null);
    // Track container width so trees reflow correctly on window resize.
    const [containerWidth, setContainerWidth] = useState(0);

    const addedSet = new Set(addedMethods);
    const removedSet = new Set(removedMethods);

    // Observe container size and update state when it changes.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        observer.observe(el);
        // Set initial width immediately
        setContainerWidth(el.clientWidth);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!data1 || !ref1.current) return;
        renderTree(ref1.current, data1, removedSet, "removed", containerWidth);
    }, [data1, removedMethods, containerWidth]);

    useEffect(() => {
        if (!data2 || !ref2.current) return;
        renderTree(ref2.current, data2, addedSet, "added", containerWidth);
    }, [data2, addedMethods, containerWidth]);

    return (
        <div
            ref={containerRef}
            role="region"
            aria-label="Side-by-side trace comparison"
            style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                padding: 8,
                background: "linear-gradient(180deg, #0b1228 0%, #0a1432 100%)",
                borderRadius: 12
            }}
        >
            <div>
                <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
                    <strong>{label1}</strong>
                    {removedMethods.length > 0 && (
                        <span style={{ fontSize: 11, color: "#fca5a5", marginLeft: 8 }}>
                            ({removedMethods.length} removed in compare)
                        </span>
                    )}
                </div>
                <svg ref={ref1} style={{ width: "100%", minHeight: 260 }} aria-label={`Trace ${label1}`} />
            </div>
            <div>
                <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
                    <strong>{label2}</strong>
                    {addedMethods.length > 0 && (
                        <span style={{ fontSize: 11, color: "#86efac", marginLeft: 8 }}>
                            ({addedMethods.length} added vs base)
                        </span>
                    )}
                </div>
                <svg ref={ref2} style={{ width: "100%", minHeight: 260 }} aria-label={`Trace ${label2}`} />
            </div>
        </div>
    );
}

function renderTree(svgEl, data, highlightSet, highlightType, containerWidth) {
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const effectiveWidth = containerWidth > 0 ? containerWidth : (svgEl.parentElement?.clientWidth || 500);
    const dx = 120;
    const dy = 70;

    const root = d3.hierarchy(data, (d) => d.children);
    d3.tree().nodeSize([dx, dy])(root);

    const x0 = d3.min(root.descendants(), (d) => d.x) ?? 0;
    const x1 = d3.max(root.descendants(), (d) => d.x) ?? 0;
    const y1 = d3.max(root.descendants(), (d) => d.y) ?? 0;

    const width = Math.max(effectiveWidth, x1 - x0 + dx * 2);
    const height = Math.max(260, y1 + dy * 2);

    svg.attr("viewBox", [0, 0, width, height])
        .attr("width", "100%")
        .attr("height", height);

    const g = svg.append("g").attr("transform", `translate(${width / 2 - (x0 + x1) / 2}, 30)`);

    g.selectAll(".link")
        .data(root.links())
        .join("path")
        .attr("fill", "none")
        .attr("stroke", "#4b5563")
        .attr("stroke-width", 1.5)
        .attr("d", d3.linkVertical().x((d) => d.x).y((d) => d.y));

    const nodes = g
        .selectAll(".node")
        .data(root.descendants())
        .join("g")
        .attr("transform", (d) => `translate(${d.x},${d.y})`);

    nodes
        .append("circle")
        .attr("r", 6)
        .attr("stroke", (d) => nodeStroke(d, highlightSet, highlightType))
        .attr("stroke-width", (d) => (isHighlighted(d, highlightSet) ? 2.5 : 1.5))
        .attr("fill", (d) => nodeFill(d, highlightSet, highlightType));

    nodes
        .append("text")
        .attr("dy", -12)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#f4f8ff")
        .text((d) => shortLabel(d.data));

    nodes
        .append("text")
        .attr("dy", 14)
        .attr("text-anchor", "middle")
        .style("font-size", "9px")
        .style("fill", "#94a3b8")
        .style("font-family", "ui-monospace, monospace")
        .text((d) => (d.data.executionTimeMs != null ? `${d.data.executionTimeMs}ms` : ""));
}

function methodKey(data) {
    return data?.methodName ?? data?.method ?? "";
}

function isHighlighted(d, highlightSet) {
    return highlightSet.has(methodKey(d.data));
}

function nodeStroke(d, highlightSet, highlightType) {
    if (d.data.status === "ERROR" || d.data.hasError) return "#ef4444";
    if (isHighlighted(d, highlightSet)) {
        return highlightType === "added" ? "#22c55e" : "#ef4444";
    }
    return "#64b5f6";
}

function nodeFill(d, highlightSet, highlightType) {
    if (d.data.status === "ERROR" || d.data.hasError) return "#7f1d1d";
    if (isHighlighted(d, highlightSet)) {
        return highlightType === "added" ? "#14532d" : "#7f1d1d";
    }
    const time = d.data.executionTimeMs;
    if (time == null) return "#374151";
    const ratio = Math.min(time / 200, 1);
    return d3.interpolateRgb("#166534", "#b45309")(ratio);
}

function shortLabel(data) {
    let label = methodKey(data) || "ROOT";
    const lastDot = label.lastIndexOf(".");
    if (lastDot >= 0) label = label.slice(lastDot + 1);
    const paren = label.indexOf("(");
    if (paren >= 0) label = label.slice(0, paren);
    return label.length > 20 ? label.slice(0, 17) + "..." : label;
}
