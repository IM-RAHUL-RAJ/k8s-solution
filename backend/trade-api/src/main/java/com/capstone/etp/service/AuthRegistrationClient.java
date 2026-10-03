package com.capstone.etp.service;

import com.capstone.etp.exception.RegistrationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * Calls the auth service's POST /auth/register with the admin's own bearer token, so the auth
 * service decides whether the caller really is an admin. No password is sent: the auth service
 * generates the default one and emails it.
 */
@Component
public class AuthRegistrationClient {

    private final RestClient restClient;

    public AuthRegistrationClient(@Value("${app.auth.base-url}") String baseUrl) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
    }

    /** @return true when the auth service says the welcome email went out. */
    @SuppressWarnings("unchecked")
    public boolean register(String username, String email, Long accountId, String authorization) {
        try {
            Map<String, Object> response = restClient.post()
                    .uri("/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .body(Map.of(
                            "username", username,
                            "email", email,
                            "accountId", accountId,
                            "roles", List.of("CUSTOMER")))
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (request, result) -> {
                        throw translate(result.getStatusCode());
                    })
                    .body(Map.class);
            return response != null && Boolean.TRUE.equals(response.get("emailSent"));
        } catch (RegistrationException e) {
            throw e;
        } catch (RestClientException e) {
            throw new RegistrationException("REG-502", HttpStatus.BAD_GATEWAY,
                    "The auth service could not be reached");
        }
    }

    private RegistrationException translate(HttpStatusCode status) {
        if (status.value() == 409) {
            return new RegistrationException("REG-409", HttpStatus.CONFLICT,
                    "That username or email is already registered");
        }
        if (status.value() == 401 || status.value() == 403) {
            return new RegistrationException("REG-502", HttpStatus.BAD_GATEWAY,
                    "The auth service did not accept the admin token");
        }
        if (status.value() == 503) {
            return new RegistrationException("REG-503", HttpStatus.SERVICE_UNAVAILABLE,
                    "The welcome email could not be sent. Check the auth service's SMTP settings");
        }
        return new RegistrationException("REG-502", HttpStatus.BAD_GATEWAY,
                "The auth service refused the registration");
    }
}
