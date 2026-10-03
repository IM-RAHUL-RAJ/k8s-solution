package com.capstone.etp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The default password is deliberately absent: it only ever goes to the customer's inbox. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegistrationResponse {
    private Long clientId;
    private String clientRef;
    private Long accountId;
    private String accountRef;
    private String username;
    private String email;
    private boolean emailSent;
}
