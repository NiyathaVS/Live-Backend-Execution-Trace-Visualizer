package com.example.tracer.domain;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class Order {

    private final Long orderId;
    private final Long customerId;
    private final String status;
    private final Address shippingAddress;
    private final List<OrderLineItem> lineItems;
    private BigDecimal subtotal;
    private BigDecimal taxAmount;
    private BigDecimal discountAmount;
    private BigDecimal shippingAmount;
    private BigDecimal totalAmount;

    public Order(Long orderId, Long customerId, String status, Address shippingAddress) {
        this.orderId = orderId;
        this.customerId = customerId;
        this.status = status;
        this.shippingAddress = shippingAddress;
        this.lineItems = new ArrayList<>();
        this.subtotal = BigDecimal.ZERO;
        this.taxAmount = BigDecimal.ZERO;
        this.discountAmount = BigDecimal.ZERO;
        this.shippingAmount = BigDecimal.ZERO;
        this.totalAmount = BigDecimal.ZERO;
    }

    public Long getOrderId() { return orderId; }
    public Long getCustomerId() { return customerId; }
    public String getStatus() { return status; }
    public Address getShippingAddress() { return shippingAddress; }
    public List<OrderLineItem> getLineItems() { return lineItems; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }

    public BigDecimal getTaxAmount() { return taxAmount; }
    public void setTaxAmount(BigDecimal taxAmount) { this.taxAmount = taxAmount; }

    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }

    public BigDecimal getShippingAmount() { return shippingAmount; }
    public void setShippingAmount(BigDecimal shippingAmount) { this.shippingAmount = shippingAmount; }

    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }

    public void addLineItem(OrderLineItem item) {
        lineItems.add(item);
    }

    public int lineItemCount() {
        return lineItems.size();
    }
}
