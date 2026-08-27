package com.example.tracer.config;

import com.example.tracer.tracing.SqlTraceListener;
import com.example.tracer.tracing.jdbc.TracingDataSource;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Configuration
@EnableConfigurationProperties(DataSourceProperties.class)
public class DatabaseConfig {

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties, SqlTraceListener sqlTraceListener) {
        HikariDataSource hikari = properties.initializeDataSourceBuilder()
                .type(HikariDataSource.class)
                .build();
        hikari.setPoolName("tracer-pool");
        hikari.setMaximumPoolSize(10);
        return new TracingDataSource(hikari, sqlTraceListener);
    }
}
