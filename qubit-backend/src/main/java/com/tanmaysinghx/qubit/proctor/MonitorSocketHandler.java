package com.tanmaysinghx.qubit.proctor;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;

/** Invigilator channel: {@code /ws/monitor?token=..}. Receives a live stream of attempt events. */
@Component
@RequiredArgsConstructor
public class MonitorSocketHandler extends TextWebSocketHandler {

    private final ProctorHub hub;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String role = (String) session.getAttributes().get("role");
        if (!"QUBIT_ADMIN".equals(role) && !"QUBIT_SUPERADMIN".equals(role)) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        hub.registerMonitor(session);
        hub.send(session, Map.of("type", "HELLO"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        if (message.getPayload().contains("PING")) hub.send(session, Map.of("type", "PONG"));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        hub.unregisterMonitor(session);
    }
}
