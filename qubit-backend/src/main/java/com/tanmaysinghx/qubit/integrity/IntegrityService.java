package com.tanmaysinghx.qubit.integrity;

import com.tanmaysinghx.qubit.attempt.Attempt;
import com.tanmaysinghx.qubit.attempt.AttemptRepository;
import com.tanmaysinghx.qubit.attempt.AttemptService;
import com.tanmaysinghx.qubit.attempt.AttemptStatus;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.mail.MailService;
import com.tanmaysinghx.qubit.proctor.ProctorHub;
import com.tanmaysinghx.qubit.registration.Registration;
import com.tanmaysinghx.qubit.registration.RegistrationRepository;
import com.tanmaysinghx.qubit.registration.RegistrationStatus;
import com.tanmaysinghx.qubit.security.CurrentUser;
import com.tanmaysinghx.qubit.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class IntegrityService {

    private static final int DEFAULT_RETAKE_HOURS = 48;

    private final IntegrityCaseRepository cases;
    private final AppealRepository appeals;
    private final AttemptRepository attempts;
    private final RegistrationRepository registrations;
    private final AttemptService attemptService;
    private final CaseRecorder recorder;
    private final ProctorHub hub;
    private final MailService mail;
    private final CurrentUser currentUser;

    // ------------------------------------------------------------------ DTOs

    public record CaseRow(Long id, String status, String reason, int violationCount, int tolerance,
                          Instant openedAt, Instant updatedAt, Instant decidedAt, String decidedBy, String decisionNote,
                          Long attemptId, String attemptStatus, boolean online, Long examId, String examTitle,
                          String examCode, String candidateName, String candidateEmail, String hallTicketNo) {}

    public record AppealRow(Long id, String status, String message, Instant createdAt, Instant decidedAt,
                            String decidedBy, String decisionNote, Instant retakeUntil,
                            Long attemptId, Long registrationId, String terminationReason, int violationCount,
                            Instant attemptStartedAt, Instant attemptFinishedAt, Long examId, String examTitle,
                            String examCode, String candidateName, String candidateEmail, String hallTicketNo) {}

    public record Summary(long openCases, long pendingAppeals) {}

    public record DecisionRequest(String note) {}

    public record ApproveRequest(String note, Integer hours) {}

    public record AppealRequest(String message) {}

    // ------------------------------------------------------------------ staff: cases

    @Transactional(readOnly = true)
    public List<CaseRow> cases(String status) {
        List<IntegrityCase> list = status == null || status.isBlank() || status.equalsIgnoreCase("ALL")
                ? cases.findRecent()
                : cases.findByStatusDetailed(parse(status));
        return list.stream().map(this::row).toList();
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        return new Summary(cases.countByStatus(IntegrityCase.Status.OPEN), appeals.countByStatus(Appeal.Status.PENDING));
    }

    /** Invigilator: "Cancel attempt". */
    @Transactional
    public CaseRow cancelCase(Long caseId, String note) {
        IntegrityCase c = cases.findById(caseId).orElseThrow(() -> ApiException.notFound("Case not found"));
        if (c.getStatus() != IntegrityCase.Status.OPEN) {
            throw new ApiException(HttpStatus.CONFLICT, "CASE_DECIDED", "This case has already been decided");
        }
        String reason = note == null || note.isBlank() ? c.getReason() : note.trim();
        attemptService.cancel(c.getAttempt().getId(), reason);
        decide(c, IntegrityCase.Status.CANCELLED, note);
        notifyCancelled(c.getAttempt());
        return row(c);
    }

    /** Invigilator: "Let them continue". */
    @Transactional
    public CaseRow dismissCase(Long caseId, String note) {
        IntegrityCase c = cases.findById(caseId).orElseThrow(() -> ApiException.notFound("Case not found"));
        if (c.getStatus() != IntegrityCase.Status.OPEN) {
            throw new ApiException(HttpStatus.CONFLICT, "CASE_DECIDED", "This case has already been decided");
        }
        decide(c, IntegrityCase.Status.DISMISSED, note);
        Attempt a = c.getAttempt();
        if (a.getStatus() == AttemptStatus.IN_PROGRESS) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("type", "REVIEW_CLEARED");
            m.put("message", "An invigilator reviewed the flag on your attempt. You may continue.");
            hub.sendToAttempt(a.getId(), m);
        }
        return row(c);
    }

    /** Live monitor "End attempt" button: cancel directly, closing any open case. */
    @Transactional
    public void cancelAttempt(Long attemptId, String note) {
        Attempt a = attempts.findById(attemptId).orElseThrow(() -> ApiException.notFound("Attempt not found"));
        IntegrityCase c = cases.findFirstByAttemptIdAndStatus(attemptId, IntegrityCase.Status.OPEN).orElse(null);
        String reason = note == null || note.isBlank() ? (c == null ? null : c.getReason()) : note.trim();
        if (!attemptService.cancel(attemptId, reason)) return;
        if (c == null) {
            c = new IntegrityCase();
            c.setAttempt(a);
            c.setReason(reason == null ? "Cancelled by invigilator" : truncate(reason, 250));
            c.setViolationCount(a.getViolationCount());
        }
        decide(c, IntegrityCase.Status.CANCELLED, note);
        notifyCancelled(a);
    }

    // ------------------------------------------------------------------ staff: appeals

    @Transactional(readOnly = true)
    public List<AppealRow> appeals() {
        return appeals.findAllDetailed().stream().map(this::row).toList();
    }

    @Transactional
    public AppealRow approve(Long appealId, String note, Integer hours) {
        Appeal ap = pending(appealId);
        int h = hours == null ? DEFAULT_RETAKE_HOURS : hours;
        if (h < 1 || h > 24 * 14) throw ApiException.badRequest("Retake window must be between 1 hour and 14 days");
        Attempt a = attempts.lockById(ap.getAttempt().getId()).orElseThrow();
        Registration r = registrations.lockById(a.getRegistration().getId()).orElseThrow();
        Instant until = Instant.now().plus(Duration.ofHours(h));

        a.setVoided(true);
        r.setStatus(RegistrationStatus.REGISTERED);
        r.setRetakeUntil(until);
        ap.setStatus(Appeal.Status.APPROVED);
        ap.setRetakeUntil(until);
        closeAppeal(ap, note);
        mail.sendAppealDecision(r.getUser().getEmail(), r.getUser().getFullName(), r.getExam().getTitle(), true, ap.getDecisionNote(), until);
        log.info("Appeal {} approved: attempt {} voided, retake until {}", ap.getId(), a.getId(), until);
        return row(ap);
    }

    @Transactional
    public AppealRow reject(Long appealId, String note) {
        Appeal ap = pending(appealId);
        ap.setStatus(Appeal.Status.REJECTED);
        closeAppeal(ap, note);
        Registration r = ap.getAttempt().getRegistration();
        mail.sendAppealDecision(r.getUser().getEmail(), r.getUser().getFullName(), r.getExam().getTitle(), false, ap.getDecisionNote(), null);
        return row(ap);
    }

    // ------------------------------------------------------------------ candidate

    @Transactional
    public AppealRow submitAppeal(Long registrationId, String message) {
        User me = currentUser.get();
        Registration r = registrations.lockById(registrationId)
                .filter(x -> x.getUser().getId().equals(me.getId()))
                .orElseThrow(() -> ApiException.notFound("Registration not found"));
        Attempt a = attempts.findByRegistrationId(r.getId())
                .orElseThrow(() -> ApiException.badRequest("There is no attempt to appeal"));
        if (a.getStatus() != AttemptStatus.TERMINATED) {
            throw ApiException.badRequest("Only cancelled attempts can be appealed");
        }
        if (appeals.findByAttemptId(a.getId()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_APPEALED", "You have already appealed this attempt");
        }
        String msg = message == null ? "" : message.trim();
        if (msg.length() < 20) throw ApiException.badRequest("Please describe what happened (at least 20 characters)");
        if (msg.length() > 2000) throw ApiException.badRequest("Keep the appeal under 2000 characters");

        Appeal ap = new Appeal();
        ap.setAttempt(a);
        ap.setUser(me);
        ap.setMessage(msg);
        appeals.save(ap);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", "APPEAL_SUBMITTED");
        m.put("appealId", ap.getId());
        m.put("attemptId", a.getId());
        m.put("examTitle", r.getExam().getTitle());
        m.put("candidateName", me.getFullName());
        m.put("hallTicketNo", r.getHallTicketNo());
        m.put("at", Instant.now().toString());
        recorder.afterCommit(m);
        return row(ap);
    }

    // ------------------------------------------------------------------ internals

    private void decide(IntegrityCase c, IntegrityCase.Status status, String note) {
        c.setStatus(status);
        c.setDecidedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        c.setDecidedBy(currentUser.get());
        c.setDecisionNote(note == null || note.isBlank() ? null : truncate(note.trim(), 300));
        cases.save(c);
        recorder.afterCommit(recorder.payload("CASE_DECIDED", c));
    }

    private void notifyCancelled(Attempt a) {
        Registration r = a.getRegistration();
        mail.sendAttemptCancelled(r.getUser().getEmail(), r.getUser().getFullName(), r.getExam().getTitle(),
                a.getTerminationReason());
    }

    private Appeal pending(Long id) {
        Appeal ap = appeals.findById(id).orElseThrow(() -> ApiException.notFound("Appeal not found"));
        if (ap.getStatus() != Appeal.Status.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "APPEAL_DECIDED", "This appeal has already been decided");
        }
        return ap;
    }

    private void closeAppeal(Appeal ap, String note) {
        ap.setDecidedAt(Instant.now());
        ap.setDecidedBy(currentUser.get());
        ap.setDecisionNote(note == null || note.isBlank() ? null : truncate(note.trim(), 1000));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", "APPEAL_DECIDED");
        m.put("appealId", ap.getId());
        m.put("status", ap.getStatus().name());
        m.put("at", Instant.now().toString());
        recorder.afterCommit(m);
    }

    private CaseRow row(IntegrityCase c) {
        Attempt a = c.getAttempt();
        Registration r = a.getRegistration();
        return new CaseRow(c.getId(), c.getStatus().name(), c.getReason(), c.getViolationCount(),
                r.getExam().getViolationTolerance(), c.getOpenedAt(), c.getUpdatedAt(), c.getDecidedAt(),
                c.getDecidedBy() == null ? null : c.getDecidedBy().getFullName(), c.getDecisionNote(),
                a.getId(), a.getStatus().name(), hub.isOnline(a.getId()), r.getExam().getId(), r.getExam().getTitle(),
                r.getExam().getCode(), r.getUser().getFullName(), r.getUser().getEmail(), r.getHallTicketNo());
    }

    private AppealRow row(Appeal ap) {
        Attempt a = ap.getAttempt();
        Registration r = a.getRegistration();
        return new AppealRow(ap.getId(), ap.getStatus().name(), ap.getMessage(), ap.getCreatedAt(), ap.getDecidedAt(),
                ap.getDecidedBy() == null ? null : ap.getDecidedBy().getFullName(), ap.getDecisionNote(), ap.getRetakeUntil(),
                a.getId(), r.getId(), a.getTerminationReason(), a.getViolationCount(), a.getStartedAt(), a.getFinishedAt(),
                r.getExam().getId(), r.getExam().getTitle(), r.getExam().getCode(), r.getUser().getFullName(),
                r.getUser().getEmail(), r.getHallTicketNo());
    }

    private static IntegrityCase.Status parse(String s) {
        try {
            return IntegrityCase.Status.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Unknown status " + s);
        }
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
