package com.capstone.etp.security;

import com.capstone.etp.exception.AccountAccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class AccountAuthorizer {

    public void ensureAccountAccess(Long accountId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw new UnauthorizedException("Unauthorised");
        }

        if (!user.accountIds().contains(accountId)) {
            throw new AccountAccessDeniedException();
        }
    }
}
