package com.tanmaysinghx.qubit.attempt;

import com.tanmaysinghx.qubit.exam.Question;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "answers", uniqueConstraints = @UniqueConstraint(columnNames = {"attempt_id", "question_id"}))
@Getter
@Setter
@NoArgsConstructor
public class Answer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Attempt attempt;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Question question;

    @Column(length = 120)
    private String response;

    private boolean markedForReview;

    private Instant updatedAt = Instant.now();
}
