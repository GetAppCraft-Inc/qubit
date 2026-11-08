package com.tanmaysinghx.qubit.integrity;

import com.tanmaysinghx.qubit.attempt.Attempt;
import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** A candidate's request to restart after their attempt was cancelled/terminated. One per attempt. */
@Entity
@Table(name = "appeals", uniqueConstraints = @UniqueConstraint(columnNames = "attempt_id"))
@Getter
@Setter
@NoArgsConstructor
public class Appeal {

    public enum Status { PENDING, APPROVED, REJECTED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Attempt attempt;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;

    @Column(nullable = false, length = 2000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.PENDING;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant decidedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    private User decidedBy;

    @Column(length = 1000)
    private String decisionNote;

    /** For approved appeals: deadline to start the retake. */
    private Instant retakeUntil;
}
