package com.capstone.etp.executor.domain;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class Quote {
    String symbol;
    BigDecimal bid;
    BigDecimal ask;
    BigDecimal last;
}
