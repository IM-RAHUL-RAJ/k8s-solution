package com.capstone.etp.executor.consumer;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

@Data
public class EventEnvelope {
    private String eventId;
    private String eventType;
    private String occurredAt;
    private String source;
    private JsonNode payload;
}
