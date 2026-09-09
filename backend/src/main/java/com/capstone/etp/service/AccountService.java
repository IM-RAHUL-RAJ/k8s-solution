package com.capstone.etp.service;

import com.capstone.etp.dto.AccountResponse;
import com.capstone.etp.dto.BalanceResponse;
import com.capstone.etp.dto.OrderHistoryEntry;
import com.capstone.etp.dto.PositionResponse;
import com.capstone.etp.enums.OrderStatus;
import com.capstone.etp.mapper.AccountMapper;
import com.capstone.etp.security.AccountAuthorizer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountMapper accountMapper;
    private final AccountAuthorizer accountAuthorizer;

    // Service method to retrieve account details by account ID
    public AccountResponse getAccount(Long accountId) {
        accountAuthorizer.ensureAccountAccess(accountId);
        return accountMapper.getAccountById(accountId);
    }

    //Retrieve account balance information
    public BalanceResponse getBalance(Long accountId) {
        accountAuthorizer.ensureAccountAccess(accountId);
        return accountMapper.getBalance(accountId);
    }

    //Retrieve all positions held in the account's portfolio
    public List<PositionResponse> getPositions(Long accountId) {
        accountAuthorizer.ensureAccountAccess(accountId);
        return accountMapper.getPositionsByAccountId(accountId);
    }

    //Retrieve order history for an account with optional filtering by status and date range
    public List<OrderHistoryEntry> getOrders(Long accountId, OrderStatus status, Instant from, Instant to) {
        accountAuthorizer.ensureAccountAccess(accountId);
        return accountMapper.getOrdersByAccountId(accountId, status, from, to);
    }
}
