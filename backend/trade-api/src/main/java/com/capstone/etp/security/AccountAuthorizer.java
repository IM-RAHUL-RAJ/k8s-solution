package com.capstone.etp.security;

import com.capstone.etp.exception.AccountAccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

@Component
public class AccountAuthorizer {

    public void ensureAccountAccess(Long accountId) {
        AuthenticatedUser user = getAuthenticatedUser();
        if (isAdmin(user)) {
            return;
        }

        List<Long> accountIds = user.accountIds();
        if (accountIds == null || !accountIds.contains(accountId)) {
            throw new AccountAccessDeniedException();
        }
    }

    public void ensureOrderManagementAllowed() {
        AuthenticatedUser user = getAuthenticatedUser();
        if (isAdmin(user)) {
            throw new AccountAccessDeniedException(
                    "Admin users can only access read endpoints");
        }
    }

    private AuthenticatedUser getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Unauthorised");
        }
        return user;
    }

    private boolean isAdmin(AuthenticatedUser user) {
        if (user.roles() == null) {
            return false;
        }
        return user.roles().stream()
                .filter(role -> role != null && !role.isBlank())
                .map(role -> role.trim().toUpperCase(Locale.ROOT))
                .map(role -> role.startsWith("ROLE_") ? role.substring(5) : role)
                .anyMatch("ADMIN"::equals);
    }
}
