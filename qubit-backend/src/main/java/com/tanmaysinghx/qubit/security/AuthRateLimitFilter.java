package com.tanmaysinghx.qubit.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Fixed-window, per-IP limits on the unauthenticated auth endpoints to slow down
 * password guessing and email flooding. In-memory: fine for a single instance.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private record Rule(int max, long windowMs) {}

    private static final Map<String, Rule> RULES = Map.of(
            "/api/auth/login", new Rule(10, 5 * 60_000L),
            "/api/auth/register", new Rule(6, 60 * 60_000L),
            "/api/auth/forgot-password", new Rule(5, 15 * 60_000L),
            "/api/auth/resend-verification", new Rule(5, 15 * 60_000L),
            "/api/auth/reset-password", new Rule(10, 15 * 60_000L));

    private record Window(long startedAt, AtomicInteger count) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !RULES.containsKey(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        Rule rule = RULES.get(path);
        long now = System.currentTimeMillis();
        String key = clientIp(req) + "|" + path;
        Window w = windows.compute(key, (k, cur) ->
                cur == null || now - cur.startedAt() > rule.windowMs() ? new Window(now, new AtomicInteger()) : cur);
        if (w.count().incrementAndGet() > rule.max()) {
            long retry = Math.max(1, (w.startedAt() + rule.windowMs() - now) / 1000);
            res.setStatus(429);
            res.setHeader("Retry-After", String.valueOf(retry));
            res.setContentType("application/json");
            res.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Too many attempts. Try again in "
                    + (retry >= 60 ? (retry / 60) + " min" : retry + " s") + ".\"}");
            return;
        }
        chain.doFilter(req, res);
    }

    @Scheduled(fixedDelay = 10 * 60_000L)
    public void evictOld() {
        long cutoff = System.currentTimeMillis() - 60 * 60_000L;
        windows.entrySet().removeIf(e -> e.getValue().startedAt() < cutoff);
    }

    private static String clientIp(HttpServletRequest req) {
        String fwd = req.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
