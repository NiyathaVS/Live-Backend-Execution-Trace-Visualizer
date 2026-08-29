import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

/*
 * TraceTree — live D3 call-tree.
 *
 * DESIGN PRINCIPLES that prevent the two reported bugs:
 *
 * 1. NO full redraw on every event.
 *    The tree is only fully rebuilt when the *structure* changes (a new node
 *    is added or the selected request changes).  A "fingerprint" string
 *    (requestId + nodeCount) is stored in a ref and compared before each
 *    draw — if it hasn't changed, the draw effect returns early.  This
 *    eliminates the blink caused by `data` getting a new object reference on
 *    every WebSocket message.
 *
 * 2. Idle-pulse particles are driven by setInterval, NOT by latestEvent.
 *    An interval fires every ~700ms and sends a particle along every edge that
 *    is currently rendered.  Particle speed encodes execution time — fast
 *    methods get fast particles, contention/slow nodes get slow flickering
 *    ones.  This gives the "constant live flow" feeling at all times, even
 *    between API calls.
 *
 * 3. latestEvent still fires an *extra* burst particle on the exact edge of
 *    the newly arrived node so new spans light up immediately.
 */
export default function TraceTree({
    data,
    slowPathEventIds,
    methodFilter,
    collapsedEventIds,
    onNodeClick,
    onToggleCollapse,
    latestEvent,
}) {
    const svgRef           = useRef(null);
    const gRef             = useRef(null);
    const particlesRef     = useRef([]);
    const edgePathsRef     = useRef(new Map());   // edgeKey → SVGPathElement
    const edgeMetaRef      = useRef(new Map());   // edgeKey → { ms, slowPath, contention, error }
    const maxMsRef         = useRef(1);           // max executionTimeMs in current trace — normalises particle speed
    const nodeIndexRef     = useRef([]);
    const focusedIndexRef  = useRef(0);
    const lastFingerprintRef = useRef("");         // "requestId|nodeCount" — guards full redraws

    // ── keyboard nav ────────────────────────────────────────────────────────
    const handleKeyDown = useCallback((e) => {
        const nodes = nodeIndexRef.current;
        if (!nodes.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            focusedIndexRef.current = Math.min(focusedIndexRef.current + 1, nodes.length - 1);
            nodes[focusedIndexRef.current]?.focus?.();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            focusedIndexRef.current = Math.max(focusedIndexRef.current - 1, 0);
            nodes[focusedIndexRef.current]?.focus?.();
        } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            const el = nodes[focusedIndexRef.current];
            if (el?.__d3data__ && onNodeClick) onNodeClick(el.__d3data__.data);
        } else if (e.key === "Escape") {
            const el = nodes[focusedIndexRef.current];
            if (el?.__d3data__?.data?.eventId && onToggleCollapse)
                onToggleCollapse(el.__d3data__.data.eventId);
        }
    }, [onNodeClick, onToggleCollapse]);

    // ── RAF particle loop (always running) ──────────────────────────────────
    useEffect(() => {
        let animId;
        function tick() {
            const now = Date.now();
            const particles = particlesRef.current;
            if (particles.length > 0 && gRef.current) {
                const layer = gRef.current;
                const done  = [];

                for (const p of particles) {
                    // ── Contention stall: particle freezes mid-path, pulses in
                    // size and opacity to clearly signal "blocked / waiting".
                    if (p.stallUntil && now < p.stallUntil) {
                        if (p.el) {
                            const t       = (now - (p.stallUntil - 3000)) / 3000; // 0→1 over stall
                            const pulse   = 0.4 + 0.6 * Math.abs(Math.sin(now / 200));
                            const r       = 5 + 4 * pulse;   // radius grows 5→9 px
                            d3.select(p.el)
                                .attr("opacity", 0.5 + 0.5 * pulse)
                                .attr("r", r);
                        }
                        continue;
                    }
                    if (p.stallUntil) {
                        // Stall just ended — reset radius
                        p.stallUntil = null;
                        if (p.el) d3.select(p.el).attr("r", 5);
                    }

                    p.t += p.speed;

                    // Trigger one stall mid-path for contention particles
                    if (p.contention && !p.stalled && p.t >= 0.45) {
                        p.stalled    = true;
                        p.stallUntil = now + 3000; // freeze 3 s mid-edge
                    }

                    if (p.t >= 1) { done.push(p); continue; }

                    const pathEl = edgePathsRef.current.get(p.edgeKey);
                    if (!pathEl) { done.push(p); continue; }

                    const len = pathEl.getTotalLength();
                    const pt  = pathEl.getPointAtLength(p.t * len);

                    if (!p.el) {
                        const color = p.error ? "#ef4444" : p.contention ? "#a78bfa" : "#38bdf8";
                        p.el = d3.select(layer)
                            .append("circle")
                            .attr("class", "particle")
                            .attr("r", p.error ? 6 : p.contention ? 5 : 4)
                            .attr("fill", color)
                            .attr("filter", `drop-shadow(0 0 ${p.contention ? 8 : 4}px ${color})`)
                            .style("pointer-events", "none")
                            .node();
                    }
                    d3.select(p.el).attr("cx", pt.x).attr("cy", pt.y).attr("opacity", 0.9);
                }

                for (const p of done) {
                    if (p.el) { d3.select(p.el).remove(); p.el = null; }
                    const i = particles.indexOf(p);
                    if (i !== -1) particles.splice(i, 1);
                }
            }
            animId = requestAnimationFrame(tick);
        }
        animId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animId);
    }, []);

    // ── idle pulse: one particle per edge ────────────────────────────────────
    //
    // Speed is ms-based but normalised against the max *leaf* span duration so
    // container spans (which accumulate child time) don't dominate the range.
    //
    // leafMaxMsRef is set during each structural draw.
    //
    //   error      → 0.012  fast urgent red
    //   contention → 0.0015 + 3 s stall mid-path
    //   otherwise  → lerp(0.012, 0.0028, ms/leafMaxMs)
    //                SQL 2ms → ~0.012 (fast)
    //                100ms   → ~0.0045 (slow)
    //
    useEffect(() => {
        const id = setInterval(() => {
            const paths = edgePathsRef.current;
            const meta  = edgeMetaRef.current;
            if (paths.size === 0) return;

            paths.forEach((_, key) => {
                const existing = particlesRef.current.filter(p => p.edgeKey === key);
                if (existing.length >= 1) return;

                const m     = meta.get(key) ?? {};
                const ms    = m.ms ?? 50;
                const leafMax = maxMsRef.current;
                const ratio   = Math.min(ms / leafMax, 1);
                // lerp: fastest=0.012, slowest=0.0028
                const baseSpeed = 0.012 - ratio * (0.012 - 0.0028);

                const speed = m.error      ? 0.012
                            : m.contention ? 0.0015
                            :                baseSpeed;

                particlesRef.current.push({
                    t: 0, speed,
                    edgeKey:    key,
                    error:      !!m.error,
                    contention: !!m.contention,
                    stalled:    false,
                    stallUntil: null,
                    el: null,
                });
            });
        }, 1200);
        return () => clearInterval(id);
    }, []);

    // ── burst particle on new live event ────────────────────────────────────
    useEffect(() => {
        if (!latestEvent) return;
        const key = edgeKey(
            { spanId: latestEvent.parentSpanId, method: latestEvent.parentMethod },
            latestEvent
        );
        if (!edgePathsRef.current.has(key)) return;
        const isError = latestEvent.status === "ERROR" || !!latestEvent.hasError;
        const ms      = latestEvent.executionTimeMs ?? 50;
        const ratio   = Math.min(ms / maxMsRef.current, 1);
        const speed   = isError            ? 0.012
                      : latestEvent.contentionRisk ? 0.0015
                      : 0.012 - ratio * (0.012 - 0.0028);
        particlesRef.current.push({
            t: 0, speed,
            edgeKey:    key,
            error:      isError,
            contention: !!latestEvent.contentionRisk,
            stalled:    false,
            stallUntil: null,
            el: null,
        });
    }, [latestEvent]);

    // ── structural draw — only when fingerprint changes ──────────────────────
    useEffect(() => {
        if (!data) return;

        // Count non-ROOT nodes to form the fingerprint
        let nodeCount = 0;
        function countNodes(n) {
            if (n.method !== "ROOT") nodeCount++;
            (n.children || []).forEach(countNodes);
        }
        countNodes(data);

        const fp = `${data.requestId ?? "?"}|${nodeCount}|${methodFilter ?? ""}|${collapsedEventIds?.size ?? 0}`;
        if (fp === lastFingerprintRef.current) return;   // structure unchanged → skip
        lastFingerprintRef.current = fp;

        // ── full rebuild ────────────────────────────────────────────────────
        const svgEl = svgRef.current;
        const svg   = d3.select(svgEl);

        // Remove everything except particle circles so in-flight dots survive redraws.
        // We must detach structural elements (defs, g.link, g.node) while keeping
        // any <circle class="particle"> that the RAF loop already appended to the
        // old <g>.  After the new <g> is created below, we re-parent survivors into it.
        const survivingParticles = Array.from(svgEl.querySelectorAll("circle.particle"))
            .map(el => el.parentNode.removeChild(el));
        svg.selectAll("*").remove();
        edgePathsRef.current.clear();
        edgeMetaRef.current.clear();
        nodeIndexRef.current  = [];
        focusedIndexRef.current = 0;

        const containerW = svgEl.parentElement?.clientWidth || 1000;
        const DX = 160, DY = 120;

        const treeData = cloneWithCollapse(data, collapsedEventIds);
        const root     = d3.hierarchy(treeData, d => d.children);
        d3.tree().nodeSize([DX, DY]).separation((a, b) => a.parent === b.parent ? 1.2 : 1.8)(root);

        // Normalise particle speed against the max *leaf* span duration.
        // Leaf nodes have no children, so their executionTimeMs is pure self-time
        // uncontaminated by child accumulation.  Fallback: use max of all nodes.
        let leafMaxMs = 1;
        root.descendants().forEach(d => {
            const ms = d.data.executionTimeMs ?? 0;
            if (ms > 0 && (!d.children || d.children.length === 0)) {
                if (ms > leafMaxMs) leafMaxMs = ms;
            }
        });
        // If every node has children (degenerate trace), fall back to overall max
        if (leafMaxMs === 1) {
            root.descendants().forEach(d => {
                if ((d.data.executionTimeMs ?? 0) > leafMaxMs) leafMaxMs = d.data.executionTimeMs;
            });
        }
        maxMsRef.current = leafMaxMs;

        const xs = root.descendants().map(d => d.x);
        const ys = root.descendants().map(d => d.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs);
        const y0 = Math.min(...ys), y1 = Math.max(...ys);

        const W = Math.max(containerW, x1 - x0 + DX * 4);
        const H = Math.max(460, y1 - y0 + DY * 4);

        svg.attr("viewBox", [0, 0, W, H]).attr("width", "100%").attr("height", H);

        // defs — glow filters
        const defs = svg.append("defs");
        [["orange-glow","#f97316"],["red-glow","#ef4444"],["blue-glow","#38bdf8"]].forEach(([id, col]) => {
            const f = defs.append("filter").attr("id", id)
                .attr("x","-60%").attr("y","-60%").attr("width","220%").attr("height","220%");
            f.append("feGaussianBlur").attr("stdDeviation","3").attr("result","blur");
            f.append("feFlood").attr("flood-color", col).attr("flood-opacity","0.55").attr("result","c");
            f.append("feComposite").attr("in","c").attr("in2","blur").attr("operator","in").attr("result","sh");
            const m = f.append("feMerge");
            m.append("feMergeNode").attr("in","sh");
            m.append("feMergeNode").attr("in","SourceGraphic");
        });

        const offsetX = W / 2 - root.x;
        const g = svg.append("g").attr("transform", `translate(${offsetX},${50 - y0})`);
        gRef.current = g.node();

        // Re-attach surviving particle dots into the new <g> so the RAF loop
        // can keep animating them without hitting a detached DOM node.
        survivingParticles.forEach(el => gRef.current.appendChild(el));

        // ── edges ──────────────────────────────────────────────────────────
        // Cubic bezier where control points are offset both vertically AND
        // horizontally.  The horizontal nudge of ±20px ensures the curve is
        // always visible even when source and target share the same x (ROOT →
        // single child is a common case that collapses to a hairline otherwise).
        const curvedLink = ({ source: s, target: t }) => {
            const dy  = t.y - s.y;
            const vOff = dy * 0.35;     // vertical offset – pulls control pts inward
            const hOff = 20;            // horizontal nudge – guarantees visible arc
            return `M${s.x},${s.y} C${s.x + hOff},${s.y + vOff} ${t.x - hOff},${t.y - vOff} ${t.x},${t.y}`;
        };

        g.selectAll(".link")
            .data(root.links())
            .join("path")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", d => edgeColor(d.target, slowPathEventIds))
            .attr("stroke-width", d => {
                if (d.target.data.status === "ERROR" || d.target.data.hasError) return 2.5;
                if (isOnSlowPath(d.target, slowPathEventIds)) return 2.5;
                if (d.target.data.contentionRisk) return 2;
                return 1.8;
            })
            .attr("stroke-dasharray", d => d.target.data.contentionRisk ? "5 4" : null)
            .attr("filter", d => isOnSlowPath(d.target, slowPathEventIds) ? "url(#orange-glow)" : null)
            .attr("d", curvedLink)
            .attr("opacity", d => isDimmed(d.target, methodFilter) ? 0.12 : 0.9)
            .each(function(d) {
                const key = edgeKey(d.source.data, d.target.data);
                edgePathsRef.current.set(key, this);
                // Store metadata so idle-pulse can colour particles correctly
                edgeMetaRef.current.set(key, {
                    ms:         d.target.data.executionTimeMs ?? 50,
                    slowPath:   !!d.target.data.slowPath,
                    contention: !!d.target.data.contentionRisk,
                    error:      d.target.data.status === "ERROR" || !!d.target.data.hasError,
                });
            });

        // ── nodes ──────────────────────────────────────────────────────────
        const node = g.selectAll(".node")
            .data(root.descendants())
            .join("g")
            .attr("class", "node")
            .attr("role", "treeitem")
            .attr("tabindex", (_, i) => i === 0 ? 0 : -1)
            .attr("aria-label", d => {
                const name = shortName(d.data.methodName ?? d.data.method ?? "ROOT");
                return `${name}, ${d.data.executionTimeMs ?? "unknown"} ms`;
            })
            // Final position (no animation yet — set first so layout is correct)
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .style("opacity", d => isDimmed(d, methodFilter) ? 0.25 : 1)
            .style("cursor", "pointer")
            .each(function(d) {
                nodeIndexRef.current.push(this);
                this.__d3data__ = d;
            })
            .on("click", (ev, d) => { ev.stopPropagation(); onNodeClick?.(d.data); })
            .on("dblclick", (ev, d) => { ev.stopPropagation(); if (d.data.eventId) onToggleCollapse?.(d.data.eventId); })
            .on("focus", function() { d3.select(this).select(".node-ring").attr("stroke","#fbbf24").attr("stroke-width",3); })
            .on("blur", function(_, d) {
                d3.select(this).select(".node-ring")
                    .attr("stroke", nodeRingColor(d.data, slowPathEventIds))
                    .attr("stroke-width", nodeRingWidth(d.data));
            });

        // Animate nodes in from scale(0) → scale(1), staggered
        // This only runs once per structural change, NOT per event.
        node.attr("transform", d => `translate(${d.x},${d.y}) scale(0)`)
            .transition().duration(260).delay((_, i) => i * 20).ease(d3.easeCubicOut)
            .attr("transform", d => `translate(${d.x},${d.y}) scale(1)`);

        // Glow halo for error / contention
        node.filter(d => d.data.status === "ERROR" || d.data.hasError || d.data.contentionRisk)
            .append("circle")
            .attr("r", 15)
            .attr("fill", "none")
            .attr("stroke", d => (d.data.status === "ERROR" || d.data.hasError) ? "#ef4444" : "#a78bfa")
            .attr("stroke-width", 0.6).attr("opacity", 0.45).attr("class", "halo");

        // Main circle
        node.append("circle")
            .attr("class", "node-ring")
            .attr("r", d => nodeRadius(d.data))
            .attr("fill", d => nodeFill(d.data))
            .attr("stroke", d => nodeRingColor(d.data, slowPathEventIds))
            .attr("stroke-width", d => nodeRingWidth(d.data))
            .attr("filter", d => {
                if (d.data.status === "ERROR" || d.data.hasError) return "url(#red-glow)";
                if (isOnSlowPath(d, slowPathEventIds)) return "url(#orange-glow)";
                if (isSqlNode(d.data)) return "url(#blue-glow)";
                return null;
            });

        // Duration badge inside circle
        node.filter(d => d.data.executionTimeMs != null && d.data.method !== "ROOT")
            .append("text")
            .attr("text-anchor", "middle").attr("dy", "0.35em")
            .style("font-size", "7px").style("font-weight", "700")
            .style("fill", "#fff").style("pointer-events", "none")
            .text(d => d.data.executionTimeMs > 999
                ? (d.data.executionTimeMs / 1000).toFixed(1) + "s"
                : d.data.executionTimeMs + "ms");

        // Method label
        node.append("text")
            .attr("x", 16).attr("dy", "-0.3em")
            .style("font-size", "11.5px").style("font-weight", "600")
            .style("fill", d => isDimmed(d, methodFilter) ? "#4b5563" : "#e2e8f0")
            .style("pointer-events", "none")
            .text(d => {
                if (isSqlNode(d.data)) {
                    const sql = d.data.sql || d.data.params?.sql || d.data.method || "SQL";
                    const lbl = sql.replace(/^SQL:\s*/i, "");
                    return lbl.length > 30 ? lbl.slice(0, 27) + "…" : lbl;
                }
                const sn = shortName(d.data.methodName ?? d.data.method ?? "ROOT");
                return sn.length > 24 ? sn.slice(0, 21) + "…" : sn;
            });

        // Class sub-label
        node.filter(d => d.data.method && d.data.method !== "ROOT")
            .append("text")
            .attr("x", 16).attr("dy", "0.9em")
            .style("font-size", "9px").style("fill", "#64748b").style("pointer-events", "none")
            .text(d => {
                const stripped = (d.data.methodName ?? d.data.method ?? "").replace(/\(.*\)$/, "");
                const dot = stripped.lastIndexOf(".");
                const cls = dot > 0 ? stripped.slice(0, dot) : "";
                const pkg = cls.lastIndexOf(".");
                return pkg > 0 ? cls.slice(pkg + 1) : cls;
            });

        // Risk chips
        const CHIPS = [
            { check: d => d.status === "ERROR" || d.hasError,      label: "ERR",      color: "#ef4444" },
            { check: d => d.slowPath && d.eventType !== "SQL",      label: "SLOW",     color: "#f97316" },
            { check: d => isSqlNode(d) && !d.slowQuery,            label: "SQL",      color: "#38bdf8" },
            { check: d => d.slowQuery,                              label: "SLOW SQL", color: "#f97316" },
            { check: d => d.contentionRisk,                        label: "WAIT",     color: "#a78bfa" },
            { check: d => d.resourceLeakSuspicion,                 label: "LEAK?",    color: "#fbbf24" },
            { check: d => d.isOnCriticalPath,                      label: "CRIT",     color: "#06b6d4" },
        ];
        node.each(function(d) {
            if (d.data.method === "ROOT") return;
            const chips = CHIPS.filter(c => c.check(d.data));
            if (!chips.length) return;
            const cg = d3.select(this).append("g").attr("transform", "translate(16,14)");
            let ox = 0;
            chips.forEach(({ label, color }) => {
                const w = label.length * 5.2 + 8;
                cg.append("rect").attr("x", ox).attr("y", 0).attr("width", w).attr("height", 11)
                    .attr("rx", 3).attr("fill", color + "22").attr("stroke", color + "88").attr("stroke-width", 0.8);
                cg.append("text").attr("x", ox + w / 2).attr("y", 8).attr("text-anchor", "middle")
                    .style("font-size", "7.5px").style("font-weight", "700")
                    .style("fill", color).style("pointer-events", "none").text(label);
                ox += w + 3;
            });
        });

        // Tooltips
        node.append("title").text(d => buildTooltip(d.data));

        // Legend (pinned to bottom-left of SVG, not the <g>)
        const LG = [
            ["#22c55e", "Normal"],
            ["#f97316", "Slow / Critical"],
            ["#38bdf8", "SQL"],
            ["#ef4444", "Error"],
            ["#a78bfa", "Wait / Contention"],
        ];
        const lg = svg.append("g").attr("transform", `translate(10,${H - 18})`);
        let lx = 0;
        LG.forEach(([color, label]) => {
            lg.append("circle").attr("cx", lx + 4).attr("cy", 0).attr("r", 4).attr("fill", color);
            lg.append("text").attr("x", lx + 12).attr("y", 4)
                .style("font-size", "9px").style("fill", "#475569").text(label);
            lx += label.length * 5.6 + 18;
        });

    // NOTE: latestEvent is intentionally excluded from deps so new events
    // never trigger a redraw — only structural changes (node count) do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, slowPathEventIds, methodFilter, collapsedEventIds, onNodeClick, onToggleCollapse]);

    return (
        <svg
            ref={svgRef}
            role="tree"
            aria-label="Execution trace call tree"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            style={{ outline: "none", display: "block" }}
        />
    );
}

// ── pure helpers ─────────────────────────────────────────────────────────────

function shortName(raw) {
    if (!raw || raw === "ROOT") return "ROOT";
    const s = raw.replace(/\(.*\)$/, "");
    const d = s.lastIndexOf(".");
    return d !== -1 ? s.slice(d + 1) : s;
}

function isSqlNode(data) {
    if (!data) return false;
    return data.eventType === "SQL" || (typeof data.method === "string" && data.method.startsWith("SQL:"));
}

function isOnSlowPath(d3node, slowPathEventIds) {
    if (!slowPathEventIds?.size) return false;
    return !!(d3node.data?.eventId && slowPathEventIds.has(d3node.data.eventId));
}

function isDimmed(d3node, methodFilter) {
    if (!methodFilter) return false;
    const name = (d3node.data?.methodName ?? d3node.data?.method ?? "").toLowerCase();
    const sql  = (d3node.data?.sql ?? d3node.data?.params?.sql ?? "").toLowerCase();
    const q    = methodFilter.toLowerCase();
    return !name.includes(q) && !sql.includes(q);
}

function edgeKey(parent, child) {
    const p = parent?.spanId ?? parent?.method ?? "ROOT";
    const c = child?.spanId  ?? child?.eventId  ?? child?.method ?? "?";
    return `${p}→${c}`;
}

function nodeRadius(data) {
    if (data.method === "ROOT") return 7;
    if (data.status === "ERROR" || data.hasError) return 10;
    if (isSqlNode(data)) return 8;
    return 9;
}

function nodeFill(data) {
    if (data.method === "ROOT") return "#334155";
    if (data.status === "ERROR" || data.hasError) return "#7f1d1d";
    if (isSqlNode(data)) {
        if (data.slowQuery) return "#7c2d12";
        return d3.interpolateRgb("#0e7490", "#f97316")(Math.min((data.executionTimeMs || 0) / 500, 1));
    }
    if (data.contentionRisk) return "#4c1d95";
    return d3.interpolateRgb("#166534", "#7f1d1d")(Math.min((data.executionTimeMs || 0) / 300, 1));
}

function edgeColor(d3node, slowPathEventIds) {
    if (d3node.data?.status === "ERROR" || d3node.data?.hasError) return "#ef4444";
    if (d3node.data?.contentionRisk) return "#a78bfa";
    if (isOnSlowPath(d3node, slowPathEventIds)) return "#f97316";
    if (isSqlNode(d3node.data)) return "#38bdf8";
    // Default: visible steel-blue — was #374151 which is near-invisible on dark bg
    return "#4e6282";
}

function nodeRingColor(data, slowPathEventIds) {
    if (data.status === "ERROR" || data.hasError) return "#ef4444";
    if (data.slowQuery) return "#f97316";
    if (data.contentionRisk) return "#a78bfa";
    if (isSqlNode(data)) return "#38bdf8";
    if (data.isOnCriticalPath) return "#06b6d4";
    return "#6b7280";
}

function nodeRingWidth(data) {
    if (data.status === "ERROR" || data.hasError) return 2.5;
    if (data.contentionRisk || data.slowQuery) return 2;
    return 1.2;
}

function buildTooltip(data) {
    if (!data || data.method === "ROOT") return "ROOT — trace entry point";
    const name = shortName(data.methodName ?? data.method ?? "");
    const cls = (() => {
        const s = (data.methodName ?? data.method ?? "").replace(/\(.*\)$/, "");
        const d = s.lastIndexOf(".");
        return d > 0 ? s.slice(0, d) : "";
    })();
    return [
        `Method:  ${name}`,
        cls ? `Class:   ${cls}` : null,
        `Status:  ${data.status || "SUCCESS"}`,
        `Duration: ${data.executionTimeMs ?? "?"}ms`,
        data.threadName   ? `Thread:  ${data.threadName}` : null,
        data.threadState  ? `State:   ${data.threadState}` : null,
        data.contentionRisk       ? "⚠ Contention / lock wait" : null,
        data.slowPath             ? "⚠ Slow execution path" : null,
        data.isOnCriticalPath     ? "★ Critical path" : null,
        data.resourceLeakSuspicion ? "⚠ Possible resource leak" : null,
        data.errorMessage ? `Error:   ${data.errorMessage}` : null,
        isSqlNode(data) && data.sql ? `SQL:     ${data.sql.slice(0, 120)}` : null,
    ].filter(Boolean).join("\n");
}

function cloneWithCollapse(node, collapsedEventIds) {
    if (!node) return null;
    const collapse = collapsedEventIds && node.eventId && collapsedEventIds.has(node.eventId);
    return {
        ...node,
        children: collapse ? [] : (node.children || []).map(c => cloneWithCollapse(c, collapsedEventIds)),
    };
}
