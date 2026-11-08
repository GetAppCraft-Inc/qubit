package com.tanmaysinghx.qubit.admin;

import com.tanmaysinghx.qubit.admin.AdminDtos.*;
import com.tanmaysinghx.qubit.attempt.Attempt;
import com.tanmaysinghx.qubit.attempt.AttemptRepository;
import com.tanmaysinghx.qubit.attempt.AttemptStatus;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.exam.ExamRepository;
import com.tanmaysinghx.qubit.exam.ExamStatus;
import com.tanmaysinghx.qubit.proctor.ProctorEventRepository;
import com.tanmaysinghx.qubit.proctor.ProctorHub;
import com.tanmaysinghx.qubit.registration.Registration;
import com.tanmaysinghx.qubit.registration.RegistrationRepository;
import com.tanmaysinghx.qubit.registration.RegistrationStatus;
import com.tanmaysinghx.qubit.user.Role;
import com.tanmaysinghx.qubit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AdminQueryService {

    private final ExamRepository exams;
    private final UserRepository users;
    private final RegistrationRepository registrations;
    private final AttemptRepository attempts;
    private final ProctorEventRepository events;
    private final ProctorHub hub;

    @Transactional(readOnly = true)
    public Overview overview() {
        Instant now = Instant.now();
        List<UpcomingSlot> upcoming = exams.findByStatusOrderByCreatedAtDesc(ExamStatus.PUBLISHED).stream()
                .filter(e -> !e.isOpenMode())
                .flatMap(e -> e.getSlots().stream()
                        .filter(s -> s.getStartsAt().isAfter(now))
                        .map(s -> new UpcomingSlot(e.getId(), e.getTitle(), e.getCode(), s.getStartsAt(),
                                registrations.countBySlotIdAndStatusNot(s.getId(), RegistrationStatus.CANCELLED), s.getCapacity())))
                .sorted(Comparator.comparing(UpcomingSlot::startsAt))
                .limit(8)
                .toList();
        long completed = attempts.countByStatus(AttemptStatus.SUBMITTED) + attempts.countByStatus(AttemptStatus.AUTO_SUBMITTED);
        return new Overview(exams.count(), exams.countByStatus(ExamStatus.PUBLISHED), users.countByRole(Role.QUBIT_USER),
                registrations.countByStatusNot(RegistrationStatus.CANCELLED), attempts.countByStatus(AttemptStatus.IN_PROGRESS),
                completed, attempts.countByStatus(AttemptStatus.TERMINATED), upcoming);
    }

    @Transactional(readOnly = true)
    public List<RegistrationRow> registrations(Long examId) {
        if (!exams.existsById(examId)) throw ApiException.notFound("Exam not found");
        return registrations.findForExam(examId).stream().map(this::row).toList();
    }

    @Transactional(readOnly = true)
    public RegistrationRow hallTicket(String number) {
        return registrations.findByHallTicketNo(number.trim().toUpperCase(Locale.ROOT))
                .map(this::row)
                .orElseThrow(() -> ApiException.notFound("No registration with that hall ticket number"));
    }

    @Transactional(readOnly = true)
    public List<LiveAttemptRow> liveAttempts() {
        return attempts.findLive().stream().map(a -> {
            Registration r = a.getRegistration();
            return new LiveAttemptRow(a.getId(), r.getExam().getId(), r.getExam().getTitle(), r.getUser().getFullName(),
                    r.getUser().getEmail(), r.getHallTicketNo(), a.getStartedAt(), a.getEndsAt(), a.getViolationCount(),
                    r.getExam().getViolationTolerance(), hub.isOnline(a.getId()), a.getIpAddress());
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<EventRow> events(Long attemptId) {
        return events.findByAttemptIdOrderByCreatedAtAsc(attemptId).stream()
                .map(e -> new EventRow(e.getId(), e.getType(), e.getType().label(), e.isCounted(), e.getDetail(), e.getCreatedAt()))
                .toList();
    }

    private RegistrationRow row(Registration r) {
        Attempt a = attempts.findByRegistrationId(r.getId()).orElse(null);
        return new RegistrationRow(r.getId(), r.getHallTicketNo(), r.getStatus(), r.getExam().getId(), r.getExam().getTitle(),
                r.getUser().getId(), r.getUser().getFullName(), r.getUser().getEmail(), r.getSlot().getStartsAt(), r.getCreatedAt(),
                a == null ? null : a.getId(), a == null ? null : a.getStatus(), a == null ? null : a.getStartedAt(),
                a == null ? null : a.getFinishedAt(), a == null ? null : a.getScore(), a == null ? null : a.getMaxScore(),
                a == null ? null : a.getViolationCount(), a == null ? null : a.getTerminationReason());
    }
}
