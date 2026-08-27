package com.example.tracer.service;

import com.example.tracer.domain.Order;
import com.example.tracer.domain.OrderLineItem;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class DiscountEngine {

    public BigDecimal applyPromotions(Order order, BigDecimal subtotal) {
        BigDecimal discount = BigDecimal.ZERO;

        discount = discount.add(applyLoyaltyDiscount(order.getCustomerId(), subtotal));
        discount = discount.add(applyBulkItemDiscount(order));
        discount = discount.add(applySeasonalPromotion(order.getOrderId()));

        return discount.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal applyLoyaltyDiscount(Long customerId, BigDecimal subtotal) {
        simulatePromotionLookup(18);
        if (customerId != null && customerId % 3 == 0) {
            return subtotal.multiply(new BigDecimal("0.05"));
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal applyBulkItemDiscount(Order order) {
        simulatePromotionLookup(14);
        long highQuantityLines = order.getLineItems().stream()
                .filter(item -> item.getQuantity() >= 2)
                .count();
        if (highQuantityLines > 0) {
            return new BigDecimal("10.00");
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal applySeasonalPromotion(Long orderId) {
        simulatePromotionLookup(12);
        if (orderId != null && orderId % 2 == 0) {
            return new BigDecimal("5.00");
        }
        return BigDecimal.ZERO;
    }

    private void simulatePromotionLookup(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
