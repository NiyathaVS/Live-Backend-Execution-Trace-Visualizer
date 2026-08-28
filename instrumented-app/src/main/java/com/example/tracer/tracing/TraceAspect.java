package com.example.tracer.tracing;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.aspectj.lang.reflect.SourceLocation;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.lang.management.ManagementFactory;
import java.lang.management.ThreadMXBean;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Aspect
@Component
public class TraceAspect {

    private final TraceEventPublisher eventPublisher;
    private final InMemoryTraceCollector collector;
    private final ThreadMXBean threadMXBean = ManagementFactory.getThreadMXBean();
    @Autowired(required = false)
    private TraceWebSocketHandler wsHandler;

    @Value("${trace.redaction.enabled:true}")
    private boolean redactionEnabled;

    public TraceAspect(TraceEventPublisher eventPublisher, InMemoryTraceCollector collector) {
        this.eventPublisher = eventPublisher;
        this.collector = collector;
    }

    @Around(
        "within(@org.springframework.web.bind.annotation.RestController *) || " +
        "within(@org.springframework.stereotype.Service *) || " +
        "within(@org.springframework.stereotype.Repository *)"
    )
    public Object traceMethod(ProceedingJoinPoint joinPoint) throws Throwable {

        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String methodName = signature.getDeclaringTypeName() + "." + signature.getName() + "(..)";
        long startTime = System.currentTimeMillis();

        TraceContext parent = TraceStack.peek();
        String parentSpanId = parent != null ? parent.getSpanId() : null;
        TraceContext context = new TraceContext(methodName, startTime, parentSpanId);
        
        TraceStack.push(context);

        // Capture parameters safely
        Map<String, Object> params = new HashMap<>();
        Object[] args = joinPoint.getArgs();

        for (int i = 0; i < args.length; i++) {
            params.put("arg" + i, args[i]);
        }

        Object returnValue = null;
        long duration;
        Throwable capturedError = null;
        
        // Capture CPU time using the cached ThreadMXBean
        long startCpuTime = -1;
        try {
            if (threadMXBean.isCurrentThreadCpuTimeSupported() && threadMXBean.isThreadCpuTimeEnabled()) {
                startCpuTime = threadMXBean.getCurrentThreadCpuTime();
            }
        } catch (Exception e) {
            // CPU time tracking not supported, continue without it
        }

        try {
            returnValue = joinPoint.proceed();
            return returnValue;
        } catch (Throwable t) {
            capturedError = t;
            throw t;
        } finally {
            long endTime = System.currentTimeMillis();
            duration = endTime - startTime;
            
            // Calculate CPU time delta
            long cpuTimeDelta = 0;
            if (startCpuTime >= 0) {
                try {
                    long endCpuTime = threadMXBean.getCurrentThreadCpuTime();
                    cpuTimeDelta = (endCpuTime - startCpuTime) / 1_000_000; // Convert to ms
                } catch (Exception e) {
                    // Silently ignore if CPU time can't be captured at end
                }
            }
            
            TraceStack.pop();

            String parentMethod = parent != null ? parent.getMethodName() : null;
            String status = capturedError == null ? "SUCCESS" : "ERROR";
            String errorType = capturedError != null ? capturedError.getClass().getName() : null;
            String errorMessage = capturedError != null ? capturedError.getMessage() : null;
            String errorStackTrace = capturedError != null ? formatStackTrace(capturedError) : null;

            String sourceFile = signature.getDeclaringTypeName().substring(
                    signature.getDeclaringTypeName().lastIndexOf('.') + 1
            ) + ".java";
            int sourceLine = -1;

            // Try to get source location from AspectJ
            try {
                SourceLocation sourceLocation = joinPoint.getSourceLocation();
                if (sourceLocation != null) {
                    sourceFile = sourceLocation.getFileName();
                    sourceLine = sourceLocation.getLine();
                }
            } catch (UnsupportedOperationException ignored) {
                // Fall through to helper lookup
            }

            // If AspectJ didn't provide line, try source helper
            if (sourceLine <= 0) {
                Optional<Integer> methodLine = SourceCodeHelper.findMethodStartLine(
                        signature.getDeclaringTypeName(),
                        signature.getName()
                );
                if (methodLine.isPresent()) {
                    sourceLine = methodLine.get();
                }
            }

            TraceEvent event = TraceEvent.builder()
                .requestId(MDC.get(RequestIdFilter.REQUEST_ID_KEY))
                .threadId(Thread.currentThread().getId())
                .timestamp(LocalDateTime.now())
                .method(methodName)
                .params(params)
                .returnValue(returnValue)
                .executionTimeMs(duration)
                .parentMethod(parentMethod)
                .sourceFile(sourceFile)
                .sourceLine(sourceLine)
                .status(status)
                .errorType(errorType)
                .errorMessage(errorMessage)
                .errorStackTrace(errorStackTrace)
                .threadName(Thread.currentThread().getName())
                .threadCpuTimeMs(cpuTimeDelta)
                .threadState(Thread.currentThread().getState().name())
                .eventType("METHOD")
                .spanId(context.getSpanId())
                .parentSpanId(context.getParentSpanId())
                .build();
            
            // Apply redaction if enabled
            TraceEvent finalEvent = redactionEnabled ? SensitiveDataRedactor.redactEvent(event) : event;

            eventPublisher.publish(finalEvent);       // Console / logging
            collector.addEvent(finalEvent);           // In-memory

            if (wsHandler != null) {
                wsHandler.broadcastEvent(finalEvent);     // Live frontend push
            }
        }
    }

    private String formatStackTrace(Throwable throwable) {
        return java.util.Arrays.stream(throwable.getStackTrace())
            .limit(40)
            .map(StackTraceElement::toString)
            .collect(Collectors.joining("\n"));
    }
}
