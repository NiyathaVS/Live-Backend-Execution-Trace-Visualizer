package com.example.tracer.tracing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

/**
 * Rejects WebSocket upgrades whose {@code ?token=} query parameter does not
 * match the configured shared secret.
 *
 * <p>When the secret is blank or {@code none} (default for local dev), every
 * connection is allowed through so the project still works out-of-the-box
 * without any configuration.</p>
 *
 * <p>To enable protection, set {@code trace.websocket.auth-token} in
 * {@code application.yml} (or override via the {@code TRACE_WS_AUTH_TOKEN}
 * environment variable):
 * <pre>
 * trace:
 *   websocket:
 *     auth-token: "change-me-to-a-strong-secret"
 * </pre>
 * The frontend must then connect with:
 * <pre>
 *   ws://localhost:8080/ws/traces?token=change-me-to-a-strong-secret
 * </pre>
 * </p>
 */
public class WebSocketAuthInterceptor implements HandshakeInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketAuthInterceptor.class);

    /** Sentinel value: auth is disabled when this is the configured token. */
    private static final String AUTH_DISABLED = "none";

    private final String expectedToken;

    public WebSocketAuthInterceptor(String expectedToken) {
        this.expectedToken = expectedToken == null ? AUTH_DISABLED : expectedToken.trim();
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {

        // Auth disabled — allow all connections (safe for local dev)
        if (AUTH_DISABLED.equalsIgnoreCase(expectedToken) || expectedToken.isBlank()) {
            return true;
        }

        String query = request.getURI().getQuery(); // e.g. "token=abc123"
        String provided = extractToken(query);

        if (expectedToken.equals(provided)) {
            logger.debug("WebSocket handshake authorised for {}", request.getRemoteAddress());
            return true;
        }

        logger.warn("WebSocket handshake rejected — invalid or missing token from {}",
                request.getRemoteAddress());
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return false;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
        // no-op
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /**
     * Extract the {@code token} value from a raw query string.
     * Does not use URL decoding — tokens should be plain ASCII secrets.
     */
    private static String extractToken(String query) {
        if (query == null || query.isBlank()) return null;
        for (String part : query.split("&")) {
            if (part.startsWith("token=")) {
                return part.substring("token=".length());
            }
        }
        return null;
    }
}
