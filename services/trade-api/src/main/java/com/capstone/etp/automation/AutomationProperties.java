package com.capstone.etp.automation;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * app.automation.*: off unless enabled. The service token is the JWT of the customer the strategies trade for;
 * it is sent to the Trade REST API exactly as a browser would, so the platform's own checks apply.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "app.automation")
public class AutomationProperties {

    private boolean enabled = false;
    /** Where the Trade REST API is. Defaults to this same service. */
    private String tradeApiBaseUrl = "http://localhost:8084";
    private String serviceToken = "";
    private int connectTimeoutMs = 2000;
    private int readTimeoutMs = 4000;
    /** Prices kept per symbol. Must cover the longest period any strategy uses, plus one. */
    private int historySize = 500;
    private List<StrategyDefinition> strategies = new ArrayList<>();
}
