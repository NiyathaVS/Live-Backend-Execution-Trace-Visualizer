package com.example.tracer.service;

import com.example.tracer.domain.Order;
import com.example.tracer.repository.OrderRepository;
import org.springframework.stereotype.Service;

@Service
public class OrderValidationService {

    private final OrderRepository orderRepository;
    private final ValidationService validationService;

    public OrderValidationService(OrderRepository orderRepository, ValidationService validationService) {
        this.orderRepository = orderRepository;
        this.validationService = validationService;
    }

    public void validateForFulfillment(Long orderId) {
        if (orderId == null || orderId <= 0) {
            throw new IllegalArgumentException("Invalid order id");
        }

        if (!orderRepository.exists(orderId)) {
            throw new IllegalArgumentException("Order does not exist: " + orderId);
        }

        Order order = orderRepository.findById(orderId);
        validationService.validateUser(order.getCustomerId());

        if (order.lineItemCount() == 0) {
            throw new IllegalStateException("Order has no line items");
        }

        if (!"PENDING".equalsIgnoreCase(order.getStatus())) {
            throw new IllegalStateException("Order is not in PENDING status: " + order.getStatus());
        }

        validateShippingAddress(order);
    }

    private void validateShippingAddress(Order order) {
        simulateValidationWork(15);

        if (order.getShippingAddress() == null) {
            throw new IllegalStateException("Shipping address is required");
        }

        String postal = order.getShippingAddress().getPostalCode();
        if (postal == null || postal.length() < 5) {
            throw new IllegalStateException("Invalid postal code on shipping address");
        }
    }

    private void simulateValidationWork(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
