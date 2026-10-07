package com.capstone.etp.assistant;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Checks what the model wrote before the customer sees it. A model can be talked into things; this does not rely on it
 * not being. Anything that looks like advice, a leak, or an essay is thrown away and the rules' own sentence is used.
 */
final class AssistantOutputGuard {

    private static final int MAX_LENGTH = 1200;

    private static final List<Pattern> FORBIDDEN = List.of(
            Pattern.compile("\\byou should (buy|sell|hold|invest|short|consider (buying|selling))\\b"),
            Pattern.compile("\\bi (recommend|suggest|advise|would (buy|sell))\\b"),
            Pattern.compile("\\b(consider|try|think about) (buying|selling|investing)\\b"),
            Pattern.compile("\\b(good|great|best|right) (time|opportunity|moment) to (buy|sell|invest)\\b"),
            Pattern.compile("\\b(will|is likely to|is going to|should) (rise|fall|go up|go down|increase|decrease|rally|crash)\\b"),
            Pattern.compile("\\b(price target|undervalued|overvalued|strong buy|strong sell)\\b"),
            Pattern.compile("system prompt|my instructions|my rules|api key|bearer |\\bjwt\\b|aiza[0-9a-z_-]{10}"));

    private AssistantOutputGuard() {
    }

    /** @return true if the text may be shown */
    static boolean accept(String text, String apiKey) {
        if (text == null || text.isBlank() || text.length() > MAX_LENGTH) {
            return false;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        if (apiKey != null && !apiKey.isBlank() && text.contains(apiKey)) {
            return false;
        }
        for (Pattern pattern : FORBIDDEN) {
            if (pattern.matcher(lower).find()) {
                return false;
            }
        }
        return true;
    }
}
