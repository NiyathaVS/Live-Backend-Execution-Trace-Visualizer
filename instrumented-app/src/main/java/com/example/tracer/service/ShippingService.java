package com.example.tracer.service;

import com.example.tracer.domain.Order;
import com.example.tracer.repository.ShipmentRepository;
import org.springframework.stereotype.Service;

@Service
public class ShippingService {

    private final AddressValidationService addressValidationService;
    private final CarrierRateService carrierRateService;
    private final ShipmentRepository shipmentRepository;

    public ShippingService(
            AddressValidationService addressValidationService,
            CarrierRateService carrierRateService,
            ShipmentRepository shipmentRepository) {
        this.addressValidationService = addressValidationService;
        this.carrierRateService = carrierRateService;
        this.shipmentRepository = shipmentRepository;
    }

    public String scheduleShipment(Order order) {
        addressValidationService.validateAndNormalize(order.getShippingAddress());

        String carrier = selectBestCarrier(order);
        String serviceLevel = shipmentRepository.lookupCarrierServiceLevel(carrier);

        prepareShipmentManifest(order, carrier, serviceLevel);

        return shipmentRepository.createShippingLabel(
                order.getOrderId(),
                order.getShippingAddress(),
                carrier
        );
    }

    private String selectBestCarrier(Order order) {
        simulateLogisticsPlanning(18);
        String zone = carrierRateService.resolveShippingZone(
                order.getShippingAddress().getPostalCode()
        );
        return switch (zone) {
            case "ZONE-EAST" -> "FEDEX";
            case "ZONE-CENTRAL" -> "UPS";
            default -> "USPS";
        };
    }

    private void prepareShipmentManifest(Order order, String carrier, String serviceLevel) {
        simulateLogisticsPlanning(22);
    }

    private void simulateLogisticsPlanning(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
