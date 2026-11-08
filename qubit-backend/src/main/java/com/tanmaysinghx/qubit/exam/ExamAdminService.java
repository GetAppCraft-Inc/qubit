package com.tanmaysinghx.qubit.exam;

import com.tanmaysinghx.qubit.attempt.AttemptRepository;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.exam.ExamDtos.*;
import com.tanmaysinghx.qubit.registration.RegistrationRepository;
import com.tanmaysinghx.qubit.registration.RegistrationStatus;
import com.tanmaysinghx.qubit.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ExamAdminService {

    private final ExamRepository exams;
    private final ExamSlotRepository slots;
    private final QuestionRepository questions;
    private final RegistrationRepository registrations;
    private final AttemptRepository attempts;
    private final CurrentUser currentUser;
    private final com.tanmaysinghx.qubit.attempt.WebhookService webhooks;
    private final QuestionImages images;

    @Transactional(readOnly = true)
    public List<ExamSummaryDto> list() {
        Instant now = Instant.now();
        return exams.findAllByOrderByCreatedAtDesc().stream().map(e -> summary(e, now)).toList();
    }

    @Transactional(readOnly = true)
    public ExamDetailDto get(Long id) {
        return detail(find(id));
    }

    @Transactional
    public ExamDetailDto create(ExamRequest req) {
        if (exams.existsByCodeIgnoreCase(req.code().trim())) {
            throw ApiException.conflict("Exam code " + req.code() + " is already in use");
        }
        Exam exam = new Exam();
        exam.setCreatedBy(currentUser.get());
        apply(exam, req);
        return detail(exams.save(exam));
    }

    @Transactional
    public ExamDetailDto update(Long id, ExamRequest req) {
        Exam exam = find(id);
        if (!exam.getCode().equalsIgnoreCase(req.code().trim()) && exams.existsByCodeIgnoreCase(req.code().trim())) {
            throw ApiException.conflict("Exam code " + req.code() + " is already in use");
        }
        if (isLocked(exam) && exam.getDurationMinutes() != req.durationMinutes()) {
            throw ApiException.conflict("Duration can't change after candidates have started this exam");
        }
        apply(exam, req);
        exam.setUpdatedAt(Instant.now());
        return detail(exam);
    }

    @Transactional
    public void delete(Long id) {
        Exam exam = find(id);
        if (registrations.countByExamIdAndStatusNot(id, RegistrationStatus.CANCELLED) > 0) {
            throw ApiException.conflict("This exam has registrations. Close it instead of deleting.");
        }
        exams.delete(exam);
    }

    @Transactional
    public ExamDetailDto setStatus(Long id, ExamStatus target) {
        Exam exam = find(id);
        if (target == ExamStatus.PUBLISHED) {
            if (exam.getQuestions().isEmpty()) throw ApiException.badRequest("Add at least one question before publishing");
            if (exam.isOpenMode()) {
                ensureOpenWindowSlot(exam);
            } else if (exam.getSlots().stream().noneMatch(s -> !OPEN_SLOT_LABEL.equals(s.getLabel()))) {
                throw ApiException.badRequest("Add at least one slot before publishing");
            }
        }
        if (target == ExamStatus.DRAFT && registrations.countByExamIdAndStatusNot(id, RegistrationStatus.CANCELLED) > 0) {
            throw ApiException.conflict("Candidates have already registered; the exam can't return to draft");
        }
        exam.setStatus(target);
        exam.setUpdatedAt(Instant.now());
        return detail(exam);
    }

    @Transactional
    public ExamDetailDto addSlot(Long examId, SlotRequest req) {
        Exam exam = find(examId);
        if (req.startsAt().isBefore(Instant.now())) throw ApiException.badRequest("Slot must start in the future");
        ExamSlot slot = new ExamSlot();
        slot.setExam(exam);
        slot.setStartsAt(req.startsAt());
        slot.setCapacity(req.capacity());
        slot.setLabel(blankToNull(req.label()));
        exam.getSlots().add(slot);
        exams.flush();
        return detail(exam);
    }

    @Transactional
    public ExamDetailDto deleteSlot(Long slotId) {
        ExamSlot slot = slots.findById(slotId).orElseThrow(() -> ApiException.notFound("Slot not found"));
        if (registrations.countBySlotIdAndStatusNot(slotId, RegistrationStatus.CANCELLED) > 0) {
            throw ApiException.conflict("Candidates are booked in this slot");
        }
        Exam exam = slot.getExam();
        exam.getSlots().remove(slot);
        return detail(exam);
    }

    @Transactional
    public ExamDetailDto addQuestions(Long examId, List<QuestionRequest> reqs) {
        Exam exam = find(examId);
        ensureEditable(exam);
        int next = exam.getQuestions().stream().mapToInt(Question::getPosition).max().orElse(0) + 1;
        for (QuestionRequest req : reqs) {
            Question q = new Question();
            q.setExam(exam);
            applyQuestion(q, req);
            if (req.position() == null) q.setPosition(next++);
            exam.getQuestions().add(q);
        }
        exams.flush();
        return detail(exam);
    }

    @Transactional
    public ExamDetailDto updateQuestion(Long questionId, QuestionRequest req) {
        Question q = questions.findById(questionId).orElseThrow(() -> ApiException.notFound("Question not found"));
        ensureEditable(q.getExam());
        applyQuestion(q, req);
        return detail(q.getExam());
    }

    @Transactional
    public ExamDetailDto deleteQuestion(Long questionId) {
        Question q = questions.findById(questionId).orElseThrow(() -> ApiException.notFound("Question not found"));
        Exam exam = q.getExam();
        ensureEditable(exam);
        exam.getQuestions().remove(q);
        return detail(exam);
    }

    // ---- helpers ----

    /** OPEN exams have no schedule; registrations attach to one implicit, unlimited slot. */
    public static final String OPEN_SLOT_LABEL = "Open window";

    public static ExamSlot ensureOpenWindowSlot(Exam exam) {
        return exam.getSlots().stream()
                .filter(s -> OPEN_SLOT_LABEL.equals(s.getLabel()))
                .findFirst()
                .orElseGet(() -> {
                    ExamSlot slot = new ExamSlot();
                    slot.setExam(exam);
                    slot.setStartsAt(exam.windowOpensAt());
                    slot.setCapacity(1_000_000);
                    slot.setLabel(OPEN_SLOT_LABEL);
                    exam.getSlots().add(slot);
                    return slot;
                });
    }

    private Exam find(Long id) {
        return exams.findById(id).orElseThrow(() -> ApiException.notFound("Exam not found"));
    }

    private boolean isLocked(Exam exam) {
        return attempts.countByRegistrationExamId(exam.getId()) > 0;
    }

    private void ensureEditable(Exam exam) {
        if (isLocked(exam)) throw ApiException.conflict("Questions are locked because candidates have already started this exam");
    }

    private void apply(Exam exam, ExamRequest req) {
        if (req.registrationOpensAt() != null && req.registrationClosesAt() != null
                && !req.registrationClosesAt().isAfter(req.registrationOpensAt())) {
            throw ApiException.badRequest("Registration must close after it opens");
        }
        exam.setCode(req.code().trim().toUpperCase(Locale.ROOT));
        exam.setTitle(req.title().trim());
        exam.setDescription(blankToNull(req.description()));
        exam.setInstructions(blankToNull(req.instructions()));
        exam.setCategory(req.category());
        exam.setDurationMinutes(req.durationMinutes());
        exam.setLateEntryMinutes(req.lateEntryMinutes());
        exam.setViolationTolerance(req.violationTolerance());
        exam.setShowResults(req.showResults());
        exam.setRegistrationOpensAt(req.registrationOpensAt());
        exam.setRegistrationClosesAt(req.registrationClosesAt());

        ExamMode mode = req.mode() == null ? ExamMode.PROCTORED : req.mode();
        if (exam.getId() != null && mode != exam.effectiveMode()
                && registrations.countByExamIdAndStatusNot(exam.getId(), RegistrationStatus.CANCELLED) > 0) {
            throw ApiException.conflict("The exam mode can't change after candidates have registered");
        }
        exam.setMode(mode);
        if (mode == ExamMode.OPEN && exam.getStatus() == ExamStatus.PUBLISHED) ensureOpenWindowSlot(exam);

        String hook = blankToNull(req.webhookUrl());
        if (hook != null && !hook.matches("^https?://\\S+$")) {
            throw ApiException.badRequest("Webhook URL must start with http:// or https://");
        }
        exam.setWebhookUrl(hook);
        if (hook != null && exam.getWebhookSecret() == null) exam.setWebhookSecret(newSecret());
    }

    private static String newSecret() {
        byte[] b = new byte[24];
        new java.security.SecureRandom().nextBytes(b);
        return "whsec_" + java.util.HexFormat.of().formatHex(b);
    }

    @Transactional(readOnly = true)
    public com.tanmaysinghx.qubit.attempt.WebhookService.Delivery testWebhook(Long id) {
        return webhooks.test(find(id));
    }

    @Transactional
    public ExamDetailDto rotateWebhookSecret(Long id) {
        Exam exam = find(id);
        exam.setWebhookSecret(newSecret());
        return detail(exam);
    }

    static void applyQuestion(Question q, QuestionRequest req) {
        List<String> options = req.options() == null ? List.of()
                : req.options().stream().map(o -> o == null ? "" : o.trim()).filter(o -> !o.isEmpty()).toList();
        String answer = req.correctAnswer().trim();
        switch (req.type()) {
            case SINGLE -> {
                if (options.size() < 2) throw ApiException.badRequest("A single-choice question needs at least 2 options");
                int idx = parseIndex(answer, options.size());
                answer = String.valueOf(idx);
            }
            case MULTIPLE -> {
                if (options.size() < 2) throw ApiException.badRequest("A multiple-choice question needs at least 2 options");
                TreeSet<Integer> set = new TreeSet<>();
                for (String part : answer.split(",")) {
                    if (!part.isBlank()) set.add(parseIndex(part.trim(), options.size()));
                }
                if (set.isEmpty()) throw ApiException.badRequest("Select at least one correct option");
                answer = String.join(",", set.stream().map(String::valueOf).toList());
            }
            case NUMERIC -> {
                options = List.of();
                try {
                    answer = new BigDecimal(answer).stripTrailingZeros().toPlainString();
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("Numeric answer must be a number");
                }
            }
        }
        q.setSubject(req.subject().trim());
        q.setType(req.type());
        q.setText(req.text().trim());
        q.getOptions().clear();
        q.getOptions().addAll(options);
        q.setCorrectAnswer(answer);
        q.setMarks(req.marks());
        q.setNegativeMarks(req.negativeMarks());
        if (req.position() != null) q.setPosition(req.position());

        q.setSection(blankToNull(req.section()));
        String image = blankToNull(req.imageData());
        if (image == null) {
            q.setImage(null);
        } else if (!"keep".equals(image)) {
            if (!image.matches("^data:image/(png|jpeg|jpg|gif|webp|svg\\+xml);base64,[A-Za-z0-9+/=\\s]+$")) {
                throw ApiException.badRequest("Image must be a base64 data URL (PNG, JPEG, GIF, WebP or SVG)");
            }
            if (q.getImage() != null) q.getImage().setData(image);
            else q.setImage(new QuestionImage(image));
        }
        q.setPartialMarking(req.type() == QuestionType.MULTIPLE && Boolean.TRUE.equals(req.partialMarking()));
        q.setAnswerTolerance(req.type() == QuestionType.NUMERIC && req.answerTolerance() != null && req.answerTolerance() > 0
                ? req.answerTolerance() : null);
    }

    private static int parseIndex(String s, int size) {
        try {
            int i = Integer.parseInt(s);
            if (i < 0 || i >= size) throw new NumberFormatException();
            return i;
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Correct answer must be an option index between 0 and " + (size - 1));
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private ExamSummaryDto summary(Exam e, Instant now) {
        Instant next = e.getSlots().stream().map(ExamSlot::getStartsAt).filter(t -> t.isAfter(now)).min(Comparator.naturalOrder()).orElse(null);
        return new ExamSummaryDto(e.getId(), e.getCode(), e.getTitle(), e.getCategory(), e.getStatus(), e.effectiveMode(), e.getDurationMinutes(),
                e.getQuestions().size(), e.totalMarks(), e.getSlots().size(),
                registrations.countByExamIdAndStatusNot(e.getId(), RegistrationStatus.CANCELLED),
                e.getRegistrationOpensAt(), e.getRegistrationClosesAt(), next, e.getCreatedAt());
    }

    private ExamDetailDto detail(Exam e) {
        List<SlotDto> slotDtos = e.getSlots().stream()
                .sorted(Comparator.comparing(ExamSlot::getStartsAt))
                .map(s -> new SlotDto(s.getId(), s.getStartsAt(), s.getCapacity(), s.getLabel(),
                        s.getId() == null ? 0 : registrations.countBySlotIdAndStatusNot(s.getId(), RegistrationStatus.CANCELLED)))
                .toList();
        List<QuestionAdminDto> qs = e.getQuestions().stream()
                .sorted(Comparator.comparingInt(Question::getPosition).thenComparing(q -> q.getId() == null ? Long.MAX_VALUE : q.getId()))
                .map(q -> QuestionAdminDto.of(q, images.url(q, java.time.Duration.ofHours(6)))).toList();
        return new ExamDetailDto(e.getId(), e.getCode(), e.getTitle(), e.getDescription(), e.getInstructions(), e.getCategory(),
                e.getStatus(), e.effectiveMode(), e.getWebhookUrl(), e.getWebhookSecret(),
                e.getDurationMinutes(), e.getLateEntryMinutes(), e.getViolationTolerance(), e.isShowResults(),
                e.getRegistrationOpensAt(), e.getRegistrationClosesAt(), e.totalMarks(),
                e.getId() == null ? 0 : registrations.countByExamIdAndStatusNot(e.getId(), RegistrationStatus.CANCELLED),
                e.getId() != null && isLocked(e), slotDtos, qs);
    }
}
