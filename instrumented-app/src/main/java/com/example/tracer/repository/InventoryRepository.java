package com.example.tracer.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class InventoryRepository {

    private final JdbcTemplate jdbcTemplate;

    public InventoryRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public int getAvailableStock(String sku) {
        Integer qty = jdbcTemplate.queryForObject(
                "SELECT quantity FROM inventory WHERE sku = ?",
                Integer.class,
                sku
        );
        return qty != null ? qty : 0;
    }

    public boolean reserveUnits(String sku, int quantity) {
        int updated = jdbcTemplate.update(
                "UPDATE inventory SET quantity = quantity - ? WHERE sku = ? AND quantity >= ?",
                quantity,
                sku,
                quantity
        );
        return updated == 1;
    }

    public void commitReservation(String sku, int quantity) {
        jdbcTemplate.queryForObject(
                "SELECT quantity FROM inventory WHERE sku = ?",
                Integer.class,
                sku
        );
    }

    public void releaseReservation(String sku, int quantity) {
        jdbcTemplate.update(
                "UPDATE inventory SET quantity = quantity + ? WHERE sku = ?",
                quantity,
                sku
        );
    }
}
