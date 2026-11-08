package com.tanmaysinghx.qubit.proctor;

import com.tanmaysinghx.qubit.attempt.AttemptRepository;
import com.tanmaysinghx.qubit.attempt.AttemptService;
import com.tanmaysinghx.qubit.config.QubitProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProctorScheduler {

    private final AttemptRepository attempts;
    private final AttemptService attemptService;
    private final ProctorHub hub;
    private final QubitProperties props;

    /** Server-side clock is the source of truth: auto-submit attempts whose time is up. */
    @Scheduled(fixedDelay = 10_000, initialDelay = 15_000)
    public void autoSubmitExpired() {
        for (Long id : attempts.findExpiredIds(Instant.now())) {
            try {
                attemptService.autoSubmitIfExpired(id);
            } catch (Exception e) {
                log.warn("Auto-submit failed for attempt {}: {}", id, e.getMessage());
            }
        }
    }

    /** Terminates attempts whose candidate has been offline longer than the grace period. */
    @Scheduled(fixedDelay = 5_000, initialDelay = 10_000)
    public void enforceConnection() {
        Instant cutoff = Instant.now().minusSeconds(props.proctoring().disconnectGraceSeconds());
        for (Map.Entry<Long, Instant> e : hub.disconnectedSnapshot().entrySet()) {
            if (e.getValue().isBefore(cutoff) && !hub.isOnline(e.getKey())) {
                hub.clearDisconnected(e.getKey());
                try {
                    attemptService.recordViolation(e.getKey(), null, ViolationType.CONNECTION_LOST,
                            "Offline for more than " + props.proctoring().disconnectGraceSeconds() + "s");
                } catch (Exception ex) {
                    log.warn("Could not flag disconnect for attempt {}: {}", e.getKey(), ex.getMessage());
                }
            }
        }
    }
}
