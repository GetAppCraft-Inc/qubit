package com.tanmaysinghx.qubit.exam;

import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

public final class ExamDtos {
    private ExamDtos() {}

    public record ExamRequest(
            @NotBlank @Size(max = 40) @Pattern(regexp = "^[A-Za-z0-9-]+$", message = "letters, numbers and dashes only") String code,
            @NotBlank @Size(max = 200) String title,
            String description,
            String instructions,
            @NotNull ExamCategory category,
            @Min(5) @Max(600) int durationMinutes,
            @Min(0) @Max(120) int lateEntryMinutes,
            @Min(0) @Max(10) int violationTolerance,
            boolean showResults,
            Instant registrationOpensAt,
            Instant registrationClosesAt,
            ExamMode mode,
            @Size(max = 500) String webhookUrl,
            IntegrityAction integrityAction) {}

    public record SlotRequest(@NotNull Instant startsAt, @Min(1) @Max(100000) int capacity, @Size(max = 80) String label) {}

    public record QuestionRequest(
            @NotBlank @Size(max = 60) String subject,
            @NotNull QuestionType type,
            @NotBlank String text,
            List<String> options,
            @NotBlank @Size(max = 120) String correctAnswer,
            @Min(0) @Max(100) int marks,
            @Min(0) @Max(100) int negativeMarks,
            Integer position,
            @Size(max = 120) String section,
            /** data URL to set/replace, "keep" to leave the current figure, null/blank to remove it. */
            @Size(max = 2_000_000) String imageData,
            Boolean partialMarking,
            @DecimalMin("0") Double answerTolerance) {}

    public record SlotDto(Long id, Instant startsAt, int capacity, String label, long booked) {}

    public record QuestionAdminDto(Long id, String subject, String section, QuestionType type, String text,
                                   List<String> options, String imageUrl, String correctAnswer, int marks,
                                   int negativeMarks, int position, boolean partialMarking, Double answerTolerance) {
        public static QuestionAdminDto of(Question q, String imageUrl) {
            return new QuestionAdminDto(q.getId(), q.getSubject(), q.getSection(), q.getType(), q.getText(),
                    List.copyOf(q.getOptions()), imageUrl, q.getCorrectAnswer(), q.getMarks(),
                    q.getNegativeMarks(), q.getPosition(), q.isPartialMarking(), q.getAnswerTolerance());
        }
    }

    public record ExamSummaryDto(Long id, String code, String title, ExamCategory category, ExamStatus status, ExamMode mode,
                                 int durationMinutes, int questionCount, int totalMarks, int slotCount,
                                 long registrationCount, Instant registrationOpensAt, Instant registrationClosesAt,
                                 Instant nextSlotAt, Instant createdAt) {}

    public record ExamDetailDto(Long id, String code, String title, String description, String instructions,
                                ExamCategory category, ExamStatus status, ExamMode mode, String webhookUrl,
                                String webhookSecret, int durationMinutes, int lateEntryMinutes,
                                int violationTolerance, IntegrityAction integrityAction, boolean showResults, Instant registrationOpensAt,
                                Instant registrationClosesAt, int totalMarks, long registrationCount, boolean locked,
                                List<SlotDto> slots, List<QuestionAdminDto> questions) {}
}
