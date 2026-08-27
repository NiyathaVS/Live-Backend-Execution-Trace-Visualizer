package com.example.tracer.service;

import com.example.tracer.domain.Order;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class TaxCalculationService {

    public BigDecimal computeTax(Order order, BigDecimal taxableBase) {
        String state = order.getShippingAddress().getState();
        BigDecimal rate = resolveTaxRate(state);
        simulateTaxAuthorityLookup(28);

        BigDecimal tax = taxableBase.multiply(rate);
        return tax.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveTaxRate(String state) {
        simulateTaxAuthorityLookup(15);
        return switch (state != null ? state : "") {
            case "CA" -> new BigDecimal("0.0725");
            case "NY" -> new BigDecimal("0.08");
            case "TX" -> new BigDecimal("0.0625");
            case "IL" -> new BigDecimal("0.0625");
            default -> new BigDecimal("0.05");
        };
    }

    private void simulateTaxAuthorityLookup(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
