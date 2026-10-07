package com.capstone.etp.notifications;

import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** What actually leaves the platform: a real MIME message, checked part by part. */
class EmailChannelSenderTest {

    /** A mail sender that keeps the message instead of connecting anywhere. */
    private static final class Capturing extends JavaMailSenderImpl {
        MimeMessage sent;

        @Override
        public void send(MimeMessage message) {
            sent = message;
        }
    }

    private static void collect(Part part, List<Part> into) throws Exception {
        into.add(part);
        if (part.isMimeType("multipart/*")) {
            Multipart multipart = (Multipart) part.getContent();
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart child = multipart.getBodyPart(i);
                collect(child, into);
            }
        }
    }

    private static byte[] bytes(Part part) throws Exception {
        try (InputStream in = part.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            in.transferTo(out);
            return out.toByteArray();
        }
    }

    @SuppressWarnings("unchecked")
    private MimeMessage sendOne(NotificationKind kind, String mascot) throws Exception {
        Capturing mail = new Capturing();
        ObjectProvider<org.springframework.mail.javamail.JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mail);
        EmailChannelSender sender = new EmailChannelSender(provider, "smtp.example.test", "no-reply@quorum.test",
                new EmailTemplateRenderer("https://app.example"));

        ChannelSender.Mode mode = sender.send(new OutboundMessage("jane@example.com", "Order filled: BUY 100 AAPL",
                "Your BUY order for 100 AAPL was filled at 232.71.", kind, mascot));

        assertEquals(ChannelSender.Mode.LIVE, mode);
        assertNotNull(mail.sent);
        mail.sent.saveChanges();
        return mail.sent;
    }

    @Test
    void theMessageCarriesTheAnimatedMascotInsideItSoItShowsWithNoExternalImage() throws Exception {
        MimeMessage message = sendOne(NotificationKind.ORDER_FILLED, "CAT");

        List<Part> parts = new ArrayList<>();
        collect(message, parts);

        Part picture = parts.stream().filter(p -> {
            try {
                return p.isMimeType("image/gif");
            } catch (Exception e) {
                return false;
            }
        }).findFirst().orElseThrow(() -> new AssertionError("no GIF part in the message"));

        assertEquals("<mascot>", ((jakarta.mail.internet.MimeBodyPart) picture).getContentID());
        assertEquals(Part.INLINE, picture.getDisposition());
        byte[] gif = bytes(picture);
        assertEquals("GIF89a", new String(gif, 0, 6, java.nio.charset.StandardCharsets.US_ASCII), "a real GIF");
        assertTrue(gif.length > 1500, "with several frames in it");
        // An animated GIF has more than one image descriptor (0x2C) block; a still one has exactly one.
        assertTrue(countImageBlocks(gif) > 1, "it moves");
    }

    private static int countImageBlocks(byte[] gif) {
        // Graphic Control Extension blocks (21 F9) appear once per frame.
        int count = 0;
        for (int i = 0; i < gif.length - 1; i++) {
            if ((gif[i] & 0xff) == 0x21 && (gif[i + 1] & 0xff) == 0xf9) {
                count++;
            }
        }
        return count;
    }

    @Test
    void theHtmlPointsAtTheAttachedPictureAndThereIsAPlainTextVersionToo() throws Exception {
        MimeMessage message = sendOne(NotificationKind.PRICE_ALERT, "OWL");
        List<Part> parts = new ArrayList<>();
        collect(message, parts);

        String html = null;
        String text = null;
        for (Part part : parts) {
            if (part.isMimeType("text/html")) {
                html = (String) part.getContent();
            } else if (part.isMimeType("text/plain")) {
                text = (String) part.getContent();
            }
        }

        assertNotNull(html);
        assertTrue(html.contains("src=\"cid:mascot\""));
        assertFalse(html.contains("localhost"), "no address a mail client could not reach");
        assertNotNull(text);
        assertTrue(text.contains("Order filled: BUY 100 AAPL"));
        assertEquals("Order filled: BUY 100 AAPL", message.getSubject());
    }

    @Test
    void eachKindSendsItsOwnAnimation() throws Exception {
        for (NotificationKind kind : NotificationKind.values()) {
            for (String mascot : List.of("OWL", "RABBIT", "CAT")) {
                String resource = new EmailTemplateRenderer("https://app.example")
                        .render(kind, mascot, "s", "b", java.time.Instant.now()).mascotResource();
                assertTrue(new org.springframework.core.io.ClassPathResource(resource).exists(), resource + " is packaged with the service");
            }
        }
    }
}
