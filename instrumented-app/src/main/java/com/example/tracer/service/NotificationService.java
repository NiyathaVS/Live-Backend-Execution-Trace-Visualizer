package com.example.tracer.service;

import com.example.tracer.domain.Order;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private final EmailTemplateService emailTemplateService;
    private final NotificationGateway notificationGateway;

    public NotificationService(
            EmailTemplateService emailTemplateService,
            NotificationGateway notificationGateway) {
        this.emailTemplateService = emailTemplateService;
        this.notificationGateway = notificationGateway;
    }

    public void sendFulfillmentConfirmation(Order order, String trackingNumber, String paymentRef) {
        String subject = emailTemplateService.buildSubject(order);
        String body = emailTemplateService.buildFulfillmentBody(order, trackingNumber, paymentRef);
        String htmlBody = emailTemplateService.wrapHtml(body);

        notificationGateway.sendEmail(order.getCustomerId(), subject, htmlBody);
        notificationGateway.sendSmsAlert(order.getCustomerId(), trackingNumber);
    }
}
