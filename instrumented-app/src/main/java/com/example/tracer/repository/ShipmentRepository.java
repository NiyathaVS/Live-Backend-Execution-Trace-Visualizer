package com.example.tracer.repository;

import com.example.tracer.domain.Address;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public class ShipmentRepository {

    public String createShippingLabel(Long orderId, Address address, String carrierCode) {
        simulateCarrierApi(50);
        String tracking = carrierCode + "-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        persistLabel(orderId, tracking);
        return tracking;
    }

    public void persistLabel(Long orderId, String trackingNumber) {
        simulateCarrierApi(20);
    }

    public String lookupCarrierServiceLevel(String carrierCode) {
        simulateCarrierApi(15);
        return switch (carrierCode) {
            case "FEDEX" -> "EXPRESS";
            case "UPS" -> "GROUND";
            case "USPS" -> "PRIORITY";
            default -> "STANDARD";
        };
    }

    private void simulateCarrierApi(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
