package com.tanmaysinghx.qubit.registration;

import com.tanmaysinghx.qubit.attempt.Attempt;
import com.tanmaysinghx.qubit.attempt.AttemptRepository;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.exam.*;
import com.tanmaysinghx.qubit.mail.MailService;
import com.tanmaysinghx.qubit.registration.CandidateDtos.*;
import com.tanmaysinghx.qubit.security.CurrentUser;
import com.tanmaysinghx.qubit.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CandidateService {

    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ExamRepository exams;
    private final ExamSlotRepository slots;
    private final RegistrationRepository registrations;
    private final AttemptRepository attempts;
    private final CurrentUser currentUser;
    private final MailService mail;

    @Transactional(readOnly = true)
    public List<PublicExamDto> listExams() {
        Long userId = currentUser.id();
        Map<Long, Long> mine = new HashMap<>();
        registrations.findForUser(userId).forEach(r -> mine.put(r.getExam().getId(), r.getId()));
        Instant now = Instant.now();
        return exams.findByStatusOrderByCreatedAtDesc(ExamStatus.PUBLISHED).stream()
                .filter(e -> mine.containsKey(e.getId())
                        || (e.isOpenMode() ? e.isRegistrationOpen(now) : e.getSlots().stream().anyMatch(s -> s.getStartsAt().isAfter(now))))
                .map(e -> publicDto(e, mine.get(e.getId()), now))
                .toList();
    }

    @Transactional(readOnly = true)
    public PublicExamDetailDto examDetail(Long examId) {
        Exam exam = exams.findById(examId)
                .filter(e -> e.getStatus() == ExamStatus.PUBLISHED)
                .orElseThrow(() -> ApiException.notFound("Exam not found"));
        Long regId = registrations.findByUserIdAndExamId(currentUser.id(), examId).map(Registration::getId).orElse(null);
        Instant now = Instant.now();
        List<PublicSlotDto> slotDtos = exam.isOpenMode() ? List.of() : exam.getSlots().stream()
                .filter(s -> s.getStartsAt().isAfter(now))
                .sorted(Comparator.comparing(ExamSlot::getStartsAt))
                .map(s -> new PublicSlotDto(s.getId(), s.getStartsAt(), s.getLabel(), seatsLeft(s)))
                .toList();
        return new PublicExamDetailDto(publicDto(exam, regId, now), exam.getInstructions(), exam.getViolationTolerance(), slotDtos);
    }

    @Transactional
    public RegistrationDto register(Long examId, Long slotId) {
        User user = currentUser.get();
        Exam exam = exams.findById(examId).orElseThrow(() -> ApiException.notFound("Exam not found"));
        Instant now = Instant.now();
        if (!exam.isRegistrationOpen(now)) throw ApiException.badRequest("Registration for this exam is closed");
        if (registrations.findByUserIdAndExamId(user.getId(), examId).isPresent()) {
            throw ApiException.conflict("You're already registered for this exam");
        }
        ExamSlot slot;
        if (exam.isOpenMode()) {
            slot = ExamAdminService.ensureOpenWindowSlot(exam);
            if (slot.getId() == null) exams.flush();
        } else {
            if (slotId == null) throw ApiException.badRequest("Choose a slot");
            slot = lockBookableSlot(exam, slotId, now);
        }

        Registration r = new Registration();
        r.setUser(user);
        r.setExam(exam);
        r.setSlot(slot);
        r.setHallTicketNo(newHallTicketNo(exam));
        registrations.save(r);
        if (!exam.isOpenMode()) mail.sendHallTicket(user.getEmail(), user.getFullName(), exam.getTitle(), r.getHallTicketNo(), slot.getStartsAt());
        return toDto(r);
    }

    @Transactional
    public RegistrationDto reschedule(Long registrationId, Long slotId) {
        Registration r = own(registrationId);
        Instant now = Instant.now();
        if (r.getExam().isOpenMode()) throw ApiException.badRequest("Open assessments don't have slots");
        if (slotId == null) throw ApiException.badRequest("Choose a slot");
        if (r.getStatus() != RegistrationStatus.REGISTERED || attempts.findByRegistrationId(r.getId()).isPresent()) {
            throw ApiException.conflict("This registration can no longer be rescheduled");
        }
        if (!r.getSlot().getStartsAt().isAfter(now)) {
            throw ApiException.conflict("Your current slot has already begun");
        }
        if (Objects.equals(r.getSlot().getId(), slotId)) return toDto(r);
        r.setSlot(lockBookableSlot(r.getExam(), slotId, now));
        return toDto(r);
    }

    @Transactional(readOnly = true)
    public List<RegistrationDto> myRegistrations() {
        return registrations.findForUser(currentUser.id()).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public RegistrationDto myRegistration(Long id) {
        return toDto(own(id));
    }

    // ---- helpers ----

    Registration own(Long registrationId) {
        Registration r = registrations.findById(registrationId).orElseThrow(() -> ApiException.notFound("Registration not found"));
        if (!r.getUser().getId().equals(currentUser.id())) throw ApiException.notFound("Registration not found");
        return r;
    }

    private ExamSlot lockBookableSlot(Exam exam, Long slotId, Instant now) {
        ExamSlot slot = slots.lockById(slotId).orElseThrow(() -> ApiException.notFound("Slot not found"));
        if (!slot.getExam().getId().equals(exam.getId())) throw ApiException.badRequest("Slot does not belong to this exam");
        if (!slot.getStartsAt().isAfter(now)) throw ApiException.badRequest("This slot has already started");
        if (seatsLeft(slot) <= 0) throw ApiException.conflict("This slot is full. Please pick another one.");
        return slot;
    }

    private long seatsLeft(ExamSlot s) {
        return Math.max(0, s.getCapacity() - registrations.countBySlotIdAndStatusNot(s.getId(), RegistrationStatus.CANCELLED));
    }

    private String newHallTicketNo(Exam exam) {
        String prefix = "QB" + String.format("%02d", Instant.now().atZone(ZoneOffset.UTC).getYear() % 100) + exam.getCategory().shortCode();
        for (int i = 0; i < 10; i++) {
            StringBuilder sb = new StringBuilder(prefix);
            for (int j = 0; j < 8; j++) sb.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
            String candidate = sb.toString();
            if (!registrations.existsByHallTicketNo(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not allocate a hall ticket number");
    }

    private PublicExamDto publicDto(Exam e, Long myRegistrationId, Instant now) {
        boolean open = e.isOpenMode();
        Instant next = open ? null : e.getSlots().stream().map(ExamSlot::getStartsAt).filter(t -> t.isAfter(now))
                .min(Comparator.naturalOrder()).orElse(null);
        List<String> subjects = e.getQuestions().stream().map(Question::getSubject).distinct().toList();
        return new PublicExamDto(e.getId(), e.getCode(), e.getTitle(), e.getDescription(), e.getCategory(), e.effectiveMode(),
                e.getDurationMinutes(), e.getLateEntryMinutes(), e.getQuestions().size(), e.totalMarks(), subjects,
                e.isRegistrationOpen(now) && (open || next != null), e.getRegistrationClosesAt(), next, myRegistrationId);
    }

    public RegistrationDto toDto(Registration r) {
        Exam e = r.getExam();
        ExamSlot s = r.getSlot();
        User u = r.getUser();
        Attempt a = attempts.findByRegistrationId(r.getId()).orElse(null);
        AttemptBrief brief = null;
        if (a != null) {
            boolean visible = e.isShowResults() && a.getStatus().isFinished();
            brief = new AttemptBrief(a.getId(), a.getStatus(), a.getStartedAt(), a.getEndsAt(), a.getFinishedAt(),
                    visible ? a.getScore() : null, visible ? a.getMaxScore() : null,
                    visible ? a.getCorrectCount() : null, visible ? a.getIncorrectCount() : null,
                    visible ? a.getUnansweredCount() : null, a.getTerminationReason(), visible);
        }
        return new RegistrationDto(r.getId(), r.getHallTicketNo(), r.getStatus(), r.getCreatedAt(),
                new ExamBrief(e.getId(), e.getCode(), e.getTitle(), e.getCategory(), e.effectiveMode(), e.getDurationMinutes(),
                        e.getLateEntryMinutes(), e.getQuestions().size(), e.totalMarks(), e.getViolationTolerance(),
                        e.getInstructions()),
                new SlotBrief(s.getId(), s.getStartsAt(), s.getLabel()),
                u.getFullName(), u.getEmail(), u.getId(),
                entryOpens(e, s), entryCloses(e, s), brief);
    }

    public static Instant entryOpens(Exam e, ExamSlot s) {
        return e.isOpenMode() ? e.windowOpensAt() : s.getStartsAt();
    }

    public static Instant entryCloses(Exam e, ExamSlot s) {
        return e.isOpenMode() ? e.windowClosesAt() : s.getStartsAt().plusSeconds(e.getLateEntryMinutes() * 60L);
    }
}
