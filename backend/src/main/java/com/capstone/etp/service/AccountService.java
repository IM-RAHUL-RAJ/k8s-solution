package com.capstone.etp.service;

import com.capstone.etp.dto.AccountResponse;
import com.capstone.etp.dto.BalanceResponse;
import com.capstone.etp.dto.OrderHistoryEntry;
import com.capstone.etp.dto.PositionResponse;
import com.capstone.etp.enums.OrderStatus;
import com.capstone.etp.mapper.AccountMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountMapper accountMapper;

    // Service method to retrieve account details by account ID
    public AccountResponse getAccount(Long accountId) {
        return accountMapper.getAccountById(accountId);
    }

    //Retrieve account balance information
    public BalanceResponse getBalance(Long accountId) {
        return accountMapper.getBalance(accountId);
    }

    //Retrieve all positions held in the account's portfolio
    public List<PositionResponse> getPositions(Long accountId) {
        return accountMapper.getPositionsByAccountId(accountId);
    }

    //Retrieve order history for an account with optional filtering by status and date range
    public List<OrderHistoryEntry> getOrders(Long accountId, OrderStatus status, LocalDateTime from, LocalDateTime to) {
        return accountMapper.getOrdersByAccountId(accountId, status, from, to);
    }
}
