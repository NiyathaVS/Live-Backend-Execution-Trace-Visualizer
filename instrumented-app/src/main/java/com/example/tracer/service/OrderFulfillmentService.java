package com.example.tracer.service;

import com.example.tracer.domain.FulfillmentResult;
import com.example.tracer.domain.Order;
import com.example.tracer.repository.OrderRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Orchestrates the full order fulfillment pipeline: validation, fraud screening,
 * inventory, pricing, payment, shipping, and customer notification.
 */
@Service
public class OrderFulfillmentService {

    private final OrderRepository orderRepository;
    private final OrderValidationService orderValidationService;
    private final FraudDetectionService fraudDetectionService;
    private final InventoryAllocationService inventoryAllocationService;
    private final PricingService pricingService;
    private final PaymentProcessingService paymentProcessingService;
    private final ShippingService shippingService;
    private final NotificationService notificationService;

    public OrderFulfillmentService(
            OrderRepository orderRepository,
            OrderValidationService orderValidationService,
            FraudDetectionService fraudDetectionService,
            InventoryAllocationService inventoryAllocationService,
            PricingService pricingService,
            PaymentProcessingService paymentProcessingService,
            ShippingService shippingService,
            NotificationService notificationService) {
        this.orderRepository = orderRepository;
        this.orderValidationService = orderValidationService;
        this.fraudDetectionService = fraudDetectionService;
        this.inventoryAllocationService = inventoryAllocationService;
        this.pricingService = pricingService;
        this.paymentProcessingService = paymentProcessingService;
        this.shippingService = shippingService;
        this.notificationService = notificationService;
    }

    public FulfillmentResult fulfillOrder(Long orderId) {
        long pipelineStart = System.currentTimeMillis();

        orderValidationService.validateForFulfillment(orderId);
        Order order = orderRepository.findById(orderId);

        fraudDetectionService.screenOrder(order);

        int allocatedItems = inventoryAllocationService.allocateAllLineItems(order);

        pricingService.calculateAndApplyPricing(order);
        BigDecimal totalDue = order.getTotalAmount();

        String paymentRef = paymentProcessingService.processPayment(order.getCustomerId(), totalDue);

        String trackingNumber = shippingService.scheduleShipment(order);

        notificationService.sendFulfillmentConfirmation(order, trackingNumber, paymentRef);

        orderRepository.updateStatus(orderId, "FULFILLED");

        long duration = System.currentTimeMillis() - pipelineStart;
        return new FulfillmentResult(
                orderId,
                "FULFILLED",
                trackingNumber,
                totalDue,
                allocatedItems,
                duration
        );
    }
}
