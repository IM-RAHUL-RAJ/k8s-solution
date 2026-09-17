package com.capstone.etp.executor.client;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/** Raw JSON response from {@code GET /quotes/{symbol}} or the batch endpoint. */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FauxnanceQuoteResponse {
    private String symbol;
    private BigDecimal price;
    private BigDecimal bid;
    private BigDecimal ask;
    private String currency;
    private BigDecimal change;
    private BigDecimal changePercent;
    private BigDecimal previousClose;
    private String marketState;
    private Boolean stale;

    @JsonAlias({"asOf", "quoteAsOf"})
    private Instant quoteAsOf;

    @JsonProperty("data")
    private void unpackData(Map<String, Object> data) {
        if (data == null) return;
        if (data.containsKey("symbol")) this.symbol = (String) data.get("symbol");
        if (data.containsKey("price")) this.price = toBigDecimal(data.get("price"));
        if (data.containsKey("bid")) this.bid = toBigDecimal(data.get("bid"));
        if (data.containsKey("ask")) this.ask = toBigDecimal(data.get("ask"));
        if (data.containsKey("currency")) this.currency = (String) data.get("currency");
        if (data.containsKey("change")) this.change = toBigDecimal(data.get("change"));
        if (data.containsKey("changePercent")) this.changePercent = toBigDecimal(data.get("changePercent"));
        if (data.containsKey("previousClose")) this.previousClose = toBigDecimal(data.get("previousClose"));
        if (data.containsKey("marketState")) this.marketState = (String) data.get("marketState");
        if (data.containsKey("asOf") && data.get("asOf") != null) {
            try {
                this.quoteAsOf = Instant.parse(data.get("asOf").toString());
            } catch (Exception ignored) {}
        }
    }

    @JsonProperty("meta")
    private void unpackMeta(Map<String, Object> meta) {
        if (meta == null) return;
        if (meta.containsKey("stale")) {
            Object s = meta.get("stale");
            if (s instanceof Boolean) {
                this.stale = (Boolean) s;
            } else if (s != null) {
                this.stale = Boolean.valueOf(s.toString());
            }
        }
    }

    private static BigDecimal toBigDecimal(Object val) {
        if (val == null) return null;
        if (val instanceof BigDecimal) return (BigDecimal) val;
        if (val instanceof Number) return new BigDecimal(val.toString());
        try {
            return new BigDecimal(val.toString());
        } catch (Exception e) {
            return null;
        }
    }
}


