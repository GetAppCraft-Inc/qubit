package com.tanmaysinghx.qubit.proctor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProctorEventRepository extends JpaRepository<ProctorEvent, Long> {
    List<ProctorEvent> findByAttemptIdOrderByCreatedAtAsc(Long attemptId);

    /** Rows of [ViolationType type, Long total, Long counted]. */
    @org.springframework.data.jpa.repository.Query("""
            select e.type, count(e), sum(case when e.counted = true then 1 else 0 end)
            from ProctorEvent e where e.attempt.registration.exam.id = :examId group by e.type""")
    List<Object[]> countByTypeForExam(Long examId);
}
