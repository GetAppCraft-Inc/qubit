package com.tanmaysinghx.qubit.exam;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByExamIdOrderByPositionAscIdAsc(Long examId);
    int countByExamId(Long examId);
}
