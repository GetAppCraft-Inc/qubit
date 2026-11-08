package com.tanmaysinghx.qubit.admin;

import com.tanmaysinghx.qubit.admin.AdminDtos.*;
import com.tanmaysinghx.qubit.attempt.AttemptDtos.ViolationOutcome;
import com.tanmaysinghx.qubit.attempt.AttemptService;
import com.tanmaysinghx.qubit.exam.ExamAdminService;
import com.tanmaysinghx.qubit.exam.ExamDtos.*;
import com.tanmaysinghx.qubit.exam.ExamStatus;
import com.tanmaysinghx.qubit.proctor.ViolationType;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final ExamAdminService exams;
    private final AdminQueryService queries;
    private final AttemptService attempts;
    private final com.tanmaysinghx.qubit.integrity.IntegrityService integrity;

    @GetMapping("/overview")
    public Overview overview() {
        return queries.overview();
    }

    // ---- exams ----

    @GetMapping("/exams")
    public List<ExamSummaryDto> exams() { return exams.list(); }

    @PostMapping("/exams")
    @ResponseStatus(HttpStatus.CREATED)
    public ExamDetailDto create(@Valid @RequestBody ExamRequest req) { return exams.create(req); }

    @GetMapping("/exams/{id}")
    public ExamDetailDto exam(@PathVariable Long id) { return exams.get(id); }

    @PutMapping("/exams/{id}")
    public ExamDetailDto update(@PathVariable Long id, @Valid @RequestBody ExamRequest req) { return exams.update(id, req); }

    @DeleteMapping("/exams/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { exams.delete(id); }

    @PostMapping("/exams/{id}/publish")
    public ExamDetailDto publish(@PathVariable Long id) { return exams.setStatus(id, ExamStatus.PUBLISHED); }

    @PostMapping("/exams/{id}/unpublish")
    public ExamDetailDto unpublish(@PathVariable Long id) { return exams.setStatus(id, ExamStatus.DRAFT); }

    @PostMapping("/exams/{id}/close")
    public ExamDetailDto close(@PathVariable Long id) { return exams.setStatus(id, ExamStatus.CLOSED); }

    // ---- integrations ----

    @PostMapping("/exams/{id}/webhook/test")
    public com.tanmaysinghx.qubit.attempt.WebhookService.Delivery testWebhook(@PathVariable Long id) {
        return exams.testWebhook(id);
    }

    @PostMapping("/exams/{id}/webhook/rotate")
    public ExamDetailDto rotateWebhook(@PathVariable Long id) { return exams.rotateWebhookSecret(id); }

    // ---- slots ----

    @PostMapping("/exams/{id}/slots")
    public ExamDetailDto addSlot(@PathVariable Long id, @Valid @RequestBody SlotRequest req) { return exams.addSlot(id, req); }

    @DeleteMapping("/slots/{slotId}")
    public ExamDetailDto deleteSlot(@PathVariable Long slotId) { return exams.deleteSlot(slotId); }

    // ---- questions ----

    @PostMapping("/exams/{id}/questions")
    public ExamDetailDto addQuestion(@PathVariable Long id, @Valid @RequestBody QuestionRequest req) {
        return exams.addQuestions(id, List.of(req));
    }

    @PostMapping("/exams/{id}/questions/bulk")
    public ExamDetailDto addQuestions(@PathVariable Long id, @RequestBody List<@Valid QuestionRequest> req) {
        return exams.addQuestions(id, req);
    }

    @PutMapping("/questions/{questionId}")
    public ExamDetailDto updateQuestion(@PathVariable Long questionId, @Valid @RequestBody QuestionRequest req) {
        return exams.updateQuestion(questionId, req);
    }

    @DeleteMapping("/questions/{questionId}")
    public ExamDetailDto deleteQuestion(@PathVariable Long questionId) { return exams.deleteQuestion(questionId); }

    // ---- candidates & proctoring ----

    @GetMapping("/exams/{id}/registrations")
    public List<RegistrationRow> registrations(@PathVariable Long id) { return queries.registrations(id); }

    @GetMapping("/attempts/live")
    public List<LiveAttemptRow> live() { return queries.liveAttempts(); }

    @GetMapping("/attempts/{id}/events")
    public List<EventRow> events(@PathVariable Long id) { return queries.events(id); }

    @PostMapping("/attempts/{id}/terminate")
    public java.util.Map<String, Object> terminate(@PathVariable Long id, @RequestBody(required = false) TerminateRequest req) {
        integrity.cancelAttempt(id, req == null ? null : req.reason());
        return java.util.Map.of("terminated", true);
    }

    @GetMapping("/hall-tickets/{number}")
    public RegistrationRow hallTicket(@PathVariable String number) { return queries.hallTicket(number); }
}
