package com.tanmaysinghx.qubit.attempt;

import com.tanmaysinghx.qubit.registration.Registration;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "attempts", indexes = @Index(name = "idx_attempts_registration", columnList = "registration_id"))
@Getter
@Setter
@NoArgsConstructor
public class Attempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * A registration has at most one ACTIVE (non-voided) attempt. An approved appeal voids the old attempt
     * (kept for audit) so the candidate can start again.
     */
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "registration_id")
    private Registration registration;

    /** Superseded by a retake granted on appeal. Ignored everywhere except the audit trail. */
    private boolean voided;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttemptStatus status = AttemptStatus.IN_PROGRESS;

    @Column(nullable = false)
    private Instant startedAt;

    @Column(nullable = false)
    private Instant endsAt;

    private Instant finishedAt;

    @Column(length = 255)
    private String terminationReason;

    private int violationCount;

    private Instant lastViolationAt;

    /** Identifies the browser tab that started the attempt; a different one connecting is a violation. */
    @Column(length = 64)
    private String clientSessionId;

    @Column(length = 64)
    private String ipAddress;

    @Column(length = 300)
    private String userAgent;

    private Integer score;
    private Integer maxScore;
    private Integer correctCount;
    private Integer incorrectCount;
    private Integer unansweredCount;
}
