package com.example.tracer.service;

import org.springframework.stereotype.Service;

@Service
public class ProfileEnrichmentService {

    public void enrichProfile(Long userId) {
        loadPreferences(userId);
        computeRecommendations(userId);
    }

    public void loadPreferences(Long userId) {
        simulateWork(30);
    }

    public void computeRecommendations(Long userId) {
        simulateWork(25);
    }

    private void simulateWork(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

