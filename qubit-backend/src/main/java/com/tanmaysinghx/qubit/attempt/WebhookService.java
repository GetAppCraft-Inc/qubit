package com.tanmaysinghx.qubit.attempt;

import com.tanmaysinghx.qubit.exam.Exam;
import com.tanmaysinghx.qubit.registration.Registration;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Outgoing integration hooks. Each exam may set a URL; Qubit POSTs JSON when an attempt finishes.
 * <p>Headers: {@code X-Qubit-Event}, {@code X-Qubit-Timestamp} and
 * {@code X-Qubit-Signature: v1=<hex HMAC-SHA256(secret, timestamp + "." + body)>}.
 */
@Slf4j
@Service
public class WebhookService {

    public record Delivery(boolean ok, int status, String message) {}

    private static final long[] BACKOFF_MS = {0, 2_000, 10_000, 60_000};

    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public WebhookService(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    /** Snapshot the attempt now; deliver once the surrounding transaction has committed. */
    public void attemptFinished(Attempt a) {
        Registration r = a.getRegistration();
        Exam e = r.getExam();
        if (e.getWebhookUrl() == null || e.getWebhookSecret() == null) return;

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("attemptId", a.getId());
        data.put("registrationId", r.getId());
        data.put("hallTicketNo", r.getHallTicketNo());
        data.put("status", a.getStatus().name());
        data.put("score", a.getScore());
        data.put("maxScore", a.getMaxScore());
        data.put("correct", a.getCorrectCount());
        data.put("incorrect", a.getIncorrectCount());
        data.put("unanswered", a.getUnansweredCount());
        data.put("violations", a.getViolationCount());
        data.put("terminationReason", a.getTerminationReason());
        data.put("startedAt", a.getStartedAt().toString());
        data.put("finishedAt", a.getFinishedAt() == null ? null : a.getFinishedAt().toString());
        data.put("exam", Map.of("id", e.getId(), "code", e.getCode(), "title", e.getTitle(), "mode", e.effectiveMode().name()));
        data.put("candidate", Map.of("id", r.getUser().getId(), "name", r.getUser().getFullName(), "email", r.getUser().getEmail()));

        String url = e.getWebhookUrl();
        String secret = e.getWebhookSecret();
        Runnable job = () -> deliverWithRetry(url, secret, "attempt.finished", data);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    executor.submit(job);
                }
            });
        } else {
            executor.submit(job);
        }
    }

    /** Synchronous single delivery of a "ping" event, used by the admin "Send test" button. */
    public Delivery test(Exam e) {
        if (e.getWebhookUrl() == null || e.getWebhookSecret() == null) {
            return new Delivery(false, 0, "Set a webhook URL and save first");
        }
        Map<String, Object> data = Map.of("exam", Map.of("id", e.getId(), "code", e.getCode(), "title", e.getTitle()),
                "message", "Test delivery from Qubit");
        return deliver(e.getWebhookUrl(), e.getWebhookSecret(), "ping", data);
    }

    private void deliverWithRetry(String url, String secret, String event, Map<String, Object> data) {
        for (int i = 0; i < BACKOFF_MS.length; i++) {
            try {
                if (BACKOFF_MS[i] > 0) Thread.sleep(BACKOFF_MS[i]);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return;
            }
            Delivery d = deliver(url, secret, event, data);
            if (d.ok()) return;
            log.warn("Webhook {} to {} failed (attempt {}): {}", event, url, i + 1, d.message());
        }
    }

    private Delivery deliver(String url, String secret, String event, Map<String, Object> data) {
        try {
            String ts = String.valueOf(Instant.now().getEpochSecond());
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("event", event);
            envelope.put("sentAt", Instant.now().toString());
            envelope.put("data", data);
            String body = mapper.writeValueAsString(envelope);
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "Qubit-Webhooks/1.0")
                    .header("X-Qubit-Event", event)
                    .header("X-Qubit-Timestamp", ts)
                    .header("X-Qubit-Signature", "v1=" + hmac(secret, ts + "." + body))
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<Void> res = http.send(req, HttpResponse.BodyHandlers.discarding());
            boolean ok = res.statusCode() >= 200 && res.statusCode() < 300;
            return new Delivery(ok, res.statusCode(), ok ? "Delivered" : "Endpoint responded with HTTP " + res.statusCode());
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return new Delivery(false, 0, "Interrupted");
        } catch (Exception ex) {
            return new Delivery(false, 0, "Could not reach endpoint: " + ex.getClass().getSimpleName()
                    + (ex.getMessage() == null ? "" : " — " + ex.getMessage()));
        }
    }

    static String hmac(String secret, String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }
}
