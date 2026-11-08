package com.tanmaysinghx.qubit.proctor;

import com.tanmaysinghx.qubit.security.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.Map;

/**
 * Browsers can't set headers on WebSocket upgrades, so the JWT travels as {@code ?token=}.
 * Puts {@code userId}, {@code role} and any other query params into the session attributes.
 */
@Component
@RequiredArgsConstructor
public class SocketAuthInterceptor implements HandshakeInterceptor {

    private final TokenService tokens;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler,
                                   Map<String, Object> attributes) {
        MultiValueMap<String, String> params = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
        String token = params.getFirst("token");
        if (token == null || token.isBlank()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        try {
            Jwt jwt = tokens.decode(token);
            attributes.put("userId", Long.valueOf(jwt.getSubject()));
            List<String> roles = jwt.getClaimAsStringList("roles");
            attributes.put("role", roles == null || roles.isEmpty() ? "" : roles.getFirst());
        } catch (Exception e) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        String attemptId = params.getFirst("attemptId");
        if (attemptId != null) {
            try {
                attributes.put("attemptId", Long.valueOf(attemptId));
            } catch (NumberFormatException e) {
                response.setStatusCode(HttpStatus.BAD_REQUEST);
                return false;
            }
        }
        String sid = params.getFirst("sid");
        if (sid != null) attributes.put("sid", sid);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler, Exception ex) {
        // no-op
    }
}
