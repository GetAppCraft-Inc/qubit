package com.tanmaysinghx.qubit.integrity;

import com.tanmaysinghx.qubit.attempt.Attempt;
import com.tanmaysinghx.qubit.proctor.ProctorHub;
import com.tanmaysinghx.qubit.registration.Registration;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** Opens/updates integrity cases and pushes them to every connected invigilator. */
@Component
@RequiredArgsConstructor
public class CaseRecorder {

    private final IntegrityCaseRepository cases;
    private final ProctorHub hub;

    /** REVIEW mode: flag the attempt (or update its open case) and alert invigilators. */
    public void flag(Attempt a, String reason) {
        IntegrityCase c = cases.findFirstByAttemptIdAndStatus(a.getId(), IntegrityCase.Status.OPEN).orElse(null);
        boolean isNew = c == null;
        if (isNew) {
            c = new IntegrityCase();
            c.setAttempt(a);
        }
        c.setReason(trim(reason));
        c.setViolationCount(a.getViolationCount());
        c.setUpdatedAt(Instant.now());
        cases.save(c);
        afterCommit(payload(isNew ? "CASE_OPENED" : "CASE_UPDATED", c));
    }

    /** TERMINATE mode: record the automatic termination so invigilators are told and can review appeals. */
    public void autoTerminated(Attempt a, String reason) {
        IntegrityCase c = cases.findFirstByAttemptIdAndStatus(a.getId(), IntegrityCase.Status.OPEN).orElseGet(IntegrityCase::new);
        c.setAttempt(a);
        c.setStatus(IntegrityCase.Status.AUTO_TERMINATED);
        c.setReason(trim(reason));
        c.setViolationCount(a.getViolationCount());
        c.setDecidedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        cases.save(c);
        afterCommit(payload("CASE_OPENED", c));
    }

    /** Broadcast once the transaction commits, so staff who react to the alert read committed data. */
    void afterCommit(Map<String, Object> payload) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { hub.broadcast(payload); }
            });
        } else {
            hub.broadcast(payload);
        }
    }

    Map<String, Object> payload(String type, IntegrityCase c) {
        Attempt a = c.getAttempt();
        Registration r = a.getRegistration();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("caseId", c.getId());
        m.put("caseStatus", c.getStatus().name());
        m.put("attemptId", a.getId());
        m.put("attemptStatus", a.getStatus().name());
        m.put("examId", r.getExam().getId());
        m.put("examTitle", r.getExam().getTitle());
        m.put("candidateName", r.getUser().getFullName());
        m.put("candidateEmail", r.getUser().getEmail());
        m.put("hallTicketNo", r.getHallTicketNo());
        m.put("reason", c.getReason());
        m.put("violationCount", c.getViolationCount());
        m.put("tolerance", r.getExam().getViolationTolerance());
        m.put("at", Instant.now().toString());
        return m;
    }

    private static String trim(String s) {
        if (s == null) return "Integrity violation";
        return s.length() > 250 ? s.substring(0, 250) : s;
    }
}
