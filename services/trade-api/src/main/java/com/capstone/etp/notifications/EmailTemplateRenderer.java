package com.capstone.etp.notifications;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fills the HTML e-mail templates in {@code resources/email}. A template is a layout (logo, mascot, button, footer)
 * plus the words for one kind of message. Values written as {{name}} are HTML-escaped; only {{{content}}} is raw,
 * and that is a template file of ours, never customer text.
 */
@Component
class EmailTemplateRenderer {

    record Rendered(String html, String text) {
    }

    /** What differs between kinds: the template, the pose of the mascot, the colour, and where the button goes. */
    private record Style(String template, String pose, String accent, String ctaLabel, String ctaPath) {
    }

    private static final Pattern RAW = Pattern.compile("\\{\\{\\{(\\w+)}}}");
    private static final Pattern ESCAPED = Pattern.compile("\\{\\{(\\w+)}}");
    private static final DateTimeFormatter SENT = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm 'UTC'", Locale.ENGLISH);

    private final Map<String, String> templates = new ConcurrentHashMap<>();
    private final String publicBaseUrl;

    EmailTemplateRenderer(@Value("${app.public.base-url:http://localhost:4200}") String publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl.endsWith("/") ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
    }

    Rendered render(NotificationKind kind, String mascot, String subject, String body, Instant at) {
        return render(styleOf(kind), mascot, subject, body, at);
    }

    /** The welcome message sent when an account is opened. */
    Rendered renderWelcome(String mascot, String subject, String body, Instant at) {
        return render(new Style("welcome", "wave", "#2563eb", "Open Quorum", "/dashboard"), mascot, subject, body, at);
    }

    private Rendered render(Style style, String mascot, String subject, String body, Instant at) {
        String mascotKey = normaliseMascot(mascot);
        Map<String, String> values = new HashMap<>();
        values.put("subject", subject);
        values.put("body", body);
        values.put("preheader", body);
        values.put("accent", style.accent());
        values.put("ctaLabel", style.ctaLabel());
        values.put("ctaUrl", publicBaseUrl + style.ctaPath());
        values.put("settingsUrl", publicBaseUrl + "/settings");
        values.put("mascotUrl", publicBaseUrl + "/mascots/email/" + mascotKey + "-" + style.pose() + ".png");
        values.put("mascotName", mascotKey.substring(0, 1).toUpperCase(Locale.ROOT) + mascotKey.substring(1));
        values.put("sentAt", SENT.format((at == null ? Instant.now() : at).atOffset(ZoneOffset.UTC)));

        String content = fill(template(style.template()), values, Map.of());
        String html = fill(template("layout"), values, Map.of("content", content));
        String text = subject + "\n\n" + body + "\n\n" + style.ctaLabel() + ": " + values.get("ctaUrl") + "\n";
        return new Rendered(html, text);
    }

    private static String fill(String template, Map<String, String> escaped, Map<String, String> raw) {
        String out = replace(RAW, template, raw, false);
        // Raw content is filled first, so the escaped pass also fills the placeholders inside it.
        return replace(ESCAPED, out, escaped, true);
    }

    private static String replace(Pattern pattern, String input, Map<String, String> values, boolean escape) {
        Matcher matcher = pattern.matcher(input);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String value = values.get(matcher.group(1));
            if (value == null) {
                matcher.appendReplacement(out, Matcher.quoteReplacement(matcher.group()));
            } else {
                matcher.appendReplacement(out, Matcher.quoteReplacement(escape ? HtmlUtils.htmlEscape(value) : value));
            }
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private String template(String name) {
        return templates.computeIfAbsent(name, key -> {
            try (var in = new ClassPathResource("email/" + key + ".html").getInputStream()) {
                return new String(in.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException("Missing e-mail template " + key, e);
            }
        });
    }

    static String normaliseMascot(String mascot) {
        String value = mascot == null ? "owl" : mascot.trim().toLowerCase(Locale.ROOT);
        return switch (value) {
            case "rabbit", "cat" -> value;
            default -> "owl";
        };
    }

    private static Style styleOf(NotificationKind kind) {
        return switch (kind) {
            case ORDER_FILLED -> new Style("order-placed", "happy", "#2563eb", "View order in app", "/blotter");
            case ORDER_REJECTED -> new Style("order-rejected", "sad", "#b45309", "See your orders", "/blotter");
            case ORDER_CANCELLED -> new Style("order-cancelled", "thinking", "#475569", "See your orders", "/blotter");
            case PRICE_ALERT -> new Style("price-alert", "thinking", "#7c3aed", "View alert", "/alerts");
            case FUNDS -> new Style("funds", "happy", "#0f766e", "View balance", "/account");
        };
    }
}
