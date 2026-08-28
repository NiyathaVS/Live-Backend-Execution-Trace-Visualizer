package com.example.tracer.config;

import com.example.tracer.tracing.TraceWebSocketHandler;
import com.example.tracer.tracing.WebSocketAuthInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final TraceWebSocketHandler traceWebSocketHandler;

    @Value("${trace.websocket.allowed-origins:http://localhost:3000,http://localhost:5173}")
    private String allowedOrigins;

    /**
     * Shared secret for WebSocket auth. Defaults to "none" which disables auth
     * so the project works out of the box. Set to a real secret in production.
     * Can also be supplied via the TRACE_WS_AUTH_TOKEN environment variable.
     */
    @Value("${trace.websocket.auth-token:none}")
    private String authToken;

    public WebSocketConfig(TraceWebSocketHandler traceWebSocketHandler) {
        this.traceWebSocketHandler = traceWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = allowedOrigins.split(",");
        registry.addHandler(traceWebSocketHandler, "/ws/traces")
                .setAllowedOrigins(origins)
                .addInterceptors(new WebSocketAuthInterceptor(authToken));
    }
}
