package com.capstone.etp.executor.repository;

import com.capstone.etp.executor.domain.AccountSnapshot;
import com.capstone.etp.executor.domain.ExecutionOrder;
import com.capstone.etp.executor.domain.InstrumentSnapshot;
import com.capstone.etp.executor.domain.OrderStatus;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.Instant;
import java.util.UUID;

@Mapper
public interface ExecutionMapper {

    @Select("""
        SELECT o.id, o.account_id, o.instrument_id, i.symbol, o.order_type, o.quantity, o.limit_price, o.status
        FROM orders o
        JOIN instruments i ON i.id = o.instrument_id
        WHERE o.id = #{orderId}
        """)
    @Results({
            @Result(property = "id", column = "id"),
            @Result(property = "accountId", column = "account_id"),
            @Result(property = "instrumentId", column = "instrument_id"),
            @Result(property = "symbol", column = "symbol"),
            @Result(property = "side", column = "order_type"),
            @Result(property = "quantity", column = "quantity"),
            @Result(property = "limitPrice", column = "limit_price"),
            @Result(property = "status", column = "status")
    })
    ExecutionOrder findOrderById(@Param("orderId") UUID orderId);

    @Select("""
        SELECT id, status, cash_balance
        FROM accounts
        WHERE id = #{accountId}
        """)
    @Results({
            @Result(property = "id", column = "id"),
            @Result(property = "status", column = "status"),
            @Result(property = "cashBalance", column = "cash_balance")
    })
    AccountSnapshot findAccountById(@Param("accountId") Long accountId);

    @Select("""
        SELECT id, symbol, is_tradable
        FROM instruments
        WHERE id = #{instrumentId}
        """)
    @Results({
            @Result(property = "id", column = "id"),
            @Result(property = "symbol", column = "symbol"),
            @Result(property = "tradable", column = "is_tradable")
    })
    InstrumentSnapshot findInstrumentById(@Param("instrumentId") Long instrumentId);

    @Select("""
        SELECT ph.quantity
        FROM portfolio_holdings ph
        JOIN portfolios p ON p.id = ph.portfolio_id
        WHERE p.account_id = #{accountId} AND ph.instrument_id = #{instrumentId}
        """)
    Integer findHoldingQuantity(
            @Param("accountId") Long accountId,
            @Param("instrumentId") Long instrumentId);

    @Update("""
        UPDATE orders
        SET status = #{newStatus}::order_status_enum, terminal_at = #{terminalAt}
        WHERE id = #{orderId} AND status = #{expectedStatus}::order_status_enum
        """)
    int updateOrderStatusIfCurrentStatusMatches(
            @Param("orderId") UUID orderId,
            @Param("expectedStatus") OrderStatus expectedStatus,
            @Param("newStatus") OrderStatus newStatus,
            @Param("terminalAt") Instant terminalAt);
}
