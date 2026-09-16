package com.capstone.etp.executor.consumer;

import lombok.Data;

import java.util.UUID;

@Data
public class OrderPlacedPayload {
    private UUID orderId;
}
