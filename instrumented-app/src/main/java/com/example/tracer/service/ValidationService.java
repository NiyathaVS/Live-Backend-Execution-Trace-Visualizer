package com.example.tracer.service;

import org.springframework.stereotype.Service;

@Service
public class ValidationService {

    private final RiskAssessmentService riskAssessmentService;

    public ValidationService(RiskAssessmentService riskAssessmentService) {
        this.riskAssessmentService = riskAssessmentService;
    }

    public void validateUser(Long id) {
        basicChecks(id);
        riskAssessmentService.assessRisk(id);
    }

    public void basicChecks(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("Invalid user id");
        }
        simulateWork(20);
    }

    private void simulateWork(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

