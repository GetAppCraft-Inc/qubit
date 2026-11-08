package com.tanmaysinghx.qubit.proctor;

import com.tanmaysinghx.qubit.attempt.AttemptDtos.ViolationOutcome;
import com.tanmaysinghx.qubit.attempt.AttemptService;
import com.tanmaysinghx.qubit.attempt.AttemptService.SocketState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Candidate channel: {@code /ws/exam?token=..&attemptId=..&sid=..}
 * <p>Client → server: {@code {"type":"PING"}}, {@code {"type":"VIOLATION","kind":"TAB_HIDDEN","detail":"..."}}
 * <br>Server → client: HELLO, PONG, WARNING, ENDED, REJECTED.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExamSocketHandler extends TextWebSocketHandler {

    record ClientMessage(String type, String kind, String detail) {}

    private final AttemptService attempts;
    private final ProctorHub hub;
    private final ObjectMapper mapper;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        Long userId = (Long) session.getAttributes().get("userId");
        Long attemptId = (Long) session.getAttributes().get("attemptId");
        String sid = (String) session.getAttributes().get("sid");
        if (attemptId == null) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }
        SocketState state = attempts.checkSocket(attemptId, userId, sid);
        switch (state.check()) {
            case OK -> {
                boolean wasDisconnected = hub.disconnectedSnapshot().containsKey(attemptId);
                hub.registerCandidate(attemptId, session);
                if (wasDisconnected) attempts.onConnectionEvent(attemptId, ViolationType.RECONNECTED);
                Map<String, Object> hello = new LinkedHashMap<>();
                hello.put("type", "HELLO");
                hello.put("serverNow", Instant.now().toString());
                hello.put("endsAt", state.endsAt().toString());
                hello.put("violationCount", state.violationCount());
                hello.put("tolerance", state.tolerance());
                hub.sendToAttempt(attemptId, hello);
            }
            case SUPERSEDED -> reject(session, "SUPERSEDED", "This exam was opened in another window. This window is no longer active.");
            case FINISHED -> reject(session, "FINISHED", "This attempt has ended.");
            case NOT_FOUND -> reject(session, "NOT_FOUND", "Attempt not found.");
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Long userId = (Long) session.getAttributes().get("userId");
        Long attemptId = (Long) session.getAttributes().get("attemptId");
        ClientMessage msg;
        try {
            msg = mapper.readValue(message.getPayload(), ClientMessage.class);
        } catch (Exception e) {
            return;
        }
        if (msg == null || msg.type() == null) return;
        switch (msg.type()) {
            case "PING" -> {
                Map<String, Object> pong = new LinkedHashMap<>();
                pong.put("type", "PONG");
                pong.put("serverNow", Instant.now().toString());
                hub.send(session, pong);
            }
            case "VIOLATION" -> {
                ViolationType type;
                try {
                    type = ViolationType.valueOf(msg.kind());
                } catch (Exception e) {
                    return;
                }
                if (!ViolationType.CLIENT_REPORTABLE.contains(type)) return;
                ViolationOutcome outcome = attempts.recordViolation(attemptId, userId, type, msg.detail());
                if (!outcome.terminated()) {
                    Map<String, Object> warn = new LinkedHashMap<>();
                    warn.put("type", "WARNING");
                    warn.put("label", outcome.label());
                    warn.put("counted", outcome.counted());
                    warn.put("violationCount", outcome.violationCount());
                    warn.put("tolerance", outcome.tolerance());
                    warn.put("flagged", outcome.flagged());
                    hub.send(session, warn);
                }
            }
            default -> { /* ignore */ }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long attemptId = (Long) session.getAttributes().get("attemptId");
        if (attemptId != null && hub.unregisterCandidate(attemptId, session)) {
            attempts.onConnectionEvent(attemptId, ViolationType.DISCONNECTED);
        }
    }

    private void reject(WebSocketSession session, String code, String message) throws Exception {
        hub.send(session, Map.of("type", "REJECTED", "code", code, "message", message));
        session.close(CloseStatus.POLICY_VIOLATION);
    }
}
