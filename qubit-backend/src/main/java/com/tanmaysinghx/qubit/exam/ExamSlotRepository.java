package com.tanmaysinghx.qubit.exam;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface ExamSlotRepository extends JpaRepository<ExamSlot, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ExamSlot s where s.id = :id")
    Optional<ExamSlot> lockById(Long id);
}
