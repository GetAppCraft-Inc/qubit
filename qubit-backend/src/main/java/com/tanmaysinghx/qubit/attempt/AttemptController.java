package com.tanmaysinghx.qubit.attempt;

import com.tanmaysinghx.qubit.attempt.AttemptDtos.*;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.proctor.ViolationType;
import com.tanmaysinghx.qubit.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AttemptController {

    private final AttemptService service;
    private final CurrentUser currentUser;

    @PostMapping("/registrations/{id}/attempt")
    public PaperDto start(@PathVariable Long id, @Valid @RequestBody StartRequest body, HttpServletRequest req) {
        String ip = req.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) ip = req.getRemoteAddr();
        return service.start(id, currentUser.get().getId(), body.clientSessionId(), ip, req.getHeader("User-Agent"));
    }

    @PutMapping("/attempts/{id}/answers/{questionId}")
    public Map<String, Instant> save(@PathVariable Long id, @PathVariable Long questionId, @Valid @RequestBody AnswerRequest body) {
        return Map.of("savedAt", service.saveAnswer(id, currentUser.id(), questionId, body.response(), body.markedForReview()));
    }

    @PostMapping("/attempts/{id}/submit")
    public SubmitResult submit(@PathVariable Long id) {
        return service.submit(id, currentUser.id());
    }

    /** REST fallback for integrity events when the WebSocket is unavailable. */
    @PostMapping("/attempts/{id}/events")
    public ViolationOutcome event(@PathVariable Long id, @Valid @RequestBody EventRequest body) {
        ViolationType type = parse(body.type());
        return service.recordViolation(id, currentUser.id(), type, body.detail());
    }

    static ViolationType parse(String raw) {
        try {
            ViolationType t = ViolationType.valueOf(raw);
            if (ViolationType.CLIENT_REPORTABLE.contains(t)) return t;
        } catch (IllegalArgumentException | NullPointerException ignored) {
            // fall through
        }
        throw ApiException.badRequest("Unknown event type");
    }
}
