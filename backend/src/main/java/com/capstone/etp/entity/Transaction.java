package com.capstone.etp.entity;
import com.capstone.etp.enums.*;
import jakarta.persistence.*;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Transaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name="order_id")
    private Order order;

    @Positive
    private int quantity;

    private BigDecimal executedPrice;

    @Enumerated(EnumType.STRING)
    private TransactionStatus status;

    private LocalDateTime executedAt;

    public TransactionStatus getStatus() {
        return status;
    }

    public List<Transaction> getHistory(List<Transaction> transactions) {
        return transactions.stream()
                .filter(t -> t.getOrder().getId().equals(this.order.getId()))
                .toList();
    }
}
