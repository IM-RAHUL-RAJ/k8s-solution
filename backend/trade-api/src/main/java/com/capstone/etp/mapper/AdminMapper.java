package com.capstone.etp.mapper;

import com.capstone.etp.dto.AdminAccountSummary;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Mapper
public interface AdminMapper {

    // Reference numbers have no sequence, so allocation is serialised for the length of the transaction.
    @Select("SELECT 1 FROM (SELECT pg_advisory_xact_lock(727001)) AS locked")
    int lockReferenceAllocation();

    @Select("""
        SELECT 'C' || LPAD((COALESCE(MAX(SUBSTRING(client_ref FROM 2)::bigint), 0) + 1)::text, 9, '0')
        FROM clients""")
    String nextClientRef();

    @Select("""
        SELECT 'ACC' || LPAD((COALESCE(MAX(SUBSTRING(account_ref FROM 4)::bigint), 0) + 1)::text, 7, '0')
        FROM accounts""")
    String nextAccountRef();

    @Select("SELECT COUNT(*) FROM clients WHERE LOWER(email) = LOWER(#{email})")
    int countClientsByEmail(@Param("email") String email);

    @Select("""
        INSERT INTO clients (client_ref, name, email, password_hash, phone, date_of_birth, gender)
        VALUES (#{clientRef}, #{name}, #{email}, #{passwordHash}, #{phone}, #{dateOfBirth},
                CAST(#{gender,jdbcType=VARCHAR} AS gender_enum))
        RETURNING id""")
    Long insertClient(
            @Param("clientRef") String clientRef,
            @Param("name") String name,
            @Param("email") String email,
            @Param("passwordHash") String passwordHash,
            @Param("phone") String phone,
            @Param("dateOfBirth") LocalDate dateOfBirth,
            @Param("gender") String gender);

    @Select("""
        INSERT INTO accounts (account_ref, client_id, account_type, currency, cash_balance, updated_at)
        VALUES (#{accountRef}, #{clientId}, CAST(#{accountType} AS account_type_enum), #{currency},
                #{cashBalance}, CURRENT_TIMESTAMP)
        RETURNING id""")
    Long insertAccount(
            @Param("accountRef") String accountRef,
            @Param("clientId") Long clientId,
            @Param("accountType") String accountType,
            @Param("currency") String currency,
            @Param("cashBalance") BigDecimal cashBalance);

    @Insert("INSERT INTO portfolios (account_id, name) VALUES (#{accountId}, #{name})")
    int insertPortfolio(@Param("accountId") Long accountId, @Param("name") String name);

    @Insert("""
        INSERT INTO account_preferences (account_id, risk_profile)
        VALUES (#{accountId}, CAST(#{riskProfile} AS risk_profile_enum))""")
    int insertPreferences(@Param("accountId") Long accountId, @Param("riskProfile") String riskProfile);

    @Select("""
        SELECT
           a.id AS account_id,
           a.account_ref AS account_ref,
           c.client_ref AS client_ref,
           c.name AS client_name,
           c.email AS email,
           c.phone AS phone,
           a.account_type::text AS account_type,
           TRIM(a.currency) AS currency,
           a.cash_balance AS cash_balance,
           a.status::text AS status,
           a.created_at AS created_at
        FROM accounts a
        JOIN clients c ON c.id = a.client_id
        ORDER BY a.created_at DESC, a.id DESC""")
    @Results({
        @Result(property = "accountId", column = "account_id"),
        @Result(property = "accountRef", column = "account_ref"),
        @Result(property = "clientRef", column = "client_ref"),
        @Result(property = "clientName", column = "client_name"),
        @Result(property = "email", column = "email"),
        @Result(property = "phone", column = "phone"),
        @Result(property = "accountType", column = "account_type"),
        @Result(property = "currency", column = "currency"),
        @Result(property = "cashBalance", column = "cash_balance"),
        @Result(property = "status", column = "status"),
        @Result(property = "createdAt", column = "created_at")
    })
    List<AdminAccountSummary> listAccounts();
}
