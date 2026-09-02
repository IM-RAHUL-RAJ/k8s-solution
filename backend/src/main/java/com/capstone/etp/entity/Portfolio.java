package com.capstone.etp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Portfolio {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch=FetchType.LAZY)
    @JoinColumn(name="account_id")
    private Account account;

    private String name;

    private BigDecimal currentValue;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @OneToMany(
            mappedBy="portfolio",
            cascade=CascadeType.ALL
    )
    private List<PortfolioHolding> holdings;


    public void recalculateValue() {
        if (holdings == null || holdings.isEmpty()) {
            currentValue = new BigDecimal("0.00");
            return;
        }

        currentValue = holdings.stream()
                .map(holding -> holding.getAvgPrice()
                        .multiply(BigDecimal.valueOf(holding.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Long createPortfolio() {
        return this.id;
    }

    public boolean editPortfolio(String name) {
        this.name = name;
        this.updatedAt = LocalDateTime.now();
        return true;
    }
}