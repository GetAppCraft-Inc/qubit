package com.tanmaysinghx.qubit.media;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {
    List<MediaAsset> findAllByOrderByCreatedAtDesc();

    Optional<MediaAsset> findFirstByStatusOrderByCreatedAtAsc(MediaAsset.Status status);

    /** Atomically claims a queued asset so only one worker processes it. */
    @Modifying
    @Transactional
    @Query("update MediaAsset a set a.status = com.tanmaysinghx.qubit.media.MediaAsset.Status.PROCESSING, a.progress = 0 "
            + "where a.id = :id and a.status = com.tanmaysinghx.qubit.media.MediaAsset.Status.QUEUED")
    int claim(Long id);

    @Modifying
    @Transactional
    @Query("update MediaAsset a set a.progress = :progress where a.id = :id")
    void updateProgress(Long id, int progress);

    /** On restart, anything left mid-processing goes back to the queue. */
    @Modifying
    @Transactional
    @Query("update MediaAsset a set a.status = com.tanmaysinghx.qubit.media.MediaAsset.Status.QUEUED "
            + "where a.status = com.tanmaysinghx.qubit.media.MediaAsset.Status.PROCESSING")
    int requeueInterrupted();
}
