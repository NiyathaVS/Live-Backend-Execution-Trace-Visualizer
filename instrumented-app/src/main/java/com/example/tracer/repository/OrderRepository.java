package com.example.tracer.repository;

import com.example.tracer.domain.Address;
import com.example.tracer.domain.Order;
import com.example.tracer.domain.OrderLineItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Repository
public class OrderRepository {

    private final JdbcTemplate jdbcTemplate;

    public OrderRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Order findById(Long orderId) {
        Map<String, Object> row = jdbcTemplate.queryForMap(
                "SELECT order_id, customer_id, status, street, city, state, postal_code, country "
                        + "FROM orders WHERE order_id = ?",
                orderId
        );

        Address address = new Address(
                (String) row.get("street"),
                (String) row.get("city"),
                (String) row.get("state"),
                (String) row.get("postal_code"),
                (String) row.get("country")
        );

        Order order = new Order(
                ((Number) row.get("order_id")).longValue(),
                ((Number) row.get("customer_id")).longValue(),
                (String) row.get("status"),
                address
        );

        List<Map<String, Object>> lines = jdbcTemplate.queryForList(
                "SELECT sku, product_name, quantity, unit_price FROM order_line_items WHERE order_id = ?",
                orderId
        );

        for (Map<String, Object> line : lines) {
            order.addLineItem(new OrderLineItem(
                    (String) line.get("sku"),
                    (String) line.get("product_name"),
                    ((Number) line.get("quantity")).intValue(),
                    (BigDecimal) line.get("unit_price")
            ));
        }

        return order;
    }

    public void updateStatus(Long orderId, String status) {
        jdbcTemplate.update(
                "UPDATE orders SET status = ? WHERE order_id = ?",
                status,
                orderId
        );
    }

    public boolean exists(Long orderId) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM orders WHERE order_id = ?",
                Integer.class,
                orderId
        );
        return count != null && count > 0;
    }
}
