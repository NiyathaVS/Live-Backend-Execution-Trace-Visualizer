package com.example.tracer.service;

import com.example.tracer.domain.Address;
import org.springframework.stereotype.Service;

@Service
public class AddressValidationService {

    public void validateAndNormalize(Address address) {
        simulateAddressVerificationApi(35);

        if (address.getStreet() == null || address.getStreet().isBlank()) {
            throw new IllegalArgumentException("Street address is required");
        }
        if (address.getCountry() == null || !address.getCountry().equalsIgnoreCase("US")) {
            throw new IllegalArgumentException("Only US addresses supported in demo");
        }

        normalizePostalCode(address);
        verifyDeliverability(address);
    }

    private void normalizePostalCode(Address address) {
        simulateAddressVerificationApi(12);
        String postal = address.getPostalCode();
        if (postal != null && postal.length() > 5 && !postal.contains("-")) {
            // Demo normalization: 627041234 -> 62704-1234
        }
    }

    private void verifyDeliverability(Address address) {
        simulateAddressVerificationApi(20);
        boolean undeliverable = address.getStreet().toLowerCase().contains("invalid");
        if (undeliverable) {
            throw new IllegalStateException("Address marked undeliverable by carrier");
        }
    }

    private void simulateAddressVerificationApi(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
