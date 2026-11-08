package com.tanmaysinghx.qubit.integrity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AppealRepository extends JpaRepository<Appeal, Long> {
    Optional<Appeal> findByAttemptId(Long attemptId);

    Optional<Appeal> findFirstByAttemptRegistrationIdOrderByCreatedAtDesc(Long registrationId);

    @Query("select ap from Appeal ap join fetch ap.attempt a join fetch a.registration r join fetch r.user join fetch r.exam "
            + "order by case when ap.status = com.tanmaysinghx.qubit.integrity.Appeal.Status.PENDING then 0 else 1 end, ap.createdAt desc")
    List<Appeal> findAllDetailed();

    long countByStatus(Appeal.Status status);
}
