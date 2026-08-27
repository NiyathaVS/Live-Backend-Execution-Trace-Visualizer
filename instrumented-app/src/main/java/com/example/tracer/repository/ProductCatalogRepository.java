package com.example.tracer.repository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;

@Repository
public class ProductCatalogRepository {

    private final JdbcTemplate jdbcTemplate;
    private final boolean demoSlowQuery;

    public ProductCatalogRepository(
            JdbcTemplate jdbcTemplate,
            @Value("${trace.sql.demo-slow-query:true}") boolean demoSlowQuery) {
        this.jdbcTemplate = jdbcTemplate;
        this.demoSlowQuery = demoSlowQuery;
    }

    public BigDecimal getCurrentPrice(String sku) {
        if (demoSlowQuery && "SKU-003".equals(sku)) {
            runSlowDiagnosticQuery();
        }
        return jdbcTemplate.queryForObject(
                "SELECT unit_price FROM products WHERE sku = ?",
                BigDecimal.class,
                sku
        );
    }

    public String getProductCategory(String sku) {
        return jdbcTemplate.queryForObject(
                "SELECT category FROM products WHERE sku = ?",
                String.class,
                sku
        );
    }

    public boolean isEligibleForExpressShipping(String sku) {
        Boolean eligible = jdbcTemplate.queryForObject(
                "SELECT express_eligible FROM products WHERE sku = ?",
                Boolean.class,
                sku
        );
        return Boolean.TRUE.equals(eligible);
    }

    /**
     * Expensive cross-join used to produce a >500ms query for slow-query highlighting in the UI.
     */
    private void runSlowDiagnosticQuery() {
        jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM SYSTEM_RANGE(1, 800000) r1, SYSTEM_RANGE(1, 4) r2",
                Long.class
        );
    }
}
