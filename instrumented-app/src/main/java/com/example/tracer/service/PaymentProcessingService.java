package com.example.tracer.service;

import com.example.tracer.repository.PaymentRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class PaymentProcessingService {

    private final PaymentRepository paymentRepository;

    public PaymentProcessingService(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    public String processPayment(Long customerId, BigDecimal amount) {
        validatePaymentRequest(customerId, amount);

        String authorizationId = paymentRepository.authorizePayment(customerId, amount);
        simulatePaymentOrchestration(15);

        String captureId = paymentRepository.capturePayment(authorizationId, amount);
        recordPaymentAudit(customerId, authorizationId, captureId, amount);

        return captureId;
    }

    private void validatePaymentRequest(Long customerId, BigDecimal amount) {
        simulatePaymentOrchestration(10);
        if (customerId == null) {
            throw new IllegalArgumentException("Customer id required for payment");
        }
        if (amount == null || amount.compareTo(new BigDecimal("0.01")) < 0) {
            throw new IllegalArgumentException("Invalid payment amount");
        }
    }

    private void recordPaymentAudit(Long customerId, String authId, String captureId, BigDecimal amount) {
        simulatePaymentOrchestration(12);
    }

    private void simulatePaymentOrchestration(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
