package com.tanmaysinghx.qubit.proctor;

import com.tanmaysinghx.qubit.attempt.Attempt;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "proctor_events", indexes = @Index(columnList = "attempt_id"))
@Getter
@Setter
@NoArgsConstructor
public class ProctorEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Attempt attempt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ViolationType type;

    private boolean counted;

    @Column(length = 255)
    private String detail;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
