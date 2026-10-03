package com.capstone.etp.controller;

import com.capstone.etp.dto.AdminAccountSummary;
import com.capstone.etp.dto.RegistrationRequest;
import com.capstone.etp.dto.RegistrationResponse;
import com.capstone.etp.service.RegistrationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final RegistrationService registrationService;

    @GetMapping("/accounts")
    public ResponseEntity<List<AdminAccountSummary>> listAccounts() {
        return ResponseEntity.status(HttpStatus.OK).body(registrationService.listAccounts());
    }

    @PostMapping("/registrations")
    public ResponseEntity<RegistrationResponse> register(
            @Valid @RequestBody RegistrationRequest request,
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        return ResponseEntity.status(HttpStatus.CREATED).body(registrationService.register(request, authorization));
    }
}
