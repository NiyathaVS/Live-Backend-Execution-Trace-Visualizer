package com.example.tracer.controller;

import com.example.tracer.domain.FulfillmentResult;
import com.example.tracer.service.OrderFulfillmentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Order fulfillment API — triggers a deep, multi-service call graph ideal for
 * trace visualization and source code preview demos.
 *
 * Sample orders: 1001, 1002, 1003
 */
@RestController
@RequestMapping("/orders")
public class OrderController {

    private static final Logger logger = LoggerFactory.getLogger(OrderController.class);

    private final OrderFulfillmentService orderFulfillmentService;

    public OrderController(OrderFulfillmentService orderFulfillmentService) {
        this.orderFulfillmentService = orderFulfillmentService;
    }

    @GetMapping("/{orderId}/fulfillment")
    public FulfillmentResult fulfillOrder(@PathVariable Long orderId) {
        logger.info("Starting fulfillment for orderId={}, requestId={}",
                orderId, MDC.get("requestId"));

        simulateIngressProcessing();

        FulfillmentResult result = orderFulfillmentService.fulfillOrder(orderId);

        logger.info("Fulfillment complete for orderId={}, tracking={}",
                orderId, result.getTrackingNumber());

        return result;
    }

    private void simulateIngressProcessing() {
        try {
            Thread.sleep(25);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
