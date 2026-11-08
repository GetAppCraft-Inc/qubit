package com.tanmaysinghx.qubit.registration;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RegistrationRepository extends JpaRepository<Registration, Long> {
    @Query("select r from Registration r join fetch r.exam join fetch r.slot where r.user.id = :userId order by r.slot.startsAt asc")
    List<Registration> findForUser(Long userId);

    @Query("select r from Registration r join fetch r.user join fetch r.slot where r.exam.id = :examId order by r.createdAt desc")
    List<Registration> findForExam(Long examId);

    Optional<Registration> findByUserIdAndExamId(Long userId, Long examId);

    Optional<Registration> findByHallTicketNo(String hallTicketNo);

    boolean existsByHallTicketNo(String hallTicketNo);

    long countBySlotIdAndStatusNot(Long slotId, RegistrationStatus status);

    long countByStatusNot(RegistrationStatus status);

    long countByExamIdAndStatusNot(Long examId, RegistrationStatus status);
}
