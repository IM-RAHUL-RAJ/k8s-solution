package com.capstone.etp.service;

import com.capstone.etp.dto.RegistrationRequest;
import com.capstone.etp.dto.RegistrationResponse;
import com.capstone.etp.enums.AccountType;
import com.capstone.etp.enums.Gender;
import com.capstone.etp.enums.RiskProfile;
import com.capstone.etp.exception.AccountAccessDeniedException;
import com.capstone.etp.exception.RegistrationException;
import com.capstone.etp.mapper.AdminMapper;
import com.capstone.etp.security.AccountAuthorizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegistrationServiceTest {

    private static final String BEARER = "Bearer admin-token";

    @Mock
    private AdminMapper adminMapper;

    @Mock
    private AccountAuthorizer accountAuthorizer;

    @Mock
    private AuthRegistrationClient authClient;

    private RegistrationService service;

    @BeforeEach
    void setUp() {
        service = new RegistrationService(adminMapper, accountAuthorizer, authClient);
    }

    private RegistrationRequest request(String email) {
        RegistrationRequest request = new RegistrationRequest();
        request.setName("  Priya Menon ");
        request.setEmail(email);
        request.setPhone("9876543210");
        request.setDateOfBirth(LocalDate.of(1990, 4, 12));
        request.setGender(Gender.FEMALE);
        request.setAccountType(AccountType.INDIAN_EQUITY);
        request.setCurrency("INR");
        request.setOpeningBalance(new BigDecimal("50000.00"));
        request.setRiskProfile(RiskProfile.MODERATE);
        return request;
    }

    private void refsAvailable() {
        when(adminMapper.countClientsByEmail(anyString())).thenReturn(0);
        when(adminMapper.nextClientRef()).thenReturn("C000000011");
        when(adminMapper.nextAccountRef()).thenReturn("ACC0000011");
        when(adminMapper.insertClient(anyString(), anyString(), anyString(), anyString(), any(), any(), any()))
                .thenReturn(11L);
        when(adminMapper.insertAccount(anyString(), anyLong(), anyString(), anyString(), any())).thenReturn(21L);
    }

    @Test
    void usernameIsTheEmailsLocalPart() {
        assertThat(RegistrationService.usernameFor(" Priya.Menon@Example.com ")).isEqualTo("priya.menon");
    }

    @Test
    void createsClientAccountPortfolioAndPreferencesThenRegistersTheLogin() {
        refsAvailable();
        when(authClient.register("priya.menon", "priya.menon@example.com", 21L, BEARER)).thenReturn(true);

        RegistrationResponse response = service.register(request("Priya.Menon@Example.com"), BEARER);

        assertThat(response.getUsername()).isEqualTo("priya.menon");
        assertThat(response.getClientRef()).isEqualTo("C000000011");
        assertThat(response.getAccountRef()).isEqualTo("ACC0000011");
        assertThat(response.getAccountId()).isEqualTo(21L);
        assertThat(response.isEmailSent()).isTrue();

        verify(adminMapper).insertClient(eq("C000000011"), eq("Priya Menon"), eq("priya.menon@example.com"),
                anyString(), eq("9876543210"), eq(LocalDate.of(1990, 4, 12)), eq("FEMALE"));
        verify(adminMapper).insertAccount("ACC0000011", 11L, "INDIAN_EQUITY", "INR", new BigDecimal("50000.00"));
        verify(adminMapper).insertPortfolio(21L, "Primary portfolio");
        verify(adminMapper).insertPreferences(21L, "MODERATE");
    }

    @Test
    void theClientRowHoldsAnUnusableHashNeverAPlainPassword() {
        refsAvailable();
        when(authClient.register(anyString(), anyString(), anyLong(), anyString())).thenReturn(true);

        service.register(request("priya.menon@example.com"), BEARER);

        verify(adminMapper).insertClient(anyString(), anyString(), anyString(),
                org.mockito.ArgumentMatchers.startsWith("$2"), any(), any(), any());
    }

    @Test
    void aNonAdminCallerIsStoppedBeforeAnythingIsWritten() {
        doThrow(new AccountAccessDeniedException("Admin access required")).when(accountAuthorizer).ensureAdmin();

        assertThatThrownBy(() -> service.register(request("priya.menon@example.com"), BEARER))
                .isInstanceOf(AccountAccessDeniedException.class);

        verify(adminMapper, never()).insertClient(any(), any(), any(), any(), any(), any(), any());
        verify(authClient, never()).register(any(), any(), any(), any());
    }

    @Test
    void aUsernameThatCannotBeUsedIsRejectedWithAClearMessage() {
        assertThatThrownBy(() -> service.register(request("ab@example.com"), BEARER))
                .isInstanceOf(RegistrationException.class)
                .hasMessageContaining("before the @");
        assertThatThrownBy(() -> service.register(request("a+b.tag@example.com"), BEARER))
                .isInstanceOf(RegistrationException.class);

        verify(adminMapper, never()).insertClient(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void anEmailThatIsAlreadyAClientIsAConflict() {
        when(adminMapper.countClientsByEmail("priya.menon@example.com")).thenReturn(1);

        assertThatThrownBy(() -> service.register(request("priya.menon@example.com"), BEARER))
                .isInstanceOf(RegistrationException.class)
                .extracting(e -> ((RegistrationException) e).getCatalogueCode())
                .isEqualTo("REG-409");

        verify(adminMapper, never()).insertClient(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void whenTheAuthServiceFailsTheErrorPropagatesSoTheTransactionRollsBack() {
        refsAvailable();
        when(authClient.register(anyString(), anyString(), anyLong(), anyString()))
                .thenThrow(new RegistrationException("REG-503",
                        org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "email failed"));

        assertThatThrownBy(() -> service.register(request("priya.menon@example.com"), BEARER))
                .isInstanceOf(RegistrationException.class)
                .hasMessage("email failed");
    }
}
