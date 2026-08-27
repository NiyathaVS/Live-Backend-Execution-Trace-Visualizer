package com.example.tracer.tracing;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("Sensitive Data Redactor Tests")
class SensitiveDataRedactorTests {

    @Test
    @DisplayName("Redacts password fields")
    void testRedactsPasswordFields() {
        Map<String, Object> params = new HashMap<>();
        params.put("username", "john.doe");
        params.put("password", "secret123");
        params.put("email", "john@example.com");

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("john.doe", redacted.get("username"));
        assertEquals("[REDACTED]", redacted.get("password"));
        assertEquals("john@example.com", redacted.get("email"));
    }

    @Test
    @DisplayName("Redacts token fields")
    void testRedactsTokenFields() {
        Map<String, Object> params = new HashMap<>();
        params.put("authToken", "Bearer abc123xyz");
        params.put("apiKey", "sk_live_1234567890");
        params.put("accessToken", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("[REDACTED]", redacted.get("authToken"));
        assertEquals("[REDACTED]", redacted.get("apiKey"));
        assertEquals("[REDACTED]", redacted.get("accessToken"));
    }

    @Test
    @DisplayName("Redacts PII fields")
    void testRedactsPIIFields() {
        Map<String, Object> params = new HashMap<>();
        params.put("ssn", "123-45-6789");
        params.put("creditCardNumber", "4111111111111111");
        params.put("cvv", "123");

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("[REDACTED]", redacted.get("ssn"));
        assertEquals("[REDACTED]", redacted.get("creditCardNumber"));
        assertEquals("[REDACTED]", redacted.get("cvv"));
    }

    @Test
    @DisplayName("Redacts long alphanumeric strings that look like tokens")
    void testRedactsLongAlphanumericStrings() {
        Map<String, Object> params = new HashMap<>();
        params.put("data", "aGVsbG8gd29ybGQgdGhpcyBpcyBhIGxvbmcgYmFzZTY0IGVuY29kZWQgc3RyaW5n");
        params.put("shortData", "hello");

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("[REDACTED]", redacted.get("data"));
        assertEquals("hello", redacted.get("shortData"));
    }

    @Test
    @DisplayName("Redacts hex strings that look like keys")
    void testRedactsHexStrings() {
        Map<String, Object> params = new HashMap<>();
        params.put("key", "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4");
        params.put("shortHex", "abc123");

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("[REDACTED]", redacted.get("key"));
        assertEquals("abc123", redacted.get("shortHex"));
    }

    @Test
    @DisplayName("Does not redact safe fields")
    void testDoesNotRedactSafeFields() {
        Map<String, Object> params = new HashMap<>();
        params.put("userId", "12345");
        params.put("name", "John Doe");
        params.put("age", 30);
        params.put("active", true);

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("12345", redacted.get("userId"));
        assertEquals("John Doe", redacted.get("name"));
        assertEquals(30, redacted.get("age"));
        assertEquals(true, redacted.get("active"));
    }

    @Test
    @DisplayName("Handles null and empty params")
    void testHandlesNullAndEmptyParams() {
        assertNull(SensitiveDataRedactor.redactParams(null));
        
        Map<String, Object> empty = new HashMap<>();
        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(empty);
        assertTrue(redacted.isEmpty());
    }

    @Test
    @DisplayName("Redacts string return values")
    void testRedactsStringReturnValues() {
        String token = "aGVsbG8gd29ybGQgdGhpcyBpcyBhIGxvbmcgYmFzZTY0IGVuY29kZWQgc3RyaW5n";
        String redacted = SensitiveDataRedactor.redactValue(token);
        assertEquals("[REDACTED]", redacted);

        String safe = "Hello World";
        String notRedacted = SensitiveDataRedactor.redactValue(safe);
        assertEquals("Hello World", notRedacted);
    }

    @Test
    @DisplayName("Redacts entire TraceEvent")
    void testRedactsTraceEvent() {
        Map<String, Object> params = new HashMap<>();
        params.put("username", "john.doe");
        params.put("password", "secret123");
        params.put("apiKey", "sk_live_1234567890");

        TraceEvent event = new TraceEvent(
            "req-123",
            1L,
            LocalDateTime.now(),
            "com.example.Service.login()",
            params,
            "aGVsbG8gd29ybGQgdGhpcyBpcyBhIGxvbmcgYmFzZTY0IGVuY29kZWQgc3RyaW5n",
            100L,
            null,
            "Service.java",
            10,
            "SUCCESS",
            null,
            null,
            null,
            "main",
            10L,
            "RUNNABLE"
        );

        TraceEvent redacted = SensitiveDataRedactor.redactEvent(event);

        // Verify params are redacted
        assertEquals("john.doe", redacted.getParams().get("username"));
        assertEquals("[REDACTED]", redacted.getParams().get("password"));
        assertEquals("[REDACTED]", redacted.getParams().get("apiKey"));

        // Verify return value is redacted
        assertEquals("[REDACTED]", redacted.getReturnValue());

        // Verify other fields are preserved
        assertEquals("req-123", redacted.getRequestId());
        assertEquals("com.example.Service.login()", redacted.getMethod());
        assertEquals(100L, redacted.getExecutionTimeMs());
    }

    @Test
    @DisplayName("Case-insensitive field matching")
    void testCaseInsensitiveMatching() {
        Map<String, Object> params = new HashMap<>();
        params.put("PASSWORD", "secret123");
        params.put("ApiKey", "sk_live_1234567890");
        params.put("AuthToken", "Bearer abc123");

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("[REDACTED]", redacted.get("PASSWORD"));
        assertEquals("[REDACTED]", redacted.get("ApiKey"));
        assertEquals("[REDACTED]", redacted.get("AuthToken"));
    }

    @Test
    @DisplayName("Redacts partial field name matches")
    void testPartialFieldNameMatches() {
        Map<String, Object> params = new HashMap<>();
        params.put("userPassword", "secret123");
        params.put("myApiKey", "sk_live_1234567890");
        params.put("bearerToken", "Bearer abc123");

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals("[REDACTED]", redacted.get("userPassword"));
        assertEquals("[REDACTED]", redacted.get("myApiKey"));
        assertEquals("[REDACTED]", redacted.get("bearerToken"));
    }

    @Test
    @DisplayName("Preserves non-string values")
    void testPreservesNonStringValues() {
        Map<String, Object> params = new HashMap<>();
        params.put("count", 42);
        params.put("active", true);
        params.put("price", 99.99);
        params.put("items", new String[]{"item1", "item2"});

        Map<String, Object> redacted = SensitiveDataRedactor.redactParams(params);

        assertEquals(42, redacted.get("count"));
        assertEquals(true, redacted.get("active"));
        assertEquals(99.99, redacted.get("price"));
        assertArrayEquals(new String[]{"item1", "item2"}, (String[]) redacted.get("items"));
    }
}