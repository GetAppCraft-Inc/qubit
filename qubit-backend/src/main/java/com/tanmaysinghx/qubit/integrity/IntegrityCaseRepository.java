package com.tanmaysinghx.qubit.integrity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface IntegrityCaseRepository extends JpaRepository<IntegrityCase, Long> {
    @Query("select c from IntegrityCase c join fetch c.attempt a join fetch a.registration r join fetch r.user join fetch r.exam "
            + "where c.status = :status order by c.openedAt desc")
    List<IntegrityCase> findByStatusDetailed(IntegrityCase.Status status);

    @Query("select c from IntegrityCase c join fetch c.attempt a join fetch a.registration r join fetch r.user join fetch r.exam "
            + "order by c.openedAt desc limit 200")
    List<IntegrityCase> findRecent();

    Optional<IntegrityCase> findFirstByAttemptIdAndStatus(Long attemptId, IntegrityCase.Status status);

    long countByStatus(IntegrityCase.Status status);
}
