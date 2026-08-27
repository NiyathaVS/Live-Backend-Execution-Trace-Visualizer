package com.example.tracer.domain;

import java.math.BigDecimal;

public class OrderLineItem {

    private final String sku;
    private final String productName;
    private final int quantity;
    private final BigDecimal unitPrice;

    public OrderLineItem(String sku, String productName, int quantity, BigDecimal unitPrice) {
        this.sku = sku;
        this.productName = productName;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public String getSku() { return sku; }
    public String getProductName() { return productName; }
    public int getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }

    public BigDecimal lineTotal() {
        return unitPrice.multiply(BigDecimal.valueOf(quantity));
    }
}
