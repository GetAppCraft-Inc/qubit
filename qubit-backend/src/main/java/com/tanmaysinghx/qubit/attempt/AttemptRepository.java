package com.tanmaysinghx.qubit.attempt;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {
    /** The registration's active attempt (voided ones are history). */
    @Query("select a from Attempt a where a.registration.id = :registrationId and a.voided = false")
    Optional<Attempt> findByRegistrationId(Long registrationId);

    @Query("select a from Attempt a where a.registration.id = :registrationId order by a.startedAt asc")
    List<Attempt> findHistory(Long registrationId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attempt a where a.id = :id")
    Optional<Attempt> lockById(Long id);

    @Query("select a.id from Attempt a where a.status = com.tanmaysinghx.qubit.attempt.AttemptStatus.IN_PROGRESS and a.endsAt < :now")
    List<Long> findExpiredIds(Instant now);

    @Query("select a from Attempt a join fetch a.registration r join fetch r.user join fetch r.exam "
            + "where a.status = com.tanmaysinghx.qubit.attempt.AttemptStatus.IN_PROGRESS order by a.startedAt desc")
    List<Attempt> findLive();

    long countByStatus(AttemptStatus status);

    long countByRegistrationExamId(Long examId);

    @Query("select a from Attempt a join fetch a.registration r where r.exam.id = :examId and a.voided = false")
    List<Attempt> findByExam(Long examId);

    @Query("select a from Attempt a join fetch a.registration r join fetch r.exam where r.user.id = :userId and a.voided = false order by a.startedAt asc")
    List<Attempt> findByUser(Long userId);
}
