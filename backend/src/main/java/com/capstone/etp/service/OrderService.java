package com.capstone.etp.service;

import com.capstone.etp.dto.OrderResponse;
import com.capstone.etp.dto.PlaceOrderRequest;
import com.capstone.etp.entity.Account;
import com.capstone.etp.entity.Instrument;
import com.capstone.etp.entity.Order;
import com.capstone.etp.entity.PortfolioHolding;
import com.capstone.etp.enums.OrderStatus;
import com.capstone.etp.exception.AccountNotFoundException;
import com.capstone.etp.exception.InstrumentNotFoundException;
import com.capstone.etp.mapper.OrderMapper;
import com.capstone.etp.security.AccountAuthorizer;
import com.capstone.etp.validator.OrderValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderMapper orderMapper;
    private final OrderValidator orderValidator;
    private final AccountAuthorizer accountAuthorizer;

    // create a new order
    public OrderResponse placeOrder(PlaceOrderRequest request) {
        accountAuthorizer.ensureAccountAccess(request.getAccountId());

        // STEP 1: Fetch Account for validation
        Account account = orderMapper.findAccountById(request.getAccountId());
        if (account == null) {
            throw new AccountNotFoundException(
                    request.getAccountId());
        }

        // STEP 2: Fetch Instrument by Symbol for validation
        Instrument instrument = orderMapper.findInstrumentBySymbol(request.getSymbol());
        if (instrument == null) {
            throw new InstrumentNotFoundException(
                    null,
                    InstrumentNotFoundException.Reason.UNKNOWN_SYMBOL);
        }

        // STEP 3: Fetch Portfolio Holding (needed for sell validation)
        PortfolioHolding holding = orderMapper.findPortfolioHolding(
                request.getAccountId(),
                instrument.getId());

        // STEP 4: Fetch existing orders for idempotency key check
        List<Order> existingOrders = orderMapper.findExistingOrdersByAccount(
                request.getAccountId());

        // STEP 5: Build Order entity from request
        Order order = Order.builder()
                .id(UUID.randomUUID())
                .accountId(request.getAccountId())
                .instrumentId(instrument.getId())
                .idempotencyKey(request.getIdempotencyKey())
                .side(request.getSide())
                .quantity(request.getQuantity())
                .limitPrice(request.getPrice())
                .status(OrderStatus.NEW)
                .createdAt(Instant.now())
                .build();

        // STEP 6: Perform comprehensive validation (Rules 1-8)
        // If validation fails, exception is thrown and order is NOT inserted
        orderValidator.validate(order, account, instrument, holding, existingOrders);

        // STEP 7: Validation passed - Insert order as NEW status
        orderMapper.insertOrder(order);

        // STEP 8: Return response
        return OrderResponse.builder()
                .orderId(order.getId())
                .status(order.getStatus())
                .message("Order created successfully")
                .symbol(instrument.getSymbol())
                .side(order.getSide())
                .quantity(order.getQuantity())
                .price(order.getLimitPrice())
                .build();
    }

   // Delete order (cancel)
    public OrderResponse cancelOrder(UUID orderId) {
        // STEP 1: Fetch the order from database
        Order order = orderMapper.findOrderById(orderId);
        accountAuthorizer.ensureAccountAccess(order.getAccountId());

        // STEP 2: Call Order entity's business logic to cancel
        // This will throw exception if order is already in terminal state
        order.cancel();

        // STEP 3: Update status to CANCELLED in database
        orderMapper.updateOrderStatus(
                orderId,
                order.getStatus(),
                order.getTerminalAt());

        // STEP 4: Return response
        return OrderResponse.builder()
                .orderId(orderId)
                .status(order.getStatus())
                .message("Order cancelled successfully")
                .build();
    }
}
