package com.example.tracer.domain;

import java.math.BigDecimal;

public class FulfillmentResult {

    private final Long orderId;
    private final String status;
    private final String trackingNumber;
    private final BigDecimal chargedAmount;
    private final int itemsAllocated;
    private final long totalDurationMs;

    public FulfillmentResult(Long orderId, String status, String trackingNumber,
                             BigDecimal chargedAmount, int itemsAllocated, long totalDurationMs) {
        this.orderId = orderId;
        this.status = status;
        this.trackingNumber = trackingNumber;
        this.chargedAmount = chargedAmount;
        this.itemsAllocated = itemsAllocated;
        this.totalDurationMs = totalDurationMs;
    }

    public Long getOrderId() { return orderId; }
    public String getStatus() { return status; }
    public String getTrackingNumber() { return trackingNumber; }
    public BigDecimal getChargedAmount() { return chargedAmount; }
    public int getItemsAllocated() { return itemsAllocated; }
    public long getTotalDurationMs() { return totalDurationMs; }

    @Override
    public String toString() {
        return "FulfillmentResult{orderId=" + orderId
                + ", status='" + status + '\''
                + ", tracking='" + trackingNumber + '\''
                + ", charged=" + chargedAmount
                + ", items=" + itemsAllocated
                + ", durationMs=" + totalDurationMs + '}';
    }
}
