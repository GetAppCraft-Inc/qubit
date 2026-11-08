package com.tanmaysinghx.qubit.attempt;

import com.tanmaysinghx.qubit.exam.QuestionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class AttemptDtos {
    private AttemptDtos() {}

    public record StartRequest(@NotBlank @Size(max = 64) String clientSessionId) {}

    public record AnswerRequest(@Size(max = 60) String response, boolean markedForReview) {}

    public record EventRequest(@NotBlank String type, @Size(max = 200) String detail) {}

    public record PaperQuestion(Long id, int index, String subject, String section, QuestionType type, String text,
                                List<String> options, String imageUrl, int marks, int negativeMarks,
                                boolean partialMarking) {}

    public record AnswerDto(Long questionId, String response, boolean markedForReview) {}

    public record PaperDto(Long attemptId, Long registrationId, com.tanmaysinghx.qubit.exam.ExamMode mode, AttemptStatus status, String terminationReason,
                           String hallTicketNo, String candidateName, String examTitle, String examCode,
                           int durationMinutes, int violationTolerance, int totalMarks, int violationCount,
                           Instant startedAt, Instant endsAt, Instant serverNow,
                           List<PaperQuestion> questions, List<AnswerDto> answers) {}

    public record ViolationOutcome(boolean counted, boolean terminated, int violationCount, int tolerance,
                                   String label, String reason) {}

    public record SubmitResult(AttemptStatus status, String terminationReason) {}
}
