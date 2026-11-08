package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "enrollments", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "course_id"}))
@Getter
@Setter
@NoArgsConstructor
public class Enrollment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    @Column(nullable = false)
    private Instant enrolledAt = Instant.now();

    private Instant expiresAt;

    private boolean revoked;

    private Instant lastAccessedAt;

    public boolean isActive(Instant now) {
        return !revoked && (expiresAt == null || expiresAt.isAfter(now));
    }
}
