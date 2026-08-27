package com.example.tracer.repository;

import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.UUID;

@Repository
public class PaymentRepository {

    public String authorizePayment(Long customerId, BigDecimal amount) {
        simulatePaymentGateway(55);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payment amount must be positive");
        }
        return "AUTH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    public String capturePayment(String authorizationId, BigDecimal amount) {
        simulatePaymentGateway(40);
        return "CAPTURE-" + authorizationId.replace("AUTH-", "");
    }

    public void voidAuthorization(String authorizationId) {
        simulatePaymentGateway(25);
    }

    private void simulatePaymentGateway(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
