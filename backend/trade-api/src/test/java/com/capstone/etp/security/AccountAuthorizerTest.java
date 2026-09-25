package com.capstone.etp.security;

import com.capstone.etp.exception.AccountAccessDeniedException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AccountAuthorizerTest {

    private final AccountAuthorizer accountAuthorizer = new AccountAuthorizer();

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void ensureAccountAccess_allowsCustomerForOwnedAccount() {
        setAuthenticatedUser(new AuthenticatedUser("u1", List.of(10L, 11L), List.of("CUSTOMER")));

        assertDoesNotThrow(() -> accountAuthorizer.ensureAccountAccess(10L));
    }

    @Test
    void ensureAccountAccess_deniesCustomerForOtherAccount() {
        setAuthenticatedUser(new AuthenticatedUser("u1", List.of(10L), List.of("CUSTOMER")));

        assertThrows(AccountAccessDeniedException.class, () -> accountAuthorizer.ensureAccountAccess(99L));
    }

    @Test
    void ensureAccountAccess_allowsAdminWithoutAccountMembership() {
        setAuthenticatedUser(new AuthenticatedUser("admin", List.of(), List.of("ADMIN")));

        assertDoesNotThrow(() -> accountAuthorizer.ensureAccountAccess(99L));
    }

    @Test
    void ensureOrderManagementAllowed_deniesAdmin() {
        setAuthenticatedUser(new AuthenticatedUser("admin", List.of(), List.of("ADMIN")));

        assertThrows(AccountAccessDeniedException.class, () -> accountAuthorizer.ensureOrderManagementAllowed());
    }

    private void setAuthenticatedUser(AuthenticatedUser user) {
        var authentication = new UsernamePasswordAuthenticationToken(user, null, List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
