import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function ComparisonView({ data1, data2, label1, label2 }) {
    const ref1 = useRef(null);
    const ref2 = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!data1 || !ref1.current || !containerRef.current) return;

        const container = d3.select(containerRef.current);
        const svg1 = d3.select(ref1.current);
        svg1.selectAll("*").remove();

        const width = 600;
        const height = 600;
        const dx = 110;
        const dy = 250;

        const root = d3.hierarchy(data1, d => d.children);
        const treeLayout = d3.tree().nodeSize([dx, dy]);
        treeLayout(root);

        svg1
            .attr("width", width)
            .attr("height", height)
            .style("background-color", "#0a1225")
            .style("border-radius", "8px")
            .style("border", "1px solid #1f365d");

        const g = svg1.append("g").attr("transform", `translate(100, 50)`);

        g.selectAll(".link")
            .data(root.links())
            .join("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#7b8ca5")
            .attr("stroke-width", 2)
            .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x));

        const nodes = g
            .selectAll(".node")
            .data(root.descendants())
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.y}, ${d.x})`);

        nodes
            .append("circle")
            .attr("r", 6)
            .attr("stroke", "#64b5f6")
            .attr("stroke-width", 2)
            .attr("fill", d => {
                const time = d.data.executionTimeMs;
                if (time == null) return "#818c9f";
                const ratio = Math.min(time / 200, 1);
                return d3.interpolateRgb("#4cd964", "#f39c12")(ratio);
            });

        nodes
            .append("text")
            .attr("dy", "-16px")
            .attr("text-anchor", "middle")
            .style("font-size", "11px")
            .style("fill", "#f4f8ff")
            .style("pointer-events", "none")
            .text(d => {
                let label = (d.data.method || d.data.methodName || "ROOT");
                const lastDot = label.lastIndexOf(".");
                if (lastDot >= 0) label = label.slice(lastDot + 1);
                const paren = label.indexOf("(");
                if (paren >= 0) label = label.slice(0, paren);
                return label;
            });

        nodes
            .append("text")
            .attr("dy", "16px")
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#aad2ff")
            .style("pointer-events", "none")
            .text(d => (d.data.executionTimeMs != null ? `${d.data.executionTimeMs}ms` : ""));

    }, [data1]);

    useEffect(() => {
        if (!data2 || !ref2.current || !containerRef.current) return;

        const svg2 = d3.select(ref2.current);
        svg2.selectAll("*").remove();

        const width = 600;
        const height = 600;
        const dx = 110;
        const dy = 250;

        const root = d3.hierarchy(data2, d => d.children);
        const treeLayout = d3.tree().nodeSize([dx, dy]);
        treeLayout(root);

        svg2
            .attr("width", width)
            .attr("height", height)
            .style("background-color", "#0a1225")
            .style("border-radius", "8px")
            .style("border", "1px solid #1f365d");

        const g = svg2.append("g").attr("transform", `translate(100, 50)`);

        g.selectAll(".link")
            .data(root.links())
            .join("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#7b8ca5")
            .attr("stroke-width", 2)
            .attr("d", d3.linkHorizontal().x(d => d.y).y(d => d.x));

        const nodes = g
            .selectAll(".node")
            .data(root.descendants())
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.y}, ${d.x})`);

        nodes
            .append("circle")
            .attr("r", 6)
            .attr("stroke", "#64b5f6")
            .attr("stroke-width", 2)
            .attr("fill", d => {
                if (d.data.hasError) return "#ff5f5f";
                const time = d.data.executionTimeMs;
                if (time == null) return "#818c9f";
                const ratio = Math.min(time / 200, 1);
                return d3.interpolateRgb("#4cd964", "#f39c12")(ratio);
            });

        nodes
            .append("text")
            .attr("dy", "-16px")
            .attr("text-anchor", "middle")
            .style("font-size", "11px")
            .style("fill", "#f4f8ff")
            .style("pointer-events", "none")
            .text(d => {
                let label = (d.data.method || d.data.methodName || "ROOT");
                const lastDot = label.lastIndexOf(".");
                if (lastDot >= 0) label = label.slice(lastDot + 1);
                const paren = label.indexOf("(");
                if (paren >= 0) label = label.slice(0, paren);
                return label;
            });

        nodes
            .append("text")
            .attr("dy", "16px")
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#aad2ff")
            .style("pointer-events", "none")
            .text(d => (d.data.executionTimeMs != null ? `${d.data.executionTimeMs}ms` : ""));

    }, [data2]);

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                padding: 16,
                background: "linear-gradient(180deg, #0b1228 0%, #0a1432 100%)",
                borderRadius: 12
            }}
        >
            <div>
                <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
                    <strong>{label1}</strong>
                </div>
                <svg ref={ref1} style={{ width: "100%", maxWidth: "600px" }} />
            </div>
            <div>
                <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
                    <strong>{label2}</strong>
                </div>
                <svg ref={ref2} style={{ width: "100%", maxWidth: "600px" }} />
            </div>
        </div>
    );
}
