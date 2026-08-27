package com.example.tracer.service;

import com.example.tracer.domain.Order;
import org.springframework.stereotype.Service;

@Service
public class FraudDetectionService {

    private final RiskAssessmentService riskAssessmentService;
    private final ExternalFraudApiGateway externalFraudApiGateway;

    public FraudDetectionService(
            RiskAssessmentService riskAssessmentService,
            ExternalFraudApiGateway externalFraudApiGateway) {
        this.riskAssessmentService = riskAssessmentService;
        this.externalFraudApiGateway = externalFraudApiGateway;
    }

    public void screenOrder(Order order) {
        riskAssessmentService.assessRisk(order.getCustomerId());

        int riskScore = externalFraudApiGateway.fetchRiskScore(order.getCustomerId(), order.getOrderId());
        String riskTier = classifyRiskTier(riskScore);

        if ("HIGH".equals(riskTier)) {
            throw new IllegalStateException("Order blocked by fraud screening: score=" + riskScore);
        }

        applyVelocityChecks(order);
    }

    private String classifyRiskTier(int score) {
        simulateFraudEngine(12);
        if (score >= 80) {
            return "HIGH";
        }
        if (score >= 50) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private void applyVelocityChecks(Order order) {
        simulateFraudEngine(20);
        boolean tooManyOrdersToday = order.getOrderId() % 17 == 0;
        if (tooManyOrdersToday) {
            externalFraudApiGateway.flagForManualReview(order.getOrderId());
        }
    }

    private void simulateFraudEngine(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
