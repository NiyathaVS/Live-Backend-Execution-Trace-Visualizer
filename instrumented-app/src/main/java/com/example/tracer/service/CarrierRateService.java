package com.example.tracer.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class CarrierRateService {

    public String resolveShippingZone(String postalCode) {
        simulateCarrierRateApi(20);
        if (postalCode == null || postalCode.isEmpty()) {
            return "ZONE-DEFAULT";
        }
        char first = postalCode.charAt(0);
        if (first >= '0' && first <= '3') {
            return "ZONE-EAST";
        }
        if (first >= '4' && first <= '6') {
            return "ZONE-CENTRAL";
        }
        return "ZONE-WEST";
    }

    public BigDecimal calculateRate(String zone, int weightUnits, boolean expressEligible) {
        simulateCarrierRateApi(25);
        BigDecimal base = switch (zone) {
            case "ZONE-EAST" -> new BigDecimal("8.99");
            case "ZONE-CENTRAL" -> new BigDecimal("7.49");
            case "ZONE-WEST" -> new BigDecimal("9.99");
            default -> new BigDecimal("6.99");
        };
        BigDecimal weightSurcharge = new BigDecimal("0.75").multiply(BigDecimal.valueOf(weightUnits));
        BigDecimal expressFee = expressEligible ? new BigDecimal("12.00") : BigDecimal.ZERO;
        return base.add(weightSurcharge).add(expressFee);
    }

    private void simulateCarrierRateApi(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
