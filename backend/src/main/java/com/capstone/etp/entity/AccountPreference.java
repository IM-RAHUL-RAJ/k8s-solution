package com.capstone.etp.entity;

import com.capstone.etp.enums.RiskProfile;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "account_preferences")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id")
    private Account account;

    @Enumerated(EnumType.STRING)
    private RiskProfile riskProfile;

    private String investmentGoals;

    private List<String> preferredSectors;

    private LocalDateTime createdAt;

    public void createPreference() {
    }

    public void editPreference() {
    }

    public void deletePreference() {
    }
}