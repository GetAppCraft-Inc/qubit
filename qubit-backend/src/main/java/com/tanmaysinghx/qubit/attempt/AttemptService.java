package com.tanmaysinghx.qubit.attempt;

import com.tanmaysinghx.qubit.attempt.AttemptDtos.*;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.exam.*;
import com.tanmaysinghx.qubit.proctor.ProctorEvent;
import com.tanmaysinghx.qubit.proctor.ProctorEventRepository;
import com.tanmaysinghx.qubit.proctor.ProctorHub;
import com.tanmaysinghx.qubit.proctor.ViolationType;
import com.tanmaysinghx.qubit.registration.CandidateService;
import com.tanmaysinghx.qubit.registration.Registration;
import com.tanmaysinghx.qubit.registration.RegistrationRepository;
import com.tanmaysinghx.qubit.registration.RegistrationStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttemptService {

    /** Violations reported within this window of a counted one are logged but not counted again (alt-tab fires several events). */
    private static final long DEBOUNCE_MS = 3000;
    /** Answers saved this long after the deadline are still accepted (network latency). */
    private static final long SAVE_GRACE_SECONDS = 10;

    private final AttemptRepository attempts;
    private final AnswerRepository answers;
    private final RegistrationRepository registrations;
    private final QuestionRepository questions;
    private final ProctorEventRepository events;
    private final ProctorHub hub;
    private final WebhookService webhooks;
    private final com.tanmaysinghx.qubit.exam.QuestionImages images;
    private final com.tanmaysinghx.qubit.integrity.CaseRecorder caseRecorder;

    // ------------------------------------------------------------------ start / resume

    @Transactional
    public PaperDto start(Long registrationId, Long userId, String clientSessionId, String ip, String userAgent) {
        // Row lock: two tabs pressing "Begin" at once can't create two attempts.
        Registration r = registrations.lockById(registrationId)
                .filter(x -> x.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Registration not found"));
        Exam exam = r.getExam();
        Instant now = Instant.now();

        Optional<Attempt> existing = attempts.findByRegistrationId(r.getId());
        if (existing.isPresent()) {
            Attempt a = attempts.lockById(existing.get().getId()).orElseThrow();
            if (a.getStatus().isFinished()) {
                throw new ApiException(HttpStatus.CONFLICT, "ALREADY_ATTEMPTED",
                        "You have already taken this exam. Only one attempt is allowed.");
            }
            if (now.isAfter(a.getEndsAt())) {
                finish(a, AttemptStatus.AUTO_SUBMITTED, null);
                return paper(a, now, false);
            }
            if (!clientSessionId.equals(a.getClientSessionId())) {
                a.setClientSessionId(clientSessionId);
                if (!exam.isOpenMode()) {
                    applyViolation(a, ViolationType.SESSION_CHANGED, "Exam was reopened (reload, new tab or another device)", now);
                }
            }
            return paper(a, now, true);
        }

        if (r.getStatus() == RegistrationStatus.CANCELLED) throw ApiException.badRequest("This registration was cancelled");
        boolean retake = r.getRetakeUntil() != null && now.isBefore(r.getRetakeUntil());
        if (exam.getStatus() != ExamStatus.PUBLISHED && !(retake && exam.getStatus() == ExamStatus.CLOSED)) {
            throw ApiException.badRequest("This exam is not open");
        }
        Instant opens = retake ? now.minusSeconds(1) : CandidateService.entryOpens(exam, r.getSlot());
        Instant closes = retake ? r.getRetakeUntil() : CandidateService.entryCloses(exam, r.getSlot());
        if (now.isBefore(opens)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOT_YET_OPEN",
                    exam.isOpenMode() ? "This assessment isn't open yet" : "Your slot hasn't started yet");
        }
        if (now.isAfter(closes)) {
            throw new ApiException(HttpStatus.CONFLICT, "ENTRY_CLOSED",
                    exam.isOpenMode() ? "This assessment has closed" : "The entry window for your slot has closed");
        }

        Attempt a = new Attempt();
        a.setRegistration(r);
        a.setStartedAt(now);
        a.setEndsAt(now.plusSeconds(exam.getDurationMinutes() * 60L));
        a.setClientSessionId(clientSessionId);
        a.setIpAddress(truncate(ip, 64));
        a.setUserAgent(truncate(userAgent, 300));
        a.setMaxScore(exam.totalMarks());
        try {
            attempts.saveAndFlush(a);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_ATTEMPTED", "This exam has already been started");
        }
        r.setStatus(RegistrationStatus.IN_PROGRESS);
        r.setRetakeUntil(null);
        hub.broadcast(attemptPayload("ATTEMPT_STARTED", a));
        return paper(a, now, false);
    }

    // ------------------------------------------------------------------ answers

    @Transactional
    public Instant saveAnswer(Long attemptId, Long userId, Long questionId, String response, boolean marked) {
        Attempt a = owned(attemptId, userId);
        Instant now = Instant.now();
        if (a.getStatus() != AttemptStatus.IN_PROGRESS) {
            throw new ApiException(HttpStatus.CONFLICT, "ATTEMPT_CLOSED", "This attempt is no longer active");
        }
        if (now.isAfter(a.getEndsAt().plusSeconds(SAVE_GRACE_SECONDS))) {
            throw new ApiException(HttpStatus.CONFLICT, "ATTEMPT_CLOSED", "Time is up");
        }
        Question q = questions.findById(questionId)
                .filter(x -> x.getExam().getId().equals(a.getRegistration().getExam().getId()))
                .orElseThrow(() -> ApiException.notFound("Question not found"));

        Answer ans = answers.findByAttemptIdAndQuestionId(attemptId, questionId).orElseGet(() -> {
            Answer x = new Answer();
            x.setAttempt(a);
            x.setQuestion(q);
            return x;
        });
        ans.setResponse(normalize(q, response));
        ans.setMarkedForReview(marked);
        ans.setUpdatedAt(now);
        answers.save(ans);
        return now;
    }

    // ------------------------------------------------------------------ submit / terminate

    @Transactional
    public SubmitResult submit(Long attemptId, Long userId) {
        owned(attemptId, userId);
        Attempt a = attempts.lockById(attemptId).orElseThrow();
        if (a.getStatus() == AttemptStatus.IN_PROGRESS) {
            boolean late = Instant.now().isAfter(a.getEndsAt());
            finish(a, late ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED, null);
        }
        return new SubmitResult(a.getStatus(), a.getTerminationReason());
    }

    @Transactional
    public void autoSubmitIfExpired(Long attemptId) {
        attempts.lockById(attemptId).ifPresent(a -> {
            if (a.getStatus() == AttemptStatus.IN_PROGRESS && Instant.now().isAfter(a.getEndsAt())) {
                finish(a, AttemptStatus.AUTO_SUBMITTED, null);
            }
        });
    }

    /** Records an integrity event. {@code userId} null = server/staff initiated (no ownership check). */
    @Transactional
    public ViolationOutcome recordViolation(Long attemptId, Long userId, ViolationType type, String detail) {
        Attempt a = attempts.lockById(attemptId).orElseThrow(() -> ApiException.notFound("Attempt not found"));
        if (userId != null && !a.getRegistration().getUser().getId().equals(userId)) {
            throw ApiException.notFound("Attempt not found");
        }
        int tolerance = a.getRegistration().getExam().getViolationTolerance();
        if (a.getStatus().isFinished()) {
            return new ViolationOutcome(false, a.getStatus() == AttemptStatus.TERMINATED, a.getViolationCount(),
                    tolerance, type.label(), a.getTerminationReason(), false);
        }
        // Open (low-stakes) assessments don't enforce integrity; only invigilators can end them.
        if (a.getRegistration().getExam().isOpenMode() && type != ViolationType.ADMIN_TERMINATED) {
            return new ViolationOutcome(false, false, a.getViolationCount(), tolerance, type.label(), null, false);
        }
        return applyViolation(a, type, detail, Instant.now());
    }

    // ------------------------------------------------------------------ socket lifecycle

    public enum SocketCheck { OK, NOT_FOUND, FINISHED, SUPERSEDED }

    public record SocketState(SocketCheck check, Instant endsAt, int violationCount, int tolerance) {}

    @Transactional(readOnly = true)
    public SocketState checkSocket(Long attemptId, Long userId, String sid) {
        Attempt a = attempts.findById(attemptId).orElse(null);
        if (a == null || !a.getRegistration().getUser().getId().equals(userId)) {
            return new SocketState(SocketCheck.NOT_FOUND, null, 0, 0);
        }
        int tol = a.getRegistration().getExam().getViolationTolerance();
        if (a.getStatus().isFinished()) return new SocketState(SocketCheck.FINISHED, a.getEndsAt(), a.getViolationCount(), tol);
        if (sid == null || !sid.equals(a.getClientSessionId())) {
            return new SocketState(SocketCheck.SUPERSEDED, a.getEndsAt(), a.getViolationCount(), tol);
        }
        return new SocketState(SocketCheck.OK, a.getEndsAt(), a.getViolationCount(), tol);
    }

    @Transactional
    public void onConnectionEvent(Long attemptId, ViolationType type) {
        attempts.findById(attemptId).ifPresent(a -> {
            if (a.getStatus() != AttemptStatus.IN_PROGRESS) return;
            ProctorEvent ev = new ProctorEvent();
            ev.setAttempt(a);
            ev.setType(type);
            ev.setCounted(false);
            events.save(ev);
            if (type == ViolationType.DISCONNECTED) hub.markDisconnected(attemptId);
            Map<String, Object> payload = attemptPayload("PRESENCE", a);
            payload.put("online", type == ViolationType.RECONNECTED);
            hub.broadcast(payload);
        });
    }

    // ------------------------------------------------------------------ internals

    private ViolationOutcome applyViolation(Attempt a, ViolationType type, String detail, Instant now) {
        int tolerance = a.getRegistration().getExam().getViolationTolerance();
        boolean withinDebounce = a.getLastViolationAt() != null
                && Duration.between(a.getLastViolationAt(), now).toMillis() < DEBOUNCE_MS;
        boolean counted = type.counts() && (type == ViolationType.ADMIN_TERMINATED || !withinDebounce);

        ProctorEvent ev = new ProctorEvent();
        ev.setAttempt(a);
        ev.setType(type);
        ev.setCounted(counted);
        ev.setDetail(truncate(detail, 255));
        ev.setCreatedAt(now);
        events.save(ev);

        if (counted) {
            a.setViolationCount(a.getViolationCount() + 1);
            a.setLastViolationAt(now);
        }

        Map<String, Object> payload = attemptPayload("VIOLATION", a);
        payload.put("violation", type.name());
        payload.put("label", type.label());
        payload.put("counted", counted);
        payload.put("detail", detail);
        hub.broadcast(payload);

        if (type == ViolationType.ADMIN_TERMINATED) {
            String reason = detail != null && !detail.isBlank()
                    ? "Cancelled by invigilator: " + detail
                    : "Cancelled by invigilator";
            finish(a, AttemptStatus.TERMINATED, reason);
            return new ViolationOutcome(counted, true, a.getViolationCount(), tolerance, type.label(), reason, false);
        }

        if (!(counted && a.getViolationCount() > tolerance)) {
            return new ViolationOutcome(counted, false, a.getViolationCount(), tolerance, type.label(), null, false);
        }

        String reason = "Cheating detected — " + type.label().toLowerCase(Locale.ROOT);
        if (a.getRegistration().getExam().effectiveIntegrityAction() == IntegrityAction.TERMINATE) {
            finish(a, AttemptStatus.TERMINATED, reason);
            caseRecorder.autoTerminated(a, reason);
            return new ViolationOutcome(true, true, a.getViolationCount(), tolerance, type.label(), reason, false);
        }
        // REVIEW: the candidate keeps writing; an invigilator decides whether to cancel.
        caseRecorder.flag(a, type.label() + (detail == null || detail.isBlank() ? "" : " — " + detail));
        return new ViolationOutcome(true, false, a.getViolationCount(), tolerance, type.label(), null, true);
    }

    /**
     * Invigilator cancels an attempt. Works while it is running (ends it now) and after it was
     * submitted (the result is withdrawn). Returns false if it was already terminated.
     */
    @Transactional
    public boolean cancel(Long attemptId, String reason) {
        Attempt a = attempts.lockById(attemptId).orElseThrow(() -> ApiException.notFound("Attempt not found"));
        if (a.getStatus() == AttemptStatus.TERMINATED) return false;
        String why = reason == null || reason.isBlank() ? "Cancelled by invigilator" : "Cancelled by invigilator: " + reason.trim();
        why = truncate(why, 255);
        if (a.getStatus() == AttemptStatus.IN_PROGRESS) {
            ProctorEvent ev = new ProctorEvent();
            ev.setAttempt(a);
            ev.setType(ViolationType.ADMIN_TERMINATED);
            ev.setCounted(false);
            ev.setDetail(truncate(reason, 255));
            events.save(ev);
            finish(a, AttemptStatus.TERMINATED, why);
        } else {
            a.setStatus(AttemptStatus.TERMINATED);
            a.setTerminationReason(why);
            a.getRegistration().setStatus(RegistrationStatus.TERMINATED);
            Map<String, Object> payload = attemptPayload("ATTEMPT_ENDED", a);
            payload.put("status", AttemptStatus.TERMINATED.name());
            payload.put("reason", why);
            hub.broadcast(payload);
            webhooks.attemptFinished(a);
            log.info("Finished attempt {} withdrawn: {}", a.getId(), why);
        }
        return true;
    }

    private void finish(Attempt a, AttemptStatus status, String reason) {
        Instant now = Instant.now();
        Exam exam = a.getRegistration().getExam();
        score(a, exam);
        a.setStatus(status);
        a.setTerminationReason(reason);
        a.setFinishedAt(now.isAfter(a.getEndsAt()) ? a.getEndsAt() : now);
        a.getRegistration().setStatus(status == AttemptStatus.TERMINATED ? RegistrationStatus.TERMINATED : RegistrationStatus.SUBMITTED);

        Map<String, Object> toCandidate = new LinkedHashMap<>();
        toCandidate.put("type", "ENDED");
        toCandidate.put("status", status.name());
        if (reason != null) toCandidate.put("reason", reason);
        hub.endAttemptSession(a.getId(), toCandidate);

        Map<String, Object> payload = attemptPayload("ATTEMPT_ENDED", a);
        payload.put("status", status.name());
        payload.put("reason", reason);
        hub.broadcast(payload);
        webhooks.attemptFinished(a);
        log.info("Attempt {} finished with {}{}", a.getId(), status, reason == null ? "" : " (" + reason + ")");
    }

    private void score(Attempt a, Exam exam) {
        Map<Long, Answer> byQuestion = answers.findByAttemptId(a.getId()).stream()
                .collect(Collectors.toMap(x -> x.getQuestion().getId(), Function.identity(), (x, y) -> x));
        int score = 0, correct = 0, incorrect = 0, unanswered = 0, max = 0;
        for (Question q : exam.getQuestions()) {
            max += q.getMarks();
            Answer ans = byQuestion.get(q.getId());
            Marking.Result m = Marking.mark(q, ans == null ? null : ans.getResponse());
            score += m.awarded();
            switch (m.outcome()) {
                case UNANSWERED -> unanswered++;
                case CORRECT, PARTIAL -> correct++;   // partial = no wrong option chosen
                case INCORRECT -> incorrect++;
            }
        }
        a.setScore(score);
        a.setMaxScore(max);
        a.setCorrectCount(correct);
        a.setIncorrectCount(incorrect);
        a.setUnansweredCount(unanswered);
    }

    public static boolean isCorrect(Question q, String resp) {
        return Marking.mark(q, resp).outcome() == Marking.Outcome.CORRECT;
    }

    private static String normalize(Question q, String response) {
        if (response == null || response.isBlank()) return null;
        String r = response.trim();
        switch (q.getType()) {
            case SINGLE -> {
                int i = parseOption(r, q.getOptions().size());
                return String.valueOf(i);
            }
            case MULTIPLE -> {
                TreeSet<Integer> set = new TreeSet<>();
                for (String p : r.split(",")) if (!p.isBlank()) set.add(parseOption(p.trim(), q.getOptions().size()));
                return set.isEmpty() ? null : set.stream().map(String::valueOf).collect(Collectors.joining(","));
            }
            case NUMERIC -> {
                if (r.length() > 30) throw ApiException.badRequest("Answer is too long");
                try {
                    new BigDecimal(r);
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("Enter a numeric value");
                }
                return r;
            }
        }
        return null;
    }

    private static int parseOption(String s, int size) {
        try {
            int i = Integer.parseInt(s);
            if (i >= 0 && i < size) return i;
        } catch (NumberFormatException ignored) {
            // fall through
        }
        throw ApiException.badRequest("Invalid option");
    }

    private Attempt owned(Long attemptId, Long userId) {
        Attempt a = attempts.findById(attemptId).orElseThrow(() -> ApiException.notFound("Attempt not found"));
        if (!a.getRegistration().getUser().getId().equals(userId)) throw ApiException.notFound("Attempt not found");
        return a;
    }

    private PaperDto paper(Attempt a, Instant now, boolean includeAnswers) {
        Registration r = a.getRegistration();
        Exam exam = r.getExam();
        boolean live = a.getStatus() == AttemptStatus.IN_PROGRESS;
        List<PaperQuestion> qs = new ArrayList<>();
        if (live) {
            int idx = 1;
            for (Question q : exam.getQuestions()) {
                qs.add(new PaperQuestion(q.getId(), idx++, q.getSubject(), q.getSection(), q.getType(), q.getText(),
                        List.copyOf(q.getOptions()), images.url(q, a.getEndsAt().plusSeconds(600)), q.getMarks(),
                        q.getNegativeMarks(), q.isPartialMarking()));
            }
        }
        List<AnswerDto> ans = live && includeAnswers
                ? answers.findByAttemptId(a.getId()).stream()
                    .map(x -> new AnswerDto(x.getQuestion().getId(), x.getResponse(), x.isMarkedForReview())).toList()
                : List.of();
        return new PaperDto(a.getId(), r.getId(), exam.effectiveMode(), a.getStatus(), a.getTerminationReason(), r.getHallTicketNo(),
                r.getUser().getFullName(), exam.getTitle(), exam.getCode(), exam.getDurationMinutes(),
                exam.getViolationTolerance(), exam.totalMarks(), a.getViolationCount(), a.getStartedAt(), a.getEndsAt(),
                now, qs, ans);
    }

    private Map<String, Object> attemptPayload(String type, Attempt a) {
        Registration r = a.getRegistration();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("attemptId", a.getId());
        m.put("examId", r.getExam().getId());
        m.put("examTitle", r.getExam().getTitle());
        m.put("candidateName", r.getUser().getFullName());
        m.put("candidateEmail", r.getUser().getEmail());
        m.put("hallTicketNo", r.getHallTicketNo());
        m.put("violationCount", a.getViolationCount());
        m.put("tolerance", r.getExam().getViolationTolerance());
        m.put("startedAt", a.getStartedAt().toString());
        m.put("endsAt", a.getEndsAt().toString());
        m.put("at", Instant.now().toString());
        return m;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
