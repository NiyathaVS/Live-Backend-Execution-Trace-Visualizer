package com.example.tracer.service;

import org.springframework.stereotype.Service;

@Service
public class NotificationGateway {

    public void sendEmail(Long customerId, String subject, String htmlBody) {
        simulateNotificationProvider(40);
    }

    public void sendSmsAlert(Long customerId, String trackingNumber) {
        simulateNotificationProvider(28);
    }

    private void simulateNotificationProvider(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
