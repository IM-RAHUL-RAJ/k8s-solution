package com.capstone.etp.service;

import com.capstone.etp.dto.AdminAccountSummary;
import com.capstone.etp.dto.RegistrationRequest;
import com.capstone.etp.dto.RegistrationResponse;
import com.capstone.etp.exception.RegistrationException;
import com.capstone.etp.mapper.AdminMapper;
import com.capstone.etp.security.AccountAuthorizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Admin-only. Opens a client, an account and its portfolio, then has the auth service create the
 * login and email the default password. It is one transaction: if the login cannot be created
 * (username taken, email failed, auth service down) the client and account roll back with it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RegistrationService {

    private static final Pattern USERNAME = Pattern.compile("^[a-z0-9._-]{3,64}$");

    private final AdminMapper adminMapper;
    private final AccountAuthorizer accountAuthorizer;
    private final AuthRegistrationClient authClient;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    /** Every account with its client, for the admin dashboard. Read only. */
    public List<AdminAccountSummary> listAccounts() {
        accountAuthorizer.ensureAdmin();
        return adminMapper.listAccounts();
    }

    /** The username is the email's local part: priya.menon@example.com becomes priya.menon. */
    static String usernameFor(String email) {
        return email.trim().toLowerCase(Locale.ROOT).split("@", 2)[0];
    }

    @Transactional
    public RegistrationResponse register(RegistrationRequest request, String authorization) {
        accountAuthorizer.ensureAdmin();

        String email = request.getEmail().trim().toLowerCase(Locale.ROOT);
        String username = usernameFor(email);
        if (!USERNAME.matcher(username).matches()) {
            throw new RegistrationException("REG-422", HttpStatus.UNPROCESSABLE_ENTITY,
                    "The part of the email before the @ becomes the username, so it must be 3 to 64 letters, "
                            + "numbers, dots, underscores or hyphens");
        }

        adminMapper.lockReferenceAllocation();
        if (adminMapper.countClientsByEmail(email) > 0) {
            throw new RegistrationException("REG-409", HttpStatus.CONFLICT,
                    "That username or email is already registered");
        }

        String clientRef = adminMapper.nextClientRef();
        String accountRef = adminMapper.nextAccountRef();

        // clients.password_hash is NOT NULL but sign-in is the auth service's job, so this is an
        // unguessable placeholder, never a password anybody knows.
        Long clientId = adminMapper.insertClient(
                clientRef,
                request.getName().trim(),
                email,
                encoder.encode(UUID.randomUUID().toString()),
                request.getPhone(),
                request.getDateOfBirth(),
                request.getGender() == null ? null : request.getGender().name());

        BigDecimal opening = request.getOpeningBalance() == null ? BigDecimal.ZERO : request.getOpeningBalance();
        Long accountId = adminMapper.insertAccount(
                accountRef, clientId, request.getAccountType().name(), request.getCurrency(), opening);
        adminMapper.insertPortfolio(accountId, "Primary portfolio");
        if (request.getRiskProfile() != null) {
            adminMapper.insertPreferences(accountId, request.getRiskProfile().name());
        }

        // Last on purpose: if this throws, everything above is rolled back.
        boolean emailSent = authClient.register(username, email, accountId, authorization);

        log.info("[REGISTRATION] created clientRef={} accountRef={} username={}", clientRef, accountRef, username);
        return RegistrationResponse.builder()
                .clientId(clientId)
                .clientRef(clientRef)
                .accountId(accountId)
                .accountRef(accountRef)
                .username(username)
                .email(email)
                .emailSent(emailSent)
                .build();
    }
}
