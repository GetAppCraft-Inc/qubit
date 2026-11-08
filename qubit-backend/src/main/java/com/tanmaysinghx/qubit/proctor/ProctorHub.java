package com.tanmaysinghx.qubit.proctor;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory registry of live WebSocket sessions: one per running attempt, plus invigilator monitors. */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProctorHub {

    private final ObjectMapper mapper;

    private final Map<Long, WebSocketSession> candidates = new ConcurrentHashMap<>();
    private final Map<Long, Instant> disconnectedSince = new ConcurrentHashMap<>();
    private final Set<WebSocketSession> monitors = ConcurrentHashMap.newKeySet();

    // ---- candidates ----

    public void registerCandidate(Long attemptId, WebSocketSession raw) {
        WebSocketSession session = new ConcurrentWebSocketSessionDecorator(raw, 5000, 256 * 1024);
        WebSocketSession previous = candidates.put(attemptId, session);
        disconnectedSince.remove(attemptId);
        if (previous != null && !previous.getId().equals(raw.getId())) {
            closeQuietly(previous, CloseStatus.POLICY_VIOLATION.withReason("Superseded by a newer connection"));
        }
    }

    /** @return true when the given session was the active one for this attempt. */
    public boolean unregisterCandidate(Long attemptId, WebSocketSession raw) {
        WebSocketSession current = candidates.get(attemptId);
        if (current != null && current.getId().equals(raw.getId())) {
            candidates.remove(attemptId);
            return true;
        }
        return false;
    }

    public boolean isOnline(Long attemptId) {
        WebSocketSession s = candidates.get(attemptId);
        return s != null && s.isOpen();
    }

    public void markDisconnected(Long attemptId) {
        disconnectedSince.putIfAbsent(attemptId, Instant.now());
    }

    public Map<Long, Instant> disconnectedSnapshot() {
        return Map.copyOf(disconnectedSince);
    }

    public void clearDisconnected(Long attemptId) {
        disconnectedSince.remove(attemptId);
    }

    public void sendToAttempt(Long attemptId, Map<String, ?> payload) {
        WebSocketSession s = candidates.get(attemptId);
        if (s != null) send(s, payload);
    }

    public void endAttemptSession(Long attemptId, Map<String, ?> finalPayload) {
        disconnectedSince.remove(attemptId);
        WebSocketSession s = candidates.remove(attemptId);
        if (s != null) {
            send(s, finalPayload);
            closeQuietly(s, CloseStatus.NORMAL);
        }
    }

    public int candidateCount() { return candidates.size(); }

    // ---- monitors ----

    public void registerMonitor(WebSocketSession raw) {
        monitors.add(new ConcurrentWebSocketSessionDecorator(raw, 5000, 512 * 1024));
    }

    public void unregisterMonitor(WebSocketSession raw) {
        monitors.removeIf(s -> s.getId().equals(raw.getId()));
    }

    public int monitorCount() { return monitors.size(); }

    public void broadcast(Map<String, ?> payload) {
        if (monitors.isEmpty()) return;
        String json = mapper.writeValueAsString(payload);
        for (WebSocketSession s : monitors) {
            sendRaw(s, json);
        }
    }

    // ---- io ----

    public void send(WebSocketSession s, Map<String, ?> payload) {
        sendRaw(s, mapper.writeValueAsString(payload));
    }

    private void sendRaw(WebSocketSession s, String json) {
        if (!s.isOpen()) return;
        try {
            s.sendMessage(new TextMessage(json));
        } catch (Exception e) {
            log.debug("WebSocket send failed: {}", e.getMessage());
        }
    }

    private void closeQuietly(WebSocketSession s, CloseStatus status) {
        try {
            s.close(status);
        } catch (Exception ignored) {
            // already closed
        }
    }
}
