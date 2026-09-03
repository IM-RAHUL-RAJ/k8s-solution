package com.capstone.etp.entity;

import com.capstone.etp.enums.*;
import jakarta.persistence.*;
import lombok.*;

import javax.swing.text.Position;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;


@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique=true,nullable=false, length=10)
    private String accountRef;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name="client_id")
    private Client client;

    @Enumerated(EnumType.STRING)
    private AccountType accountType;

    private String currency;

    @Column(nullable=false, precision=10, scale=2)
    private BigDecimal cashBalance;

    @Enumerated(EnumType.STRING)
    private AccountStatus status;

    @Version
    private Long version;

    private LocalDateTime createdAt;

    private LocalDateTime suspendedAt;

    private LocalDateTime closedAt;


    @OneToOne(mappedBy="account",
            cascade=CascadeType.ALL)
    private Portfolio portfolio;


    @OneToMany(mappedBy="account")
    private List<Order> orders;


    @OneToMany(mappedBy="account")
    private List<PortfolioHolding> positions;


    public boolean canAfford(BigDecimal amount){
        return cashBalance.compareTo(amount)>=0;
    }

    public String deposit(BigDecimal amount) {
        cashBalance = cashBalance.add(amount);
        return UUID.randomUUID().toString();
    }

    public String withdraw(BigDecimal amount) {
        if (!canAfford(amount)) {
            throw new IllegalStateException("Insufficient Funds");
        }
        cashBalance = cashBalance.subtract(amount);
        return UUID.randomUUID().toString();
    }

    public void suspend(){
        if (this.status == AccountStatus.CLOSED) {
            throw new IllegalStateException(
                    "Closed account cannot be suspended"
            );
        }
        if (this.status == AccountStatus.SUSPENDED) {
            throw new IllegalStateException(
                    "Account is already suspended"
            );
        }
        this.status = AccountStatus.SUSPENDED;
        this.suspendedAt = LocalDateTime.now();
    }


    public void close(){
        this.status = AccountStatus.CLOSED;
        this.closedAt = LocalDateTime.now();
    }

    public boolean isActive() {
        return status == AccountStatus.ACTIVE;
    }
}
