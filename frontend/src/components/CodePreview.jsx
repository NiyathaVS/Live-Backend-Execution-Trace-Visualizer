import React, { useEffect, useState } from "react";
import "./CodePreview.css";

/**
 * CodePreview Component
 * Displays Java source code snippet with syntax highlighting.
 * Shows context lines around a target line number.
 */
export default function CodePreview({ className, lineNumber, onClose }) {
    const [code, setCode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!className || !lineNumber) return;

        const fetchSourceCode = async () => {
            try {
                setLoading(true);
                setError(null);

                const params = new URLSearchParams({
                    className,
                    lineNumber,
                    contextLines: 7
                });

                const response = await fetch(`/traces/source?${params}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: Failed to fetch source code`);
                }

                const snippet = await response.json();
                
                if (!snippet) {
                    setError("Source code not found. File may not be in src/ directory.");
                    return;
                }

                setCode(snippet);
            } catch (err) {
                setError(err.message || "Failed to load source code");
                console.error("Error fetching source:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSourceCode();
    }, [className, lineNumber]);

    if (!code && !loading) {
        return (
            <div className="code-preview-container error">
                <div className="code-preview-header">
                    <span>{className}</span>
                    <button onClick={onClose} className="close-btn">✕</button>
                </div>
                <div className="code-preview-body">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="code-preview-container loading">
                <div className="code-preview-header">
                    <span>{className}</span>
                    <button onClick={onClose} className="close-btn">✕</button>
                </div>
                <div className="code-preview-body">
                    <p>Loading source code...</p>
                </div>
            </div>
        );
    }

    const shortClassName = className.substring(className.lastIndexOf(".") + 1);
    const lines = code?.lines || [];
    const startLine = code?.startLine || 0;
    const highlightLine = code?.highlightLine || lineNumber;

    return (
        <div className="code-preview-container">
            <div className="code-preview-header">
                <div className="code-preview-title">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{shortClassName}.java</span>
                    <span className="line-info">:{highlightLine}</span>
                </div>
                <button onClick={onClose} className="close-btn">✕</button>
            </div>
            
            <div className="code-preview-body">
                <div className="line-numbers">
                    {lines.map((_, idx) => (
                        <div
                            key={idx}
                            className={`line-number ${startLine + idx === highlightLine ? "highlight" : ""}`}
                        >
                            {startLine + idx}
                        </div>
                    ))}
                </div>
                
                <pre className="code-content">
                    {lines.map((line, idx) => (
                        <div
                            key={idx}
                            className={`code-line ${startLine + idx === highlightLine ? "highlight-line" : ""}`}
                        >
                            <code className="java-code">{highlightJavaCode(line)}</code>
                        </div>
                    ))}
                </pre>
            </div>
        </div>
    );
}

/**
 * Simple Java syntax highlighter.
 * Highlights keywords, strings, comments, numbers.
 */
function highlightJavaCode(line) {
    const keywords = [
        "public", "private", "protected", "static", "final",
        "class", "interface", "enum", "extends", "implements",
        "new", "return", "if", "else", "for", "while", "try", "catch",
        "throw", "throws", "this", "super", "null", "true", "false",
        "void", "int", "long", "double", "float", "boolean", "String",
        "List", "Map", "Set", "ArrayList", "HashMap", "var", "const"
    ];

    // Split while preserving special parts
    let result = line;

    // Comments
    result = result.replace(/\/\/.*$/g, (match) => `<span class="comment">${escapeHtml(match)}</span>`);

    // String literals
    result = result.replace(/"[^"]*"/g, (match) => `<span class="string">${escapeHtml(match)}</span>`);

    // Numbers
    result = result.replace(/\b(\d+)\b/g, (match) => `<span class="number">${match}</span>`);

    // Keywords
    for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, "g");
        result = result.replace(regex, (match) => `<span class="keyword">${match}</span>`);
    }

    return <span dangerouslySetInnerHTML={{ __html: result }} />;
}

function escapeHtml(text) {
    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}
