package com.example.tracer.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private final JdbcTemplate jdbcTemplate;

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public String findUserById(Long id) {
        return jdbcTemplate.queryForObject(
                "SELECT display_name FROM users WHERE id = ?",
                String.class,
                id
        );
    }
}
