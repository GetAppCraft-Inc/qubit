package com.tanmaysinghx.qubit.analytics;

import com.tanmaysinghx.qubit.analytics.AnalyticsDtos.*;
import com.tanmaysinghx.qubit.attempt.*;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.exam.*;
import com.tanmaysinghx.qubit.proctor.ProctorEventRepository;
import com.tanmaysinghx.qubit.proctor.ViolationType;
import com.tanmaysinghx.qubit.registration.CandidateService;
import com.tanmaysinghx.qubit.registration.Registration;
import com.tanmaysinghx.qubit.registration.RegistrationRepository;
import com.tanmaysinghx.qubit.registration.RegistrationStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final RegistrationRepository registrations;
    private final AttemptRepository attempts;
    private final AnswerRepository answers;
    private final ExamRepository exams;
    private final ProctorEventRepository events;
    private final QuestionImages images;

    private static boolean scored(AttemptStatus s) {
        return s == AttemptStatus.SUBMITTED || s == AttemptStatus.AUTO_SUBMITTED;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    /**
     * Correct answers are only revealed once nobody can still sit the paper:
     * the exam is closed, or every slot's latest possible finish has passed.
     */
    static Instant reviewAvailableAt(Exam e) {
        if (e.getStatus() == ExamStatus.CLOSED) return Instant.EPOCH;
        if (e.isOpenMode()) return e.windowClosesAt().plusSeconds(e.getDurationMinutes() * 60L);
        return e.getSlots().stream()
                .map(s -> s.getStartsAt().plusSeconds((e.getLateEntryMinutes() + e.getDurationMinutes()) * 60L))
                .max(Comparator.naturalOrder())
                .orElse(Instant.EPOCH);
    }

    // ===================================================================== candidate

    @Transactional(readOnly = true)
    public AttemptReport report(Long registrationId, Long userId) {
        Registration r = registrations.findById(registrationId)
                .filter(x -> x.getUser().getId().equals(userId))
                .orElseThrow(() -> ApiException.notFound("Registration not found"));
        Attempt a = attempts.findByRegistrationId(r.getId())
                .orElseThrow(() -> ApiException.notFound("You haven't taken this assessment yet"));
        if (!a.getStatus().isFinished()) {
            throw new ApiException(HttpStatus.CONFLICT, "IN_PROGRESS", "This attempt is still in progress");
        }
        Exam e = r.getExam();
        Instant finished = a.getFinishedAt() == null ? a.getEndsAt() : a.getFinishedAt();
        long seconds = Math.max(0, Duration.between(a.getStartedAt(), finished).getSeconds());
        boolean visible = e.isShowResults() && scored(a.getStatus());

        if (!visible) {
            return new AttemptReport(r.getId(), a.getId(), r.getHallTicketNo(), e.getTitle(), e.getCode(), e.getCategory(),
                    e.effectiveMode(), a.getStatus(), a.getTerminationReason(), a.getStartedAt(), finished, seconds,
                    e.getDurationMinutes(), false, null, null, null, null, null, null, null, null, null, null, null,
                    List.of(), false, null, List.of());
        }

        Map<Long, Answer> mine = answers.findByAttemptId(a.getId()).stream()
                .collect(Collectors.toMap(x -> x.getQuestion().getId(), Function.identity(), (x, y) -> x));
        Instant reviewAt = reviewAvailableAt(e);
        boolean review = !Instant.now().isBefore(reviewAt);

        Map<String, int[]> subj = new LinkedHashMap<>(); // questions, score, max, correct, incorrect, unanswered
        List<QuestionReview> qr = new ArrayList<>();
        int idx = 1;
        for (Question q : e.getQuestions()) {
            Answer ans = mine.get(q.getId());
            String resp = ans == null ? null : ans.getResponse();
            Marking.Result m = Marking.mark(q, resp);
            String outcome = m.outcome().name();
            int awarded = m.awarded();

            int[] s = subj.computeIfAbsent(q.getSubject(), k -> new int[6]);
            s[0]++;
            s[1] += awarded;
            s[2] += q.getMarks();
            switch (m.outcome()) {
                case CORRECT, PARTIAL -> s[3]++;
                case INCORRECT -> s[4]++;
                case UNANSWERED -> s[5]++;
            }

            if (review) {
                qr.add(new QuestionReview(q.getId(), idx, q.getSubject(), q.getSection(), q.getType(), q.getText(),
                        List.copyOf(q.getOptions()), images.url(q, Duration.ofHours(6)), resp, q.getCorrectAnswer(), q.getMarks(),
                        q.getNegativeMarks(), outcome, awarded));
            }
            idx++;
        }
        List<SubjectScore> subjects = subj.entrySet().stream()
                .map(en -> new SubjectScore(en.getKey(), en.getValue()[0], en.getValue()[1], en.getValue()[2],
                        en.getValue()[3], en.getValue()[4], en.getValue()[5]))
                .toList();

        // Standing among everyone who completed this exam.
        List<Integer> scores = attempts.findByExam(e.getId()).stream()
                .filter(x -> scored(x.getStatus()) && x.getScore() != null)
                .map(Attempt::getScore).toList();
        int myScore = a.getScore() == null ? 0 : a.getScore();
        int rank = 1 + (int) scores.stream().filter(s -> s > myScore).count();
        double percentile = scores.isEmpty() ? 100 : round1(100.0 * scores.stream().filter(s -> s <= myScore).count() / scores.size());
        double avg = scores.stream().mapToInt(Integer::intValue).average().orElse(0);
        int top = scores.stream().mapToInt(Integer::intValue).max().orElse(myScore);

        int correct = a.getCorrectCount() == null ? 0 : a.getCorrectCount();
        int incorrect = a.getIncorrectCount() == null ? 0 : a.getIncorrectCount();
        Double accuracy = correct + incorrect == 0 ? null : round1(100.0 * correct / (correct + incorrect));

        return new AttemptReport(r.getId(), a.getId(), r.getHallTicketNo(), e.getTitle(), e.getCode(), e.getCategory(),
                e.effectiveMode(), a.getStatus(), a.getTerminationReason(), a.getStartedAt(), finished, seconds,
                e.getDurationMinutes(), true, a.getScore(), a.getMaxScore(), correct, incorrect, a.getUnansweredCount(),
                accuracy, rank, scores.size(), percentile, round1(avg), top, subjects, review,
                review ? null : reviewAt, qr);
    }

    @Transactional(readOnly = true)
    public CandidateStats candidateStats(Long userId) {
        List<Attempt> mine = attempts.findByUser(userId).stream().filter(a -> a.getStatus().isFinished()).toList();
        List<HistoryItem> history = new ArrayList<>();
        List<Double> percents = new ArrayList<>();
        int terminated = 0;
        for (Attempt a : mine) {
            Exam e = a.getRegistration().getExam();
            boolean visible = e.isShowResults() && scored(a.getStatus());
            if (a.getStatus() == AttemptStatus.TERMINATED) terminated++;
            Double pct = visible && a.getMaxScore() != null && a.getMaxScore() > 0
                    ? round1(100.0 * a.getScore() / a.getMaxScore()) : null;
            if (pct != null) percents.add(pct);
            history.add(new HistoryItem(a.getRegistration().getId(), e.getTitle(), e.getCategory(), a.getStatus(),
                    a.getFinishedAt(), visible ? a.getScore() : null, visible ? a.getMaxScore() : null, pct));
        }

        // Subject accuracy across every released, completed attempt.
        List<Attempt> released = mine.stream()
                .filter(a -> scored(a.getStatus()) && a.getRegistration().getExam().isShowResults()).toList();
        Map<String, int[]> subj = new TreeMap<>(); // attempted, correct
        int answered = 0, correctTotal = 0;
        if (!released.isEmpty()) {
            Map<Long, Attempt> byId = released.stream().collect(Collectors.toMap(Attempt::getId, Function.identity()));
            for (Answer x : answers.findByAttemptIds(byId.keySet())) {
                if (x.getResponse() == null || x.getResponse().isBlank()) continue;
                Question q = x.getQuestion();
                boolean ok = AttemptService.isCorrect(q, x.getResponse());
                int[] s = subj.computeIfAbsent(q.getSubject(), k -> new int[2]);
                s[0]++;
                answered++;
                if (ok) { s[1]++; correctTotal++; }
            }
        }
        List<SubjectAccuracy> subjects = subj.entrySet().stream()
                .map(en -> new SubjectAccuracy(en.getKey(), en.getValue()[0], en.getValue()[1],
                        round1(100.0 * en.getValue()[1] / en.getValue()[0])))
                .toList();

        Collections.reverse(history); // newest first
        return new CandidateStats(mine.size(), (int) mine.stream().filter(a -> scored(a.getStatus())).count(), terminated,
                percents.isEmpty() ? null : round1(percents.stream().mapToDouble(Double::doubleValue).average().orElse(0)),
                percents.isEmpty() ? null : percents.stream().mapToDouble(Double::doubleValue).max().orElse(0),
                percents.isEmpty() ? null : percents.getLast(),
                answered, answered == 0 ? null : round1(100.0 * correctTotal / answered), history, subjects);
    }

    // ===================================================================== admin

    @Transactional(readOnly = true)
    public ExamAnalytics examAnalytics(Long examId) {
        Exam e = exams.findById(examId).orElseThrow(() -> ApiException.notFound("Exam not found"));
        Instant now = Instant.now();
        List<Registration> regs = registrations.findForExam(examId).stream()
                .filter(r -> r.getStatus() != RegistrationStatus.CANCELLED).toList();
        List<Attempt> all = attempts.findByExam(examId);
        Set<Long> attemptedRegs = all.stream().map(a -> a.getRegistration().getId()).collect(Collectors.toSet());
        long absent = regs.stream()
                .filter(r -> !attemptedRegs.contains(r.getId()) && CandidateService.entryCloses(e, r.getSlot()).isBefore(now))
                .count();

        List<Attempt> done = all.stream().filter(a -> scored(a.getStatus()) && a.getScore() != null).toList();
        int max = e.totalMarks();
        List<Integer> scores = done.stream().map(Attempt::getScore).sorted().toList();
        Double avg = null, median = null, sd = null;
        if (!scores.isEmpty()) {
            double m = scores.stream().mapToInt(Integer::intValue).average().orElse(0);
            avg = round1(m);
            int n = scores.size();
            median = n % 2 == 1 ? scores.get(n / 2) : (scores.get(n / 2 - 1) + scores.get(n / 2)) / 2.0;
            sd = round1(Math.sqrt(scores.stream().mapToDouble(s -> (s - m) * (s - m)).sum() / n));
        }

        // Ten buckets by percentage of max; negative totals fall into the first.
        int[] buckets = new int[10];
        for (int s : scores) {
            double pct = max <= 0 ? 0 : 100.0 * s / max;
            buckets[Math.clamp((int) Math.floor(pct / 10), 0, 9)]++;
        }
        List<Bucket> distribution = new ArrayList<>();
        for (int i = 0; i < 10; i++) distribution.add(new Bucket(i * 10, i * 10 + 10, buckets[i]));

        // Per-question and per-subject, from completed attempts only.
        Set<Long> doneIds = done.stream().map(Attempt::getId).collect(Collectors.toSet());
        Map<Long, int[]> perQ = new HashMap<>(); // attempted, correct
        Map<Long, Integer> awardedByQ = new HashMap<>();
        for (Answer x : answers.findByExam(examId)) {
            if (!doneIds.contains(x.getAttempt().getId())) continue;
            if (x.getResponse() == null || x.getResponse().isBlank()) continue;
            Question q = x.getQuestion();
            int[] s = perQ.computeIfAbsent(q.getId(), k -> new int[2]);
            s[0]++;
            Marking.Result m = Marking.mark(q, x.getResponse());
            if (m.outcome() == Marking.Outcome.CORRECT) s[1]++;
            awardedByQ.merge(q.getId(), m.awarded(), Integer::sum);
        }
        int n = done.size();
        List<QuestionStat> qstats = new ArrayList<>();
        Map<String, double[]> subj = new LinkedHashMap<>(); // max, awardedTotal, attempted, correct
        int idx = 1;
        for (Question q : e.getQuestions()) {
            int[] s = perQ.getOrDefault(q.getId(), new int[2]);
            String text = q.getText().replaceAll("\\s+", " ");
            qstats.add(new QuestionStat(q.getId(), idx++, q.getSubject(), q.getType(),
                    text.length() > 110 ? text.substring(0, 110) + "…" : text, s[0], s[1],
                    n == 0 ? 0 : round1(100.0 * s[0] / n), n == 0 ? 0 : round1(100.0 * s[1] / n)));
            double[] t = subj.computeIfAbsent(q.getSubject(), k -> new double[4]);
            t[0] += q.getMarks();
            t[1] += awardedByQ.getOrDefault(q.getId(), 0);
            t[2] += s[0];
            t[3] += s[1];
        }
        List<SubjectAverage> subjects = subj.entrySet().stream().map(en -> {
            double[] t = en.getValue();
            double avgScore = n == 0 ? 0 : t[1] / n;
            return new SubjectAverage(en.getKey(), (int) t[0], round1(avgScore),
                    t[0] == 0 ? 0 : round1(100.0 * avgScore / t[0]), t[2] == 0 ? 0 : round1(100.0 * t[3] / t[2]));
        }).toList();

        List<ViolationStat> violations = events.countByTypeForExam(examId).stream()
                .map(row -> {
                    ViolationType t = (ViolationType) row[0];
                    return new ViolationStat(t, t.label(), ((Number) row[1]).longValue(),
                            row[2] == null ? 0 : ((Number) row[2]).longValue());
                })
                .sorted(Comparator.comparingLong(ViolationStat::total).reversed())
                .toList();

        return new ExamAnalytics(regs.size(), all.size(),
                all.stream().filter(a -> a.getStatus() == AttemptStatus.IN_PROGRESS).count(),
                all.stream().filter(a -> a.getStatus() == AttemptStatus.SUBMITTED).count(),
                all.stream().filter(a -> a.getStatus() == AttemptStatus.AUTO_SUBMITTED).count(),
                all.stream().filter(a -> a.getStatus() == AttemptStatus.TERMINATED).count(),
                absent, max, avg, median, scores.isEmpty() ? null : scores.getLast(),
                scores.isEmpty() ? null : scores.getFirst(), sd, distribution, subjects, qstats, violations);
    }
}
