package com.capstone.etp.dto;

import com.capstone.etp.enums.OrderSide;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderRequest {
        @NotNull(message = "Account ID is required")
        @Min(value = 1, message = "Account ID must be at least 1")
        private Long accountId;

        @NotNull(message = "Symbol is required")
        @Size(min = 1, max = 5, message = "Symbol must contain between 1 and 5 characters")
        private String symbol;

        @NotNull(message = "Order side is required")
        private OrderSide side;

        @NotNull(message = "Quantity is required")
        @Min(value = 1, message = "Quantity must be at least 1")
        private Integer quantity;

        @NotNull(message = "Price is required")
        @DecimalMin(value = "0.0", inclusive = false, message = "Price must be greater than zero")
        private BigDecimal price;

        @NotNull(message = "Idempotency key is required")
        @Size(min = 8, max = 100, message = "Idempotency key must contain between 8 and 100 characters")
        private String idempotencyKey;
}