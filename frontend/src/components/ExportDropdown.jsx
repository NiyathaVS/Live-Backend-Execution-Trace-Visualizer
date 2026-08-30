import React, { useState, useEffect, useRef } from "react";
import { COLORS, SHADOWS } from "../theme.jsx";
import { exportUrl, otelExportUrl, persistTrace } from "../services/traceApi";

export default function ExportDropdown({ requestId }) {
    const [open, setOpen]           = useState(false);
    const [shareLink, setShareLink] = useState(null);
    const [copied, setCopied]       = useState(false);
    const [sharing, setSharing]     = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleShare = async () => {
        setSharing(true);
        try {
            const result = await persistTrace(requestId);
            const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:8080";
            setShareLink(`${base}${result.sharePath}`);
        } catch {
            setShareLink(null);
        } finally {
            setSharing(false);
        }
    };

    const handleCopy = () => {
        if (!shareLink) return;
        navigator.clipboard.writeText(shareLink).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div ref={ref} style={{ position: "relative" }}>
            {/* Trigger button */}
            <button onClick={() => setOpen(o => !o)} style={{
                padding: "6px 14px",
                borderRadius: 9,
                border: `1px solid ${open ? COLORS.borderMid : COLORS.border}`,
                background: open
                    ? `linear-gradient(135deg, ${COLORS.blue}18, ${COLORS.cyan}10)`
                    : "rgba(5,12,26,0.6)",
                color: open ? COLORS.blue : COLORS.textSoft,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                boxShadow: open ? `0 0 14px ${COLORS.blueGlow}` : SHADOWS.neoRaised,
                transition: "all 0.2s",
                letterSpacing: 0.2,
            }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>↓</span>
                Export
                <span style={{ fontSize: 9, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
            </button>

            {/* Dropdown panel */}
            {open && (
                <div style={{
                    position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                    minWidth: 210,
                    background: COLORS.glassBright,
                    border: `1px solid ${COLORS.borderMid}`,
                    borderRadius: 14,
                    boxShadow: SHADOWS.glassHover,
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    padding: "6px 0",
                    animation: "fadeSlideIn 0.18s ease",
                    overflow: "hidden",
                }}>
                    {/* Export links */}
                    {[
                        { label: "JSON Trace",          fmt: "json", icon: "{ }" },
                        { label: "SVG Diagram",         fmt: "svg",  icon: "◻"  },
                        { label: "PDF Report",          fmt: "pdf",  icon: "📄" },
                        { label: "OpenTelemetry OTLP",  fmt: "otel", icon: "⬡"  },
                    ].map(({ label, fmt, icon }) => (
                        <a
                            key={fmt}
                            href={fmt === "otel" ? otelExportUrl(requestId) : exportUrl(requestId, fmt)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setOpen(false)}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "9px 16px",
                                color: COLORS.textSoft, fontSize: 12,
                                textDecoration: "none",
                                transition: "background 0.1s",
                                cursor: "pointer",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = `${COLORS.blue}10`}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            <span style={{
                                width: 22, height: 22, borderRadius: 6,
                                background: `${COLORS.blue}15`,
                                border: `1px solid ${COLORS.blue}20`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 10, color: COLORS.blue, flexShrink: 0,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}>{icon}</span>
                            {label}
                            <span style={{
                                marginLeft: "auto", fontSize: 9, fontWeight: 700,
                                color: COLORS.muted, fontFamily: "'JetBrains Mono', monospace",
                                letterSpacing: 0.5, textTransform: "uppercase",
                            }}>{fmt}</span>
                        </a>
                    ))}

                    {/* Divider */}
                    <div style={{ height: 1, background: COLORS.border, margin: "4px 0" }} />

                    {/* Share link section */}
                    {!shareLink ? (
                        <button
                            onClick={handleShare}
                            disabled={sharing}
                            style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "9px 16px", width: "100%", textAlign: "left",
                                background: "none", border: "none", cursor: sharing ? "wait" : "pointer",
                                color: COLORS.textSoft, fontSize: 12, opacity: sharing ? 0.6 : 1,
                                transition: "background 0.1s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = `${COLORS.green}0a`}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            <span style={{
                                width: 22, height: 22, borderRadius: 6,
                                background: `${COLORS.green}15`,
                                border: `1px solid ${COLORS.green}20`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, color: COLORS.green, flexShrink: 0,
                            }}>🔗</span>
                            {sharing ? "Generating…" : "Share link"}
                        </button>
                    ) : (
                        <div style={{ padding: "8px 14px" }}>
                            <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Share link</div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <input
                                    readOnly value={shareLink}
                                    onClick={e => e.target.select()}
                                    style={{
                                        flex: 1, fontSize: 10,
                                        background: "rgba(5,12,26,0.8)",
                                        border: `1px solid ${COLORS.border}`,
                                        borderRadius: 7, color: COLORS.blue,
                                        padding: "4px 8px", outline: "none",
                                        fontFamily: "'JetBrains Mono', monospace",
                                        minWidth: 0,
                                    }}
                                />
                                <button onClick={handleCopy} style={{
                                    padding: "4px 10px", borderRadius: 7, fontSize: 10, fontWeight: 800,
                                    border: `1px solid ${COLORS.green}44`,
                                    background: copied ? `${COLORS.green}22` : `${COLORS.green}12`,
                                    color: COLORS.green, cursor: "pointer", flexShrink: 0,
                                    transition: "all 0.2s",
                                }}>
                                    {copied ? "✓" : "Copy"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
