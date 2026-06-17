import React, { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

export default function TraceTree({
    data,
    slowPathEventIds,
    methodFilter,
    collapsedEventIds,
    onNodeClick,
    onToggleCollapse
}) {
    const ref = useRef(null);

    useEffect(() => {
        if (!data) return;

        const svgEl = ref.current;
        const svg = d3.select(svgEl);
        svg.selectAll("*").remove();

        const containerWidth = svgEl.parentElement
            ? svgEl.parentElement.clientWidth
            : 1000;
        // Vertical tree: x = horizontal, y = depth (vertical).
        // Use generous spacing so the structure is clear.
        const dx = 200; // horizontal spacing between siblings
        const dy = 110; // vertical spacing between levels

        const treeData = cloneWithCollapse(data, collapsedEventIds);
        const root = d3.hierarchy(treeData, (d) => d.children);

        const treeLayout = d3
            .tree()
            .nodeSize([dx, dy])
            .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.8));
        treeLayout(root);

        const x0 = d3.min(root.descendants(), (d) => d.x) ?? 0;
        const x1 = d3.max(root.descendants(), (d) => d.x) ?? 0;
        const y0 = d3.min(root.descendants(), (d) => d.y) ?? 0;
        const y1 = d3.max(root.descendants(), (d) => d.y) ?? 0;

        const width = Math.max(containerWidth, x1 - x0 + dx * 4);
        const height = Math.max(400, y1 - y0 + dy * 4);

        svg.attr("viewBox", [0, 0, width, height])
            .attr("width", "100%")
            .attr("height", height);

        // Center the ROOT horizontally in the available width.
        const rootX = root.x;
        const centerX = width / 2;
        const offsetX = centerX - rootX;

        const g = svg
            .append("g")
            .attr("transform", `translate(${offsetX}, ${40 - y0})`);

        const linkColor = "#4b5563";

        g.selectAll(".link")
            .data(root.links())
            .join("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", (d) =>
                isOnSlowPath(d.target, slowPathEventIds) ? "#f97316" : linkColor
            )
            .attr("stroke-width", (d) =>
                isOnSlowPath(d.target, slowPathEventIds) ? 2 : 1.2
            )
            .attr(
                "d",
                d3
                    .linkVertical()
                    .x((d) => d.x)
                    .y((d) => d.y)
            )
            .attr("opacity", (d) =>
                isDimmed(d.target, methodFilter) ? 0.25 : 0.8
            );

        const node = g
            .selectAll(".node")
            .data(root.descendants())
            .join("g")
            .attr("class", "node")
            .attr("transform", (d) => `translate(${d.x},${d.y})`)
            .style("opacity", (d) => (isDimmed(d, methodFilter) ? 0.35 : 1))
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                if (onNodeClick) {
                    onNodeClick(d.data);
                }
            });

        node.append("circle")
            .attr("r", (d) => (isSqlNode(d.data) ? 6 : 7))
            .attr("stroke", (d) => {
                if (d.data.status === "ERROR") return "#ef4444";
                if (d.data.slowQuery) return "#f97316";
                if (isOnSlowPath(d, slowPathEventIds)) return "#f97316";
                if (isSqlNode(d.data)) return "#38bdf8";
                return "#e5e7eb";
            })
            .attr("stroke-width", (d) =>
                d.data.slowQuery || isOnSlowPath(d, slowPathEventIds) ? 2.5 : 1.2
            )
            .attr("fill", (d) => {
                if (d.data.status === "ERROR") return "#7f1d1d";
                if (isSqlNode(d.data)) {
                    if (d.data.slowQuery) return "#7c2d12";
                    const time = d.data.executionTimeMs;
                    const ratio = Math.min((time || 0) / 500, 1);
                    return d3.interpolateRgb("#0e7490", "#f97316")(ratio);
                }
                const time = d.data.executionTimeMs;
                if (time == null) return "#4b5563";

                const ratio = Math.min(time / 200, 1);
                return d3.interpolateRgb("#22c55e", "#ef4444")(ratio);
            })
            .on("click", (event, d) => {
                event.stopPropagation();
                if (onNodeClick) {
                    onNodeClick(d.data);
                }
            })
            .on("dblclick", (event, d) => {
                event.stopPropagation();
                if (onToggleCollapse && d.data.eventId) {
                    onToggleCollapse(d.data.eventId);
                }
            });

        node.append("title").text((d) => {
            if (isSqlNode(d.data)) {
                return `SQL Query
${d.data.sql || d.data.params?.sql || d.data.method}
Duration: ${d.data.executionTimeMs} ms
Slow query: ${d.data.slowQuery ? "YES (>500ms)" : "no"}
Parent: ${d.data.parentMethod || "ROOT"}`;
            }
            return `Method: ${d.data.method}
Status: ${d.data.status || "SUCCESS"}
Execution: ${d.data.executionTimeMs} ms
Params: ${JSON.stringify(d.data.params, null, 2)}
Return: ${JSON.stringify(d.data.returnValue)}
Error: ${d.data.errorMessage || "-"}`;
        });

        // Compact labels next to each node so they are always visible.
        node.append("text")
            .attr("x", 14)
            .attr("dy", 4)
            .attr("textAnchor", "start")
            .style("fontSize", "12px")
            .style("fill", "#e5e7eb")
            .text((d) => {
                if (isSqlNode(d.data)) {
                    const sql =
                        d.data.sql ||
                        d.data.params?.sql ||
                        d.data.method ||
                        "SQL";
                    const label = sql.replace(/^SQL:\s*/i, "");
                    return label.length > 32
                        ? label.slice(0, 29) + "..."
                        : label;
                }
                const raw = d.data.methodName ?? d.data.method ?? "ROOT";
                const simple =
                    raw.lastIndexOf(".") !== -1
                        ? raw.slice(raw.lastIndexOf(".") + 1)
                        : raw;
                return simple.length > 26
                    ? simple.slice(0, 23) + "..."
                    : simple;
            })
            .on("click", (event, d) => {
                event.stopPropagation();
                if (onNodeClick) {
                    onNodeClick(d.data);
                }
            });
    }, [data, slowPathEventIds, methodFilter, collapsedEventIds, onNodeClick, onToggleCollapse]);

    return <svg ref={ref} />;
}

function isSqlNode(data) {
    if (!data) return false;
    return (
        data.eventType === "SQL" ||
        (typeof data.method === "string" && data.method.startsWith("SQL:"))
    );
}

function isOnSlowPath(node, slowPathEventIds) {
    if (!slowPathEventIds || slowPathEventIds.size === 0) return false;
    return !!(node.data && node.data.eventId && slowPathEventIds.has(node.data.eventId));
}

function isDimmed(node, methodFilter) {
    if (!methodFilter) return false;
    const name = (node.data.methodName ?? node.data.method ?? "").toLowerCase();
    const sql = (node.data.sql ?? node.data.params?.sql ?? "").toLowerCase();
    const q = methodFilter.toLowerCase();
    return !name.includes(q) && !sql.includes(q);
}

function cloneWithCollapse(node, collapsedEventIds) {
    if (!node) return null;
    const shouldCollapse =
        collapsedEventIds && node.eventId && collapsedEventIds.has(node.eventId);

    const children =
        !shouldCollapse && node.children
            ? node.children.map((c) => cloneWithCollapse(c, collapsedEventIds))
            : [];

    return {
        ...node,
        children
    };
}

