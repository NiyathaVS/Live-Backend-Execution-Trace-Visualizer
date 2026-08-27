package com.example.tracer.service;

import org.springframework.stereotype.Service;

@Service
public class ExternalFraudApiGateway {

    public int fetchRiskScore(Long customerId, Long orderId) {
        simulateExternalCall(45);
        int base = (int) ((customerId * 7 + orderId * 3) % 100);
        return Math.min(95, Math.max(5, base));
    }

    public void flagForManualReview(Long orderId) {
        simulateExternalCall(30);
    }

    private void simulateExternalCall(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
