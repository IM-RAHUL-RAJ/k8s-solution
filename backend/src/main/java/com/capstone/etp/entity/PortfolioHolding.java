package com.capstone.etp.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "portfolio_holdings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PortfolioHolding {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "portfolio_id")
    private Portfolio portfolio;

    @ManyToOne
    @JoinColumn(name = "instrument_id")
    private Instrument instrument;

    @Positive
    private int quantity;

    private BigDecimal avgPrice;

    private LocalDateTime updatedAt;

    public boolean updateAveragePrice(int newQuantity, BigDecimal newPrice) {
        if (newQuantity <= 0) {
            throw new IllegalArgumentException(
                    "New quantity must be greater than zero");
        }
        if (newPrice == null || newPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException(
                    "Price cannot be null or negative");
        }

        if (this.quantity == 0) {
            this.quantity = newQuantity;
            this.avgPrice = newPrice;
            return true;
        }
        BigDecimal oldValue = this.avgPrice
                .multiply(BigDecimal.valueOf(this.quantity));

        BigDecimal newValue = newPrice
                .multiply(BigDecimal.valueOf(newQuantity));

        int totalQuantity = this.quantity + newQuantity;

        this.avgPrice = oldValue
                .add(newValue)
                .divide(
                        BigDecimal.valueOf(totalQuantity),
                        2,
                        java.math.RoundingMode.HALF_UP);

        this.quantity = totalQuantity;

        return true;
    }

    public Long createPortfolioHolding(Long instrumentId, int quantity) {
        if (instrumentId == null) {
            throw new IllegalArgumentException("Instrument ID cannot be null");
        }
        if (quantity < 0) {
            throw new IllegalArgumentException("Quantity cannot be negative");
        }
        if (this.id == null) {
            this.id = Math.abs(java.util.UUID.randomUUID().getMostSignificantBits());
        }
        this.quantity = quantity;
        return this.id;
    }
}