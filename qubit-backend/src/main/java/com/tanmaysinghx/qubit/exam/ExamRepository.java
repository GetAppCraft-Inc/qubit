package com.tanmaysinghx.qubit.exam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamRepository extends JpaRepository<Exam, Long> {
    List<Exam> findAllByOrderByCreatedAtDesc();
    List<Exam> findByStatusOrderByCreatedAtDesc(ExamStatus status);
    boolean existsByCodeIgnoreCase(String code);
    long countByStatus(ExamStatus status);
}
