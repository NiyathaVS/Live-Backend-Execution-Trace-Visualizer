package com.example.tracer.service;

import com.example.tracer.domain.Order;
import com.example.tracer.domain.OrderLineItem;
import org.springframework.stereotype.Service;

@Service
public class EmailTemplateService {

    public String buildSubject(Order order) {
        simulateTemplateRender(10);
        return "Your order #" + order.getOrderId() + " has shipped!";
    }

    public String buildFulfillmentBody(Order order, String trackingNumber, String paymentRef) {
        simulateTemplateRender(25);
        StringBuilder body = new StringBuilder();
        body.append("Thank you for your order.\n\n");
        body.append("Order ID: ").append(order.getOrderId()).append("\n");
        body.append("Tracking: ").append(trackingNumber).append("\n");
        body.append("Payment reference: ").append(paymentRef).append("\n");
        body.append("Total charged: $").append(order.getTotalAmount()).append("\n\n");
        body.append("Items:\n");
        for (OrderLineItem item : order.getLineItems()) {
            body.append("  - ")
                    .append(item.getProductName())
                    .append(" x")
                    .append(item.getQuantity())
                    .append(" @ $")
                    .append(item.getUnitPrice())
                    .append("\n");
        }
        body.append("\nShip to: ").append(order.getShippingAddress().formatted());
        return body.toString();
    }

    public String wrapHtml(String plainText) {
        simulateTemplateRender(15);
        return "<html><body><pre>" + plainText + "</pre></body></html>";
    }

    private void simulateTemplateRender(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
