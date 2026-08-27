package com.example.tracer.config;

import com.example.tracer.tracing.DistributedTraceInterceptor;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * Configuration for distributed tracing support.
 * Configures RestTemplate to propagate trace context headers
 * to downstream services.
 */
@Configuration
public class DistributedTraceConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
            .interceptors(new DistributedTraceInterceptor())
            .build();
    }
}
