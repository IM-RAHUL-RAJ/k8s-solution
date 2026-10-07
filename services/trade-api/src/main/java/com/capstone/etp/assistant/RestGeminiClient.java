package com.capstone.etp.assistant;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Calls Gemini (generateContent) from the server, with the key in a request header. The key is never logged or put in a
 * message; nothing the customer typed is logged either. Any failure is a quiet "no answer" and the caller falls back.
 */
@Slf4j
public class RestGeminiClient implements GeminiClient {

    private final RestClient restClient;
    private final String apiKey;
    private final String model;
    private final int maxOutputTokens;

    public RestGeminiClient(RestClient restClient, String apiKey, String model, int maxOutputTokens) {
        this.restClient = restClient;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
        this.maxOutputTokens = maxOutputTokens;
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    @Override
    public Optional<String> generate(String systemInstruction, String userContent) {
        if (!isConfigured()) {
            return Optional.empty();
        }
        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", userContent)))),
                "generationConfig", Map.of("temperature", 0.2, "maxOutputTokens", maxOutputTokens));
        try {
            JsonNode response = restClient.post()
                    .uri("/v1beta/models/{model}:generateContent", model)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);
            JsonNode text = response == null ? null : response.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (text == null || text.isMissingNode() || !text.isTextual() || text.asText().isBlank()) {
                log.warn("[ASSISTANT] the model returned no usable text");
                return Optional.empty();
            }
            return Optional.of(text.asText().trim());
        } catch (RestClientException e) {
            // The message can carry the URL; the type is enough.
            log.warn("[ASSISTANT] the model call failed: {}", e.getClass().getSimpleName());
            return Optional.empty();
        } catch (RuntimeException e) {
            log.warn("[ASSISTANT] the model call failed: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
