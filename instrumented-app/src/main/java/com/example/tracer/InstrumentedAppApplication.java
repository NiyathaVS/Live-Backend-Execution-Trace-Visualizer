/**
 * @SpringBootApplication enables:
 * Component scanning
 * Auto configuration
 * Configuration class
 */

package com.example.tracer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InstrumentedAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(InstrumentedAppApplication.class, args);
    }
}
