package com.tanmaysinghx.qubit.analytics;

import com.tanmaysinghx.qubit.attempt.AttemptStatus;
import com.tanmaysinghx.qubit.exam.ExamCategory;
import com.tanmaysinghx.qubit.exam.ExamMode;
import com.tanmaysinghx.qubit.exam.QuestionType;
import com.tanmaysinghx.qubit.proctor.ViolationType;

import java.time.Instant;
import java.util.List;

public final class AnalyticsDtos {
    private AnalyticsDtos() {}

    // ---------- candidate ----------

    public record SubjectScore(String subject, int questions, int score, int maxScore, int correct, int incorrect, int unanswered) {}

    public record QuestionReview(Long id, int index, String subject, String section, QuestionType type, String text,
                                 List<String> options, String imageUrl, String yourResponse, String correctAnswer, int marks, int negativeMarks,
                                 String outcome, int awarded) {}

    public record AttemptReport(Long registrationId, Long attemptId, String hallTicketNo, String examTitle, String examCode,
                                ExamCategory category, ExamMode mode, AttemptStatus status, String terminationReason,
                                Instant startedAt, Instant finishedAt, long secondsTaken, int durationMinutes,
                                boolean resultsVisible, Integer score, Integer maxScore, Integer correct, Integer incorrect,
                                Integer unanswered, Double accuracy, Integer rank, Integer rankedCandidates,
                                Double percentile, Double examAverage, Integer examTopScore,
                                List<SubjectScore> subjects, boolean reviewAvailable, Instant reviewAvailableAt,
                                List<QuestionReview> questions) {}

    public record HistoryItem(Long registrationId, String examTitle, ExamCategory category, AttemptStatus status,
                              Instant finishedAt, Integer score, Integer maxScore, Double percent) {}

    public record SubjectAccuracy(String subject, int attempted, int correct, double accuracy) {}

    public record CandidateStats(int attempts, int completed, int terminated, Double averagePercent, Double bestPercent,
                                 Double latestPercent, int questionsAnswered, Double accuracy,
                                 List<HistoryItem> history, List<SubjectAccuracy> subjects) {}

    // ---------- admin ----------

    public record Bucket(int from, int to, int count) {}

    public record SubjectAverage(String subject, int maxScore, double averageScore, double averagePercent, double accuracy) {}

    public record QuestionStat(Long id, int index, String subject, QuestionType type, String excerpt,
                               int attempted, int correct, double attemptRate, double correctRate) {}

    public record ViolationStat(ViolationType type, String label, long total, long counted) {}

    public record ExamAnalytics(long registered, long started, long inProgress, long submitted, long autoSubmitted,
                                long terminated, long absent, int maxScore, Double average, Double median,
                                Integer highest, Integer lowest, Double stdDev, List<Bucket> distribution,
                                List<SubjectAverage> subjects, List<QuestionStat> questions, List<ViolationStat> violations) {}
}
