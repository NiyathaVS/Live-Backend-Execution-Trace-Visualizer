package com.example.tracer.tracing;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Utility for redacting sensitive information from trace events.
 * Supports pattern-based redaction and per-package configuration.
 * 
 * Redacts common sensitive fields like passwords, tokens, keys, and SSNs.
 */
public class SensitiveDataRedactor {

    // Common sensitive field patterns
    private static final Set<Pattern> SENSITIVE_PATTERNS = new HashSet<>();
    static {
        // Password fields
        SENSITIVE_PATTERNS.add(Pattern.compile(".*password.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*passwd.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*pwd.*", Pattern.CASE_INSENSITIVE));
        
        // Token/credential fields
        SENSITIVE_PATTERNS.add(Pattern.compile(".*token.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*auth.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*apikey.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*secret.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*bearer.*", Pattern.CASE_INSENSITIVE));
        
        // PII patterns
        SENSITIVE_PATTERNS.add(Pattern.compile(".*ssn.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*creditcard.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*card.*number.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*cvv.*", Pattern.CASE_INSENSITIVE));
        
        // Database credentials
        SENSITIVE_PATTERNS.add(Pattern.compile(".*connectionstring.*", Pattern.CASE_INSENSITIVE));
        SENSITIVE_PATTERNS.add(Pattern.compile(".*jdbc.*", Pattern.CASE_INSENSITIVE));
    }

    /**
     * Redact sensitive values from a parameter map.
     * Creates a new map with sensitive values replaced with "[REDACTED]".
     */
    public static Map<String, Object> redactParams(Map<String, Object> params) {
        if (params == null || params.isEmpty()) {
            return params;
        }
        
        Map<String, Object> redacted = new HashMap<>();
        for (Map.Entry<String, Object> entry : params.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            if (isSensitiveKey(key)) {
                redacted.put(key, "[REDACTED]");
            } else if (value instanceof String && isSensitiveValue((String) value)) {
                redacted.put(key, "[REDACTED]");
            } else {
                redacted.put(key, value);
            }
        }
        return redacted;
    }

    /**
     * Redact a single string value if it matches sensitive patterns.
     */
    public static String redactValue(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        
        if (isSensitiveValue(value)) {
            return "[REDACTED]";
        }
        return value;
    }

    private static boolean isSensitiveKey(String key) {
        for (Pattern pattern : SENSITIVE_PATTERNS) {
            if (pattern.matcher(key).matches()) {
                return true;
            }
        }
        return false;
    }

    private static boolean isSensitiveValue(String value) {
        // Check for common value patterns (e.g., base64 tokens, hex strings that look like tokens)
        if (value.length() > 20) {
            // Long alphanumeric strings that look like tokens
            if (value.matches("[A-Za-z0-9+/=]{40,}")) {
                return true;
            }
            // Hex strings (potential API keys, hashes)
            if (value.matches("[a-fA-F0-9]{40,}")) {
                return true;
            }
        }
        return false;
    }

    /**
     * Create a new TraceEvent with redacted parameters and return values.
     */
    public static TraceEvent redactEvent(TraceEvent event) {
        Map<String, Object> redactedParams = redactParams(event.getParams());
        Object redactedReturn = event.getReturnValue() instanceof String ? 
            redactValue((String) event.getReturnValue()) : 
            event.getReturnValue();
        
        // Create new event with redacted data (using constructor)
        // Note: This is simplified; in production you might want a builder
        return new TraceEvent(
            event.getRequestId(),
            event.getThreadId(),
            event.getTimestamp(),
            event.getMethod(),
            redactedParams,
            redactedReturn,
            event.getExecutionTimeMs(),
            event.getParentMethod(),
            event.getSourceFile(),
            event.getSourceLine(),
            event.getStatus(),
            event.getErrorType(),
            event.getErrorMessage(),
            event.getErrorStackTrace(),
            event.getThreadName(),
            event.getThreadCpuTimeMs(),
            event.getThreadState(),
            event.getEventType(),
            event.getSql(),
            event.isSlowQuery(),
            event.getSpanId(),
            event.getParentSpanId()
        );
    }
}
