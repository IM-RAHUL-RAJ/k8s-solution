package com.capstone.etp.service;

import com.capstone.etp.entity.Order;
import com.capstone.etp.entity.Transaction;
import com.capstone.etp.validator.OrderValidator;

public class OrderService {

    private final OrderValidator validator;

    private final OrderExecution executor;

    public OrderService(
            OrderValidator validator,
            OrderExecution executor) {

        this.validator = validator;
        this.executor = executor;
    }

    public Transaction submitOrder(Order order) {

        // Rules 1-8 validation happens here
        // If any rule fails, exception is thrown
        // Executor is never called
        validator.validate(order);

        // Order enters the trading lifecycle
        order.submit();

        // Only validated orders reach execution
        return executor.execute(order);
    }

    public boolean cancelOrder(Order order) {

        return order.cancel();
    }

}