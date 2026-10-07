package com.capstone.etp.notifications;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailTemplateRendererTest {

    private final EmailTemplateRenderer renderer = new EmailTemplateRenderer("https://app.example/");
    private final Instant at = Instant.parse("2026-10-07T14:05:11Z");

    @Test
    void everyKindRendersWithItsOwnHeadlineMascotAndButton() {
        for (NotificationKind kind : NotificationKind.values()) {
            EmailTemplateRenderer.Rendered rendered = renderer.render(kind, "RABBIT", "Subject", "Body text.", at);

            assertTrue(rendered.html().contains("Body text."), kind + " carries the message");
            assertTrue(rendered.html().contains("/mascots/email/rabbit-"), kind + " shows the chosen mascot");
            assertFalse(rendered.html().contains("{{"), kind + " has no unfilled placeholder");
            assertTrue(rendered.text().contains("https://app.example/"), kind + " text version has the link");
        }
    }

    @Test
    void thePoseFitsTheMessage() {
        assertTrue(renderer.render(NotificationKind.ORDER_FILLED, "OWL", "s", "b", at).html().contains("owl-happy.png"));
        assertTrue(renderer.render(NotificationKind.ORDER_REJECTED, "OWL", "s", "b", at).html().contains("owl-sad.png"));
        assertTrue(renderer.render(NotificationKind.PRICE_ALERT, "CAT", "s", "b", at).html().contains("cat-thinking.png"));
        assertTrue(renderer.renderWelcome("OWL", "s", "b", at).html().contains("owl-wave.png"));
    }

    @Test
    void customerTextIsEscapedSoItCannotInjectMarkup() {
        EmailTemplateRenderer.Rendered rendered = renderer.render(NotificationKind.PRICE_ALERT, "OWL",
                "<script>alert(1)</script>", "x \" onerror=\"y <b>bold</b>", at);

        assertFalse(rendered.html().contains("<script>alert"));
        assertFalse(rendered.html().contains("<b>bold</b>"));
        assertTrue(rendered.html().contains("&lt;b&gt;bold&lt;/b&gt;"));
    }

    @Test
    void anUnknownMascotFallsBackToTheOwl() {
        assertEquals("owl", EmailTemplateRenderer.normaliseMascot("DRAGON"));
        assertEquals("owl", EmailTemplateRenderer.normaliseMascot(null));
        assertEquals("cat", EmailTemplateRenderer.normaliseMascot("CAT"));
    }

    @Test
    void theTemplateSupportsDarkModeAndSmallScreens() {
        String html = renderer.render(NotificationKind.FUNDS, "OWL", "s", "b", at).html();

        assertTrue(html.contains("prefers-color-scheme: dark"));
        assertTrue(html.contains("max-width: 600px"));
        assertTrue(html.contains("name=\"viewport\""));
    }
}
