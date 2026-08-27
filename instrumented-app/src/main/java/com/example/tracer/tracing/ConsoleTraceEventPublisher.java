package com.example.tracer.tracing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
public class ConsoleTraceEventPublisher implements TraceEventPublisher {

    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);

    @Override
    public void publish(TraceEvent event) {
        try {
            String json = mapper.writerWithDefaultPrettyPrinter().writeValueAsString(event);
            System.out.println(json);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
