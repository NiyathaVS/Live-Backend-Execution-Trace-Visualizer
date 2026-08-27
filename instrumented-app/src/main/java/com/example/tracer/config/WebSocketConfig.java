package com.example.tracer.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;
import com.example.tracer.tracing.TraceWebSocketHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final TraceWebSocketHandler traceWebSocketHandler;
    
    @Value("${trace.websocket.allowed-origins:http://localhost:3000,http://localhost:5173}")
    private String allowedOrigins;

    public WebSocketConfig(TraceWebSocketHandler traceWebSocketHandler) {
        this.traceWebSocketHandler = traceWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Register the application-managed handler with configurable origins
        // Default allows localhost:3000 (old port) and :5173 (Vite default)
        String[] origins = allowedOrigins.split(",");
        registry.addHandler(traceWebSocketHandler, "/ws/traces")
                .setAllowedOrigins(origins);
    }
}
