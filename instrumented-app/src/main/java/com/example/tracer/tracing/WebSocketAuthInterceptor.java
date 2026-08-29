package com.example.tracer.tracing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.List;
import java.util.Map;

/**
 * Rejects WebSocket upgrades whose token does not match the configured shared secret.
 *
 * <p>The token is read from the {@code Sec-WebSocket-Protocol} subprotocol header
 * (sent by the frontend as {@code token.<secret>}) rather than a URL query parameter.
 * This keeps the secret out of server access logs and browser history.</p>
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
 * The frontend must set {@code VITE_WS_TOKEN=change-me-to-a-strong-secret}.</p>
 */
public class WebSocketAuthInterceptor implements HandshakeInterceptor {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketAuthInterceptor.class);

    /** Sentinel value: auth is disabled when this is the configured token. */
    private static final String AUTH_DISABLED = "none";
    /** Subprotocol prefix the frontend uses to carry the token. */
    private static final String TOKEN_PROTOCOL_PREFIX = "token.";

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

        // Extract the token from the Sec-WebSocket-Protocol header values.
        // The frontend sends ["trace", "token.<secret>"] as subprotocols.
        List<String> protocols = request.getHeaders().get("Sec-WebSocket-Protocol");
        String provided = extractTokenFromProtocols(protocols);

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
     * Find the subprotocol entry that starts with {@value TOKEN_PROTOCOL_PREFIX}
     * and return the value after the prefix.
     */
    private static String extractTokenFromProtocols(List<String> protocols) {
        if (protocols == null || protocols.isEmpty()) return null;
        for (String header : protocols) {
            // Each header value may itself be comma-separated
            for (String proto : header.split(",")) {
                String trimmed = proto.trim();
                if (trimmed.startsWith(TOKEN_PROTOCOL_PREFIX)) {
                    return trimmed.substring(TOKEN_PROTOCOL_PREFIX.length());
                }
            }
        }
        return null;
    }
}
