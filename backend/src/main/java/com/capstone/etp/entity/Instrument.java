package com.capstone.etp.entity;

import com.capstone.etp.enums.AssetClass;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Instrument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String symbol;

    private String exchange;

    private String name;

    @Enumerated(EnumType.STRING)
    private AssetClass assetClass;

    @Column(length = 3)
    private String currency;

    private boolean tradable;

    private LocalDateTime stoppedAt;

    public boolean isTradable() {
        return tradable;
    }

    public String getSymbol() {
        return symbol;
    }
}
