package com.example.tracer.service;

import org.springframework.stereotype.Service;

@Service
public class RiskAssessmentService {

    public void assessRisk(Long userId) {
        callExternalRiskEngine(userId);
        parseRiskResponse();
    }

    public void callExternalRiskEngine(Long userId) {
        simulateWork(40);
    }

    public void parseRiskResponse() {
        simulateWork(15);
    }

    private void simulateWork(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

