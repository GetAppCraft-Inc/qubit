package com.tanmaysinghx.qubit.analytics;

import com.tanmaysinghx.qubit.analytics.AnalyticsDtos.AttemptReport;
import com.tanmaysinghx.qubit.analytics.AnalyticsDtos.CandidateStats;
import com.tanmaysinghx.qubit.analytics.AnalyticsDtos.ExamAnalytics;
import com.tanmaysinghx.qubit.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analytics;
    private final CurrentUser currentUser;

    @GetMapping("/api/registrations/{id}/report")
    public AttemptReport report(@PathVariable Long id) {
        return analytics.report(id, currentUser.id());
    }

    @GetMapping("/api/me/stats")
    public CandidateStats stats() {
        return analytics.candidateStats(currentUser.id());
    }

    @GetMapping("/api/admin/exams/{id}/analytics")
    public ExamAnalytics examAnalytics(@PathVariable Long id) {
        return analytics.examAnalytics(id);
    }
}
