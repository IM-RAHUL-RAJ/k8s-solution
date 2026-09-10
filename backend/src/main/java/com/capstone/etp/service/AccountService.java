package com.capstone.etp.service;

import com.capstone.etp.dto.AccountResponse;
import com.capstone.etp.dto.BalanceResponse;
import com.capstone.etp.dto.OrderHistoryEntry;
import com.capstone.etp.dto.PositionResponse;
import com.capstone.etp.enums.OrderStatus;
import com.capstone.etp.exception.AccountNotFoundException;
import com.capstone.etp.mapper.AccountMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final AccountMapper accountMapper;

    // added exception handling to throw AccountNotFoundException if an account is not found
    public void validateAccountId(Long accountId) throws AccountNotFoundException{
        AccountResponse account = accountMapper.getAccountById(accountId);
        if (account == null) {
            throw new AccountNotFoundException(accountId);
        }
    }

    // Service method to retrieve account details by account ID
    public AccountResponse getAccount(Long accountId) {
        AccountResponse account = accountMapper.getAccountById(accountId);
        validateAccountId(accountId);
        return account;
    }

    //Retrieve account balance information
    public BalanceResponse getBalance(Long accountId) {
        validateAccountId(accountId);
        BalanceResponse balance = accountMapper.getBalance(accountId);
        return balance;
    }

    //Retrieve all positions held in the account's portfolio
    public List<PositionResponse> getPositions(Long accountId) {
        validateAccountId(accountId);
        return accountMapper.getPositionsByAccountId(accountId);
    }

    //Retrieve order history for an account with optional filtering by status and date range
    public List<OrderHistoryEntry> getOrders(Long accountId, OrderStatus status, Instant from, Instant to) {
        validateAccountId(accountId);
        return accountMapper.getOrdersByAccountId(accountId, status, from, to);
    }
}
