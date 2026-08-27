package com.example.tracer.tracing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for broadcasting trace events to connected clients.
 * Thread-safe for concurrent client connections and event broadcasts.
 */
public class TraceWebSocketHandler extends TextWebSocketHandler {

    private static final Logger logger = LoggerFactory.getLogger(TraceWebSocketHandler.class);

    // Thread-safe set of connected sessions
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();
    private final ObjectMapper mapper = new ObjectMapper()
        .registerModule(new JavaTimeModule())
        .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        logger.info("WebSocket client connected: sessionId={}, requestId={}, totalClients={}", 
            session.getId(), requestId, sessions.size());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session);
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        logger.info("WebSocket client disconnected: sessionId={}, requestId={}, status={}, remainingClients={}", 
            session.getId(), requestId, status.getCode(), sessions.size());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        logger.error("WebSocket transport error for sessionId={}, requestId={}: {}", 
            session.getId(), requestId, exception.getMessage(), exception);
        
        // Try to close the session gracefully
        try {
            if (session.isOpen()) {
                session.close(CloseStatus.SERVER_ERROR);
            }
        } catch (Exception e) {
            logger.warn("Failed to close WebSocket session after transport error: {}", e.getMessage());
        }
    }

    /**
     * Broadcast a trace event to all connected WebSocket clients.
     * Handles individual session failures gracefully without affecting other clients.
     * 
     * @param event The trace event to broadcast
     */
    public void broadcastEvent(TraceEvent event) {
        String requestId = event.getRequestId();
        try {
            String json = mapper.writeValueAsString(event);
            
            // Copy session set to avoid concurrent modification during iteration
            Set<WebSocketSession> sessionsCopy = ConcurrentHashMap.newKeySet();
            sessionsCopy.addAll(sessions);
            
            for (WebSocketSession session : sessionsCopy) {
                if (session.isOpen()) {
                    try {
                        session.sendMessage(new TextMessage(json));
                    } catch (Exception e) {
                        // Log with request ID context
                        logger.warn("Failed to send message to WebSocket client: sessionId={}, requestId={}, error={}", 
                            session.getId(), requestId, e.getMessage());
                        
                        // Remove dead session from set
                        sessions.remove(session);
                        try {
                            if (session.isOpen()) {
                                session.close(CloseStatus.SERVER_ERROR);
                            }
                        } catch (Exception closeError) {
                            logger.debug("Failed to close WebSocket session: {}", closeError.getMessage());
                        }
                    }
                } else {
                    // Clean up closed sessions
                    sessions.remove(session);
                }
            }
        } catch (Exception e) {
            String requestId_mdc = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
            logger.error("Error serializing trace event for broadcast: requestId={}, error={}", 
                requestId_mdc != null ? requestId_mdc : requestId, e.getMessage(), e);
        }
    }

    /**
     * Get the number of currently connected WebSocket clients.
     * Useful for monitoring and diagnostics.
     * 
     * @return Number of active WebSocket sessions
     */
    public int getConnectedClientCount() {
        return sessions.size();
    }
}
