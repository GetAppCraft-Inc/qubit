package com.tanmaysinghx.qubit.attempt;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AnswerRepository extends JpaRepository<Answer, Long> {
    List<Answer> findByAttemptId(Long attemptId);
    Optional<Answer> findByAttemptIdAndQuestionId(Long attemptId, Long questionId);

    @Query("select x from Answer x where x.attempt.registration.exam.id = :examId")
    List<Answer> findByExam(Long examId);

    @Query("select x from Answer x where x.attempt.id in :attemptIds")
    List<Answer> findByAttemptIds(java.util.Collection<Long> attemptIds);
}
