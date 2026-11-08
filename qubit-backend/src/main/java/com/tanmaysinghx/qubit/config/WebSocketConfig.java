package com.tanmaysinghx.qubit.config;

import com.tanmaysinghx.qubit.proctor.ExamSocketHandler;
import com.tanmaysinghx.qubit.proctor.MonitorSocketHandler;
import com.tanmaysinghx.qubit.proctor.SocketAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final ExamSocketHandler examHandler;
    private final MonitorSocketHandler monitorHandler;
    private final SocketAuthInterceptor authInterceptor;
    private final QubitProperties props;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        String[] origins = props.corsOrigins().toArray(String[]::new);
        registry.addHandler(examHandler, "/ws/exam").addInterceptors(authInterceptor).setAllowedOrigins(origins);
        registry.addHandler(monitorHandler, "/ws/monitor").addInterceptors(authInterceptor).setAllowedOrigins(origins);
    }
}
