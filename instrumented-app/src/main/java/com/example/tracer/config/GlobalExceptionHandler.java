package com.example.tracer.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import com.example.tracer.tracing.RequestIdFilter;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Global exception handler that ensures all errors are logged with request ID context.
 * Catches unhandled exceptions and logs them with MDC request ID for better traceability.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Handle all unhandled exceptions
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGlobalException(
            Exception ex,
            WebRequest request) {
        
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        
        // Log with request ID in context
        logger.error("Unhandled exception in requestId={}: {} - {}", 
            requestId, 
            ex.getClass().getName(), 
            ex.getMessage(), 
            ex);

        // Build error response
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("requestId", requestId);
        errorResponse.put("timestamp", LocalDateTime.now());
        errorResponse.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        errorResponse.put("error", ex.getClass().getSimpleName());
        errorResponse.put("message", ex.getMessage());

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorResponse);
    }

    /**
     * Handle IllegalArgumentException
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgumentException(
            IllegalArgumentException ex,
            WebRequest request) {
        
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        
        logger.warn("Illegal argument in requestId={}: {}", requestId, ex.getMessage());

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("requestId", requestId);
        errorResponse.put("timestamp", LocalDateTime.now());
        errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
        errorResponse.put("error", "IllegalArgument");
        errorResponse.put("message", ex.getMessage());

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(errorResponse);
    }

    /**
     * Handle NullPointerException (indicates logic gap)
     */
    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<Map<String, Object>> handleNullPointerException(
            NullPointerException ex,
            WebRequest request) {
        
        String requestId = MDC.get(RequestIdFilter.REQUEST_ID_KEY);
        
        logger.error("Null pointer exception in requestId={}: Logic gap detected - {}", 
            requestId, 
            ex.getMessage(), 
            ex);

        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("requestId", requestId);
        errorResponse.put("timestamp", LocalDateTime.now());
        errorResponse.put("status", HttpStatus.INTERNAL_SERVER_ERROR.value());
        errorResponse.put("error", "NullPointerException");
        errorResponse.put("message", "Logic gap detected: " + ex.getMessage());

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorResponse);
    }
}
