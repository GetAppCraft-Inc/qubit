package com.tanmaysinghx.qubit.attempt;

import com.tanmaysinghx.qubit.registration.Registration;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "attempts")
@Getter
@Setter
@NoArgsConstructor
public class Attempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique: one registration can only ever have one attempt. */
    @OneToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(unique = true)
    private Registration registration;

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
