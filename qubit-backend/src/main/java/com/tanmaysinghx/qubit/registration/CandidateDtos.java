package com.tanmaysinghx.qubit.registration;

import com.tanmaysinghx.qubit.attempt.AttemptStatus;
import com.tanmaysinghx.qubit.exam.ExamCategory;
import com.tanmaysinghx.qubit.exam.ExamMode;

import java.time.Instant;
import java.util.List;

public final class CandidateDtos {
    private CandidateDtos() {}

    public record PublicSlotDto(Long id, Instant startsAt, String label, long seatsLeft) {}

    public record PublicExamDto(Long id, String code, String title, String description, ExamCategory category,
                                ExamMode mode, int durationMinutes, int lateEntryMinutes, int questionCount, int totalMarks,
                                List<String> subjects, boolean registrationOpen, Instant registrationClosesAt,
                                Instant nextSlotAt, Long myRegistrationId) {}

    public record PublicExamDetailDto(PublicExamDto exam, String instructions, int violationTolerance,
                                      List<PublicSlotDto> slots) {}

    public record ExamBrief(Long id, String code, String title, ExamCategory category, ExamMode mode, int durationMinutes,
                            int lateEntryMinutes, int questionCount, int totalMarks, int violationTolerance,
                            String instructions) {}

    public record SlotBrief(Long id, Instant startsAt, String label) {}

    public record AttemptBrief(Long id, AttemptStatus status, Instant startedAt, Instant endsAt, Instant finishedAt,
                               Integer score, Integer maxScore, Integer correctCount, Integer incorrectCount,
                               Integer unansweredCount, String terminationReason, boolean resultsVisible) {}

    public record RegistrationDto(Long id, String hallTicketNo, RegistrationStatus status, Instant createdAt,
                                  ExamBrief exam, SlotBrief slot, String candidateName, String candidateEmail,
                                  Long candidateId, Instant entryOpensAt, Instant entryClosesAt, AttemptBrief attempt) {}

    /** slotId is required for proctored exams and ignored for open ones. */
    public record SlotChoice(Long slotId) {}
}
