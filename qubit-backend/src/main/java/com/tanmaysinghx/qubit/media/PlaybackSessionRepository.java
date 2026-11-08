package com.tanmaysinghx.qubit.media;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PlaybackSessionRepository extends JpaRepository<PlaybackSession, Long> {
    Optional<PlaybackSession> findByToken(String token);

    @Query("select s from PlaybackSession s where s.user.id = :userId and s.revoked = false "
            + "and s.expiresAt > :now and s.lastSeenAt > :activeSince")
    List<PlaybackSession> findActive(Long userId, Instant now, Instant activeSince);

    long countByAssetId(Long assetId);
}
