package com.example.tracer.service;

import com.example.tracer.domain.Order;
import com.example.tracer.domain.OrderLineItem;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class PricingService {

    private final TaxCalculationService taxCalculationService;
    private final DiscountEngine discountEngine;
    private final ShippingQuoteService shippingQuoteService;

    public PricingService(
            TaxCalculationService taxCalculationService,
            DiscountEngine discountEngine,
            ShippingQuoteService shippingQuoteService) {
        this.taxCalculationService = taxCalculationService;
        this.discountEngine = discountEngine;
        this.shippingQuoteService = shippingQuoteService;
    }

    public void calculateAndApplyPricing(Order order) {
        BigDecimal subtotal = computeSubtotal(order);
        order.setSubtotal(subtotal);

        BigDecimal discount = discountEngine.applyPromotions(order, subtotal);
        order.setDiscountAmount(discount);

        BigDecimal taxableBase = subtotal.subtract(discount);
        BigDecimal tax = taxCalculationService.computeTax(order, taxableBase);
        order.setTaxAmount(tax);

        BigDecimal shipping = shippingQuoteService.estimateShipping(order);
        order.setShippingAmount(shipping);

        BigDecimal total = taxableBase.add(tax).add(shipping);
        order.setTotalAmount(total.setScale(2, RoundingMode.HALF_UP));
    }

    private BigDecimal computeSubtotal(Order order) {
        simulatePricingWork(10);
        BigDecimal subtotal = BigDecimal.ZERO;
        for (OrderLineItem item : order.getLineItems()) {
            subtotal = subtotal.add(item.lineTotal());
        }
        return subtotal.setScale(2, RoundingMode.HALF_UP);
    }

    private void simulatePricingWork(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
