package com.capstone.etp.security;

import java.util.List;

public record AuthenticatedUser(
        String subject,
        Long accountId,
        List<String> roles) {
}
