package com.tanmaysinghx.qubit.integrity;

import com.tanmaysinghx.qubit.attempt.Attempt;
import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A flagged attempt waiting for (or having received) an invigilator's decision. */
@Entity
@Table(name = "integrity_cases", indexes = @Index(columnList = "status"))
@Getter
@Setter
@NoArgsConstructor
public class IntegrityCase {

    public enum Status {
        /** Waiting for an invigilator. */
        OPEN,
        /** Invigilator let the candidate continue. */
        DISMISSED,
        /** Invigilator cancelled the attempt. */
        CANCELLED,
        /** The exam is set to terminate automatically; recorded for notification and audit. */
        AUTO_TERMINATED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Attempt attempt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    /** Latest violation that triggered/updated the case. */
    @Column(nullable = false, length = 255)
    private String reason;

    private int violationCount;

    @Column(nullable = false)
    private Instant openedAt = Instant.now();

    private Instant updatedAt;

    private Instant decidedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    private User decidedBy;

    @Column(length = 300)
    private String decisionNote;
}
