package com.tanmaysinghx.qubit.exam;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/** Single source of truth for how a response is marked. */
public final class Marking {

    public enum Outcome { CORRECT, PARTIAL, INCORRECT, UNANSWERED }

    public record Result(Outcome outcome, int awarded) {}

    private Marking() {}

    public static Result mark(Question q, String response) {
        if (response == null || response.isBlank()) return new Result(Outcome.UNANSWERED, 0);
        String r = response.trim();
        return switch (q.getType()) {
            case SINGLE -> r.equals(q.getCorrectAnswer()) ? full(q) : wrong(q);
            case NUMERIC -> numericCorrect(q, r) ? full(q) : wrong(q);
            case MULTIPLE -> markMultiple(q, r);
        };
    }

    private static Result markMultiple(Question q, String r) {
        Set<String> chosen = split(r);
        Set<String> key = split(q.getCorrectAnswer());
        if (chosen.equals(key)) return full(q);
        if (q.isPartialMarking() && !chosen.isEmpty() && key.containsAll(chosen)) {
            // JEE Advanced: +3 for 3 of 4, +2 for 2 of ≥3, +1 for 1 of ≥2 — i.e. one mark per correct option chosen,
            // capped below full marks.
            return new Result(Outcome.PARTIAL, Math.min(chosen.size(), Math.max(0, q.getMarks() - 1)));
        }
        return wrong(q);
    }

    private static boolean numericCorrect(Question q, String r) {
        try {
            BigDecimal given = new BigDecimal(r);
            BigDecimal key = new BigDecimal(q.getCorrectAnswer());
            return given.subtract(key).abs().compareTo(BigDecimal.valueOf(q.tolerance()).add(new BigDecimal("1e-9"))) <= 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static Set<String> split(String s) {
        return Arrays.stream(s.split(",")).map(String::trim).filter(x -> !x.isEmpty()).collect(Collectors.toSet());
    }

    private static Result full(Question q) { return new Result(Outcome.CORRECT, q.getMarks()); }

    private static Result wrong(Question q) { return new Result(Outcome.INCORRECT, -q.getNegativeMarks()); }
}
