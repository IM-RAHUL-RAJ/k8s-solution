package com.capstone.etp.kafka.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

/**
 * Kafka producer configuration for ORDER_PLACED events.
 * 
 * All producer configuration is externalized to application.properties:
 * - acks=all: Wait for all in-sync replicas before confirming
 * - enable.idempotence=true: Deduplicate producer retries
 * - retries=2147483647: Retry indefinitely (Integer.MAX_VALUE)
 * - max.in.flight.requests.per.connection=5: Limit concurrent requests
 * - key-serializer & value-serializer: StringSerializer for explicit JSON control
 * 
 * This configuration mirrors the Trade Executor's producer setup to ensure
 * consistency across all services in the event backbone architecture.
 * JSON serialization is handled explicitly by the producer using ObjectMapper.
 * See application.properties for detailed settings.
 */
@Configuration
@EnableKafka
public class KafkaProducerConfig {

    /**
     * Provides a KafkaTemplate for publishing ORDER_PLACED events.
     * Spring Boot's KafkaProperties bean is auto-populated from application.properties.
     * Uses StringSerializer to allow explicit JSON serialization.
     */
    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(KafkaProperties kafkaProperties) {
        ProducerFactory<String, String> producerFactory =
                new DefaultKafkaProducerFactory<>(kafkaProperties.buildProducerProperties());
        return new KafkaTemplate<>(producerFactory);
    }

    /**
     * Provides ObjectMapper for JSON serialization of Kafka messages.
     * Matches the executor's explicit serialization pattern.
     */
    @Bean
    public ObjectMapper kafkaObjectMapper() {
        return new ObjectMapper();
    }
}
