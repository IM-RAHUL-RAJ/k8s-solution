package com.capstone.etp.executor.kafka.consumer;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

/**
 * Sends a failed message to its dead-letter topic ({@code <original-topic>.DLT}).
 *
 * <p>DLT envelope decision: the original message bytes are preserved as the value
 * so the message can be replayed or inspected without any information loss. The
 * failure context is encoded as Kafka headers rather than modifying the payload,
 * which keeps the DLT consumer simple — it can deserialize the same envelope as
 * the live topic.
 *
 * <p>Headers written:
 * <ul>
 *   <li>{@code X-DLT-Reason}         — short failure reason string</li>
 *   <li>{@code X-DLT-Exception}      — exception class name (if any)</li>
 *   <li>{@code X-DLT-Original-Topic} — source topic</li>
 *   <li>{@code X-DLT-Timestamp}      — ISO-8601 time of failure</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeadLetterPublisher {

    public static final String RETRY_BUDGET_EXHAUSTED = "RETRY_BUDGET_EXHAUSTED";

    private final KafkaTemplate<String, String> kafkaTemplate;

    public void publish(ConsumerRecord<String, String> original, String reason, Exception cause) {
        String dltTopic = original.topic() + ".DLT";
        String timestamp = Instant.now().toString();
        String exceptionClass = cause != null ? cause.getClass().getName() : "none";

        ProducerRecord<String, String> dlt = new ProducerRecord<>(
                dltTopic, null, original.key(), original.value());

        dlt.headers().add(new RecordHeader("X-DLT-Reason",
                reason.getBytes(StandardCharsets.UTF_8)));
        dlt.headers().add(new RecordHeader("X-DLT-Exception",
                exceptionClass.getBytes(StandardCharsets.UTF_8)));
        dlt.headers().add(new RecordHeader("X-DLT-Original-Topic",
                original.topic().getBytes(StandardCharsets.UTF_8)));
        dlt.headers().add(new RecordHeader("X-DLT-Timestamp",
                timestamp.getBytes(StandardCharsets.UTF_8)));

        kafkaTemplate.send(dlt);
        log.warn("Message dead-lettered to {} — reason: {}, exception: {}",
                dltTopic, reason, exceptionClass);
    }
}
