package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "lesson_progress", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "lesson_id"}))
@Getter
@Setter
@NoArgsConstructor
public class LessonProgress {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Lesson lesson;

    private int lastPositionSeconds;

    /** Accumulated real watch time (seconds), from heartbeats. */
    private int watchedSeconds;

    private boolean completed;

    private Instant completedAt;

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}
