package com.example.tracer.service;

import com.example.tracer.domain.Order;
import com.example.tracer.domain.OrderLineItem;
import com.example.tracer.repository.InventoryRepository;
import com.example.tracer.repository.ProductCatalogRepository;
import org.springframework.stereotype.Service;

/**
 * Demonstrates N+1-style inventory checks: one repository call per line item.
 * Visible as repeated branches in the execution trace tree.
 */
@Service
public class InventoryAllocationService {

    private final InventoryRepository inventoryRepository;
    private final ProductCatalogRepository productCatalogRepository;

    public InventoryAllocationService(
            InventoryRepository inventoryRepository,
            ProductCatalogRepository productCatalogRepository) {
        this.inventoryRepository = inventoryRepository;
        this.productCatalogRepository = productCatalogRepository;
    }

    public int allocateAllLineItems(Order order) {
        int allocated = 0;

        for (OrderLineItem item : order.getLineItems()) {
            verifyCatalogPrice(item);
            boolean reserved = reserveLineItem(item);
            if (reserved) {
                inventoryRepository.commitReservation(item.getSku(), item.getQuantity());
                allocated++;
            } else {
                throw new IllegalStateException("Insufficient stock for SKU: " + item.getSku());
            }
        }

        performFinalWarehouseSync(order.getOrderId());
        return allocated;
    }

    private void verifyCatalogPrice(OrderLineItem item) {
        productCatalogRepository.getCurrentPrice(item.getSku());
        productCatalogRepository.getProductCategory(item.getSku());
    }

    private boolean reserveLineItem(OrderLineItem item) {
        int available = inventoryRepository.getAvailableStock(item.getSku());
        if (available < item.getQuantity()) {
            return false;
        }
        return inventoryRepository.reserveUnits(item.getSku(), item.getQuantity());
    }

    private void performFinalWarehouseSync(Long orderId) {
        simulateWarehouseBatch(25);
    }

    private void simulateWarehouseBatch(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
