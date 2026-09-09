package com.capstone.etp.controller;

import com.capstone.etp.dto.AccountResponse;
import com.capstone.etp.dto.BalanceResponse;
import com.capstone.etp.dto.OrderHistoryEntry;
import com.capstone.etp.dto.PositionResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/v1/accounts")
public class AccountController {

    @GetMapping("/{id}")
    public ResponseEntity<AccountResponse> getAccount(
            @PathVariable Long id) {

        return ResponseEntity.ok(null);
    }

    @GetMapping("/{id}/balance")
    public ResponseEntity<BalanceResponse> getBalance(
            @PathVariable Long id) {

        return ResponseEntity.ok(null);
    }

    @GetMapping("/{id}/positions")
    public ResponseEntity<List<PositionResponse>> getPositions(
            @PathVariable Long id) {

        return ResponseEntity.ok(null);
    }

    @GetMapping("/{id}/orders")
    public ResponseEntity<List<OrderHistoryEntry>> getOrders(
            @PathVariable Long id) {
        return ResponseEntity.ok(null);
    }
}