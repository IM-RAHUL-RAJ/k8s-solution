package com.capstone.etp.funds;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** Money to add or take out, and how it travels. No real payment happens: the method is recorded. */
public record FundsRequest(
        @NotNull @DecimalMin(value = "0.01", message = "amount must be greater than zero")
        @Digits(integer = 12, fraction = 2) BigDecimal amount,
        @NotNull FundsMethod method) {
}
