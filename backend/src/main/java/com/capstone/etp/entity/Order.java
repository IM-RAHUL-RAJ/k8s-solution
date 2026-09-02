package com.capstone.etp.entity;

import com.capstone.etp.enums.*;
import jakarta.persistence.*;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name="account_id")
    private Account account;

    @ManyToOne
    @JoinColumn(name="instrument_id")
    private Instrument instrument;

    @Column(unique=true)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    private OrderSide side;

    @Positive(message = "Quantity must be greater than zero")
    private int quantity;

    @Column(precision = 10, scale = 2)
    private BigDecimal limitPrice;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime terminalAt;

    private boolean isTerminal() {
        return status == OrderStatus.FILLED
                || status == OrderStatus.REJECTED
                || status == OrderStatus.CANCELLED;
    }

    public void fill(){
        status = OrderStatus.FILLED;
        terminalAt = LocalDateTime.now();
    }

    public void reject(){
        status = OrderStatus.REJECTED;
    }

    public boolean cancel() {
        if (isTerminal()) {
            throw new IllegalStateException(
                    "Cannot cancel an order that has already reached a terminal state"
            );
        }
        status = OrderStatus.CANCELLED;
        terminalAt = LocalDateTime.now();

        return true;
    }

    public Long submit() {
        if (this.id == null) {
            this.id = Math.abs(UUID.randomUUID().getMostSignificantBits());
        }
        return this.id;
    }

    public boolean checkStatus() {
        return isTerminal();
    }
}