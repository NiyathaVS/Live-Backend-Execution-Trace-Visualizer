package com.example.tracer.tracing;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class CallTreeNode {

    private final String methodName;
    private final long startTime;
    private String spanId;
    private String parentSpanId;
    private long executionTime;
    private Object returnValue;
    private Map<String,Object> params;
    private Map<String,Object> localVariables;
    private final List<CallTreeNode> children = new ArrayList<>();
    private String errorMessage;
    private String errorStackTrace;
    private boolean hasError;
    private boolean isOnCriticalPath;
    private boolean slowPath;
    private boolean resourceLeakSuspicion;
    private boolean contentionRisk;
    private boolean logicGapRisk;
    private String sourceFile;
    private int sourceLine;
    private String threadName;
    private long threadCpuTimeMs;
    private String threadState;
    private String eventType;
    private String sql;
    private boolean slowQuery;

    public CallTreeNode(String methodName, long startTime) {
        this.methodName = methodName;
        this.startTime = startTime;
        this.hasError = false;
        this.isOnCriticalPath = false;
        this.slowPath = false;
        this.resourceLeakSuspicion = false;
        this.contentionRisk = false;
        this.logicGapRisk = false;
    }

    @JsonCreator
    public CallTreeNode(
            @JsonProperty("methodName") String methodName,
            @JsonProperty("startTime") long startTime,
            @JsonProperty("children") List<CallTreeNode> children) {
        this(methodName, startTime);
        if (children != null) {
            this.children.addAll(children);
        }
    }

    public String getMethodName() { return methodName; }
    public long getStartTime() { return startTime; }
    public String getSpanId() { return spanId; }
    public void setSpanId(String spanId) { this.spanId = spanId; }
    public String getParentSpanId() { return parentSpanId; }
    public void setParentSpanId(String parentSpanId) { this.parentSpanId = parentSpanId; }
    public long getExecutionTime() { return executionTime; }
    public void setExecutionTime(long executionTime) { this.executionTime = executionTime; }
    public Object getReturnValue() { return returnValue; }
    public void setReturnValue(Object returnValue) { this.returnValue = returnValue; }
    public Map<String,Object> getParams() { return params; }
    public void setParams(Map<String,Object> params) { this.params = params; }
    public Map<String,Object> getLocalVariables() { return localVariables; }
    public void setLocalVariables(Map<String,Object> localVariables) { this.localVariables = localVariables; }
    public List<CallTreeNode> getChildren() { return children; }

    public void addChild(CallTreeNode child) {
        children.add(child);
    }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    
    public String getErrorStackTrace() { return errorStackTrace; }
    public void setErrorStackTrace(String stackTrace) { this.errorStackTrace = stackTrace; }
    
    public boolean hasError() { return hasError; }
    public void setHasError(boolean hasError) { this.hasError = hasError; }
    
    public boolean isOnCriticalPath() { return isOnCriticalPath; }
    public void setIsOnCriticalPath(boolean isCritical) { this.isOnCriticalPath = isCritical; }
    
    public boolean isSlowPath() { return slowPath; }
    public void setSlowPath(boolean slowPath) { this.slowPath = slowPath; }
    
    public boolean isResourceLeakSuspicion() { return resourceLeakSuspicion; }
    public void setResourceLeakSuspicion(boolean resourceLeakSuspicion) { this.resourceLeakSuspicion = resourceLeakSuspicion; }
    
    public boolean isContentionRisk() { return contentionRisk; }
    public void setContentionRisk(boolean contentionRisk) { this.contentionRisk = contentionRisk; }
    
    public boolean isLogicGapRisk() { return logicGapRisk; }
    public void setLogicGapRisk(boolean logicGapRisk) { this.logicGapRisk = logicGapRisk; }

    public String getSourceFile() { return sourceFile; }
    public void setSourceFile(String sourceFile) { this.sourceFile = sourceFile; }
    public int getSourceLine() { return sourceLine; }
    public void setSourceLine(int sourceLine) { this.sourceLine = sourceLine; }
    
    public String getThreadName() { return threadName; }
    public void setThreadName(String threadName) { this.threadName = threadName; }
    public long getThreadCpuTimeMs() { return threadCpuTimeMs; }
    public void setThreadCpuTimeMs(long threadCpuTimeMs) { this.threadCpuTimeMs = threadCpuTimeMs; }
    public String getThreadState() { return threadState; }
    public void setThreadState(String threadState) { this.threadState = threadState; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getSql() { return sql; }
    public void setSql(String sql) { this.sql = sql; }
    public boolean isSlowQuery() { return slowQuery; }
    public void setSlowQuery(boolean slowQuery) { this.slowQuery = slowQuery; }
}
