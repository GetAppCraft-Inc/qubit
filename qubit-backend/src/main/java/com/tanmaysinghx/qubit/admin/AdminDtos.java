package com.tanmaysinghx.qubit.admin;

import com.tanmaysinghx.qubit.attempt.AttemptStatus;
import com.tanmaysinghx.qubit.proctor.ViolationType;
import com.tanmaysinghx.qubit.registration.RegistrationStatus;
import com.tanmaysinghx.qubit.user.Role;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class AdminDtos {
    private AdminDtos() {}

    public record Overview(long exams, long publishedExams, long candidates, long registrations,
                           long liveAttempts, long completedAttempts, long terminatedAttempts,
                           List<UpcomingSlot> upcoming) {}

    public record UpcomingSlot(Long examId, String examTitle, String examCode, Instant startsAt, long booked, int capacity) {}

    public record RegistrationRow(Long registrationId, String hallTicketNo, RegistrationStatus status,
                                  Long examId, String examTitle, Long candidateId, String candidateName,
                                  String candidateEmail, Instant slotStartsAt, Instant registeredAt,
                                  Long attemptId, AttemptStatus attemptStatus, Instant startedAt, Instant finishedAt,
                                  Integer score, Integer maxScore, Integer violationCount, String terminationReason) {}

    public record LiveAttemptRow(Long attemptId, Long examId, String examTitle, String candidateName, String candidateEmail,
                                 String hallTicketNo, Instant startedAt, Instant endsAt, int violationCount,
                                 int tolerance, boolean online, String ipAddress) {}

    public record EventRow(Long id, ViolationType type, String label, boolean counted, String detail, Instant at) {}

    public record TerminateRequest(@Size(max = 200) String reason) {}

    public record UserPatch(Role role, Boolean active) {}

    public record SystemInfo(String javaVersion, String springBootVersion, String serverTime, long uptimeSeconds,
                             boolean databaseUp, String databaseProduct, boolean mailEnabled,
                             int liveExamSockets, int monitorSockets, long heapUsedMb, long heapMaxMb,
                             int availableProcessors) {}
}
