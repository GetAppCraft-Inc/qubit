package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** One viewer, one device, one video. Gates key delivery and enforces concurrent-stream limits. */
@Entity
@Table(name = "playback_sessions", indexes = {
        @Index(columnList = "token", unique = true),
        @Index(columnList = "user_id,lastSeenAt")
})
@Getter
@Setter
@NoArgsConstructor
public class PlaybackSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String token;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private MediaAsset asset;

    private Long lessonId;

    @Column(nullable = false, length = 64)
    private String deviceId;

    @Column(length = 64)
    private String ipAddress;

    @Column(length = 300)
    private String userAgent;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant lastSeenAt = Instant.now();

    @Column(nullable = false)
    private Instant expiresAt;

    private boolean revoked;

    private int keyFetches;
}
