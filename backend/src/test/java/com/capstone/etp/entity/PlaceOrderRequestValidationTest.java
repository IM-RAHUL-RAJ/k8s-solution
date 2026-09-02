package com.capstone.etp.entity;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlaceOrderRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDownValidator() {
        factory.close();
    }

    private PlaceOrderRequest validRequest() {
        return new PlaceOrderRequest(1L, "FX:AAPL", OrderSide.BUY, 10L,
                new BigDecimal("10.00"), "IDEMPOTENCY-KEY-01");
    }

    @Test
    void validRequestHasNoViolations() {
        assertTrue(validator.validate(validRequest()).isEmpty());
    }

    // accountId: required, numeric key, at least 1
    @Test
    void accountIdMustNotBeNull() {
        PlaceOrderRequest request = validRequest();
        request.setAccountId(null);
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void accountIdBelowOneIsInvalid() {
        PlaceOrderRequest request = validRequest();
        request.setAccountId(0L);
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void accountIdOfExactlyOneIsValid() {
        PlaceOrderRequest request = validRequest();
        request.setAccountId(1L);
        assertTrue(validator.validate(request).isEmpty());
    }

    // symbol: required, not blank, at most 20 characters
    @Test
    void symbolMustNotBeNull() {
        PlaceOrderRequest request = validRequest();
        request.setSymbol(null);
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void symbolMustNotBeBlank() {
        PlaceOrderRequest request = validRequest();
        request.setSymbol("   ");
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void symbolAtTwentyCharactersIsValid() {
        PlaceOrderRequest request = validRequest();
        request.setSymbol("A".repeat(20));
        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void symbolOverTwentyCharactersIsInvalid() {
        PlaceOrderRequest request = validRequest();
        request.setSymbol("A".repeat(21));
        assertFalse(validator.validate(request).isEmpty());
    }

    // side: required, BUY or SELL
    @Test
    void sideMustNotBeNull() {
        PlaceOrderRequest request = validRequest();
        request.setSide(null);
        assertFalse(validator.validate(request).isEmpty());
    }

    // quantity: required, whole units, greater than zero
    @Test
    void quantityMustNotBeNull() {
        PlaceOrderRequest request = validRequest();
        request.setQuantity(null);
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void quantityOfZeroIsInvalid() {
        PlaceOrderRequest request = validRequest();
        request.setQuantity(0L);
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void quantityOfOneIsValid() {
        PlaceOrderRequest request = validRequest();
        request.setQuantity(1L);
        assertTrue(validator.validate(request).isEmpty());
    }

    // price: required, greater than zero, at most two decimal places
    @Test
    void priceMustNotBeNull() {
        PlaceOrderRequest request = validRequest();
        request.setPrice(null);
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void priceOfZeroIsInvalid() {
        PlaceOrderRequest request = validRequest();
        request.setPrice(BigDecimal.ZERO);
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void priceOfOneCentIsValid() {
        PlaceOrderRequest request = validRequest();
        request.setPrice(new BigDecimal("0.01"));
        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void priceWithMoreThanTwoDecimalPlacesIsInvalid() {
        PlaceOrderRequest request = validRequest();
        request.setPrice(new BigDecimal("10.001"));
        assertFalse(validator.validate(request).isEmpty());
    }

    // idempotencyKey: required, between 8 and 100 characters
    @Test
    void idempotencyKeyMustNotBeBlank() {
        PlaceOrderRequest request = validRequest();
        request.setIdempotencyKey("");
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void idempotencyKeyBelowEightCharactersIsInvalid() {
        PlaceOrderRequest request = validRequest();
        request.setIdempotencyKey("SHORT12");
        assertFalse(validator.validate(request).isEmpty());
    }

    @Test
    void idempotencyKeyOfEightCharactersIsValid() {
        PlaceOrderRequest request = validRequest();
        request.setIdempotencyKey("EIGHTCH1");
        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void idempotencyKeyOfOneHundredCharactersIsValid() {
        PlaceOrderRequest request = validRequest();
        request.setIdempotencyKey("K".repeat(100));
        assertTrue(validator.validate(request).isEmpty());
    }

    @Test
    void idempotencyKeyOverOneHundredCharactersIsInvalid() {
        PlaceOrderRequest request = validRequest();
        request.setIdempotencyKey("K".repeat(101));
        assertFalse(validator.validate(request).isEmpty());
    }
}
