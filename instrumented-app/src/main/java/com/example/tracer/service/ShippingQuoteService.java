package com.example.tracer.service;

import com.example.tracer.domain.Order;
import com.example.tracer.domain.OrderLineItem;
import com.example.tracer.repository.ProductCatalogRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class ShippingQuoteService {

    private final ProductCatalogRepository productCatalogRepository;
    private final CarrierRateService carrierRateService;

    public ShippingQuoteService(
            ProductCatalogRepository productCatalogRepository,
            CarrierRateService carrierRateService) {
        this.productCatalogRepository = productCatalogRepository;
        this.carrierRateService = carrierRateService;
    }

    public BigDecimal estimateShipping(Order order) {
        int totalWeightUnits = estimatePackageWeight(order);
        boolean expressEligible = checkExpressEligibility(order);
        String zone = carrierRateService.resolveShippingZone(order.getShippingAddress().getPostalCode());
        return carrierRateService.calculateRate(zone, totalWeightUnits, expressEligible);
    }

    private int estimatePackageWeight(Order order) {
        simulateRateTableLookup(12);
        int weight = 0;
        for (OrderLineItem item : order.getLineItems()) {
            weight += item.getQuantity() * 2;
        }
        return Math.max(weight, 1);
    }

    private boolean checkExpressEligibility(Order order) {
        simulateRateTableLookup(10);
        for (OrderLineItem item : order.getLineItems()) {
            if (!productCatalogRepository.isEligibleForExpressShipping(item.getSku())) {
                return false;
            }
        }
        return true;
    }

    private void simulateRateTableLookup(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
