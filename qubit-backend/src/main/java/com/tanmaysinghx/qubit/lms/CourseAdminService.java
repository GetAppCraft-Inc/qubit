package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.exam.Exam;
import com.tanmaysinghx.qubit.exam.ExamRepository;
import com.tanmaysinghx.qubit.lms.LmsDtos.*;
import com.tanmaysinghx.qubit.media.MediaAsset;
import com.tanmaysinghx.qubit.media.MediaAssetRepository;
import com.tanmaysinghx.qubit.media.MediaService;
import com.tanmaysinghx.qubit.security.CurrentUser;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CourseAdminService {

    private final CourseRepository courses;
    private final CourseModuleRepository modules;
    private final LessonRepository lessons;
    private final EnrollmentRepository enrollments;
    private final LessonProgressRepository progress;
    private final MediaAssetRepository assets;
    private final ExamRepository exams;
    private final MediaService media;
    private final CurrentUser currentUser;

    @PostConstruct
    void wireMediaUsage() {
        media.setInUseCheck(lessons::existsByAssetId);
    }

    @Transactional(readOnly = true)
    public List<CourseSummaryDto> list() {
        return courses.findAllByOrderByCreatedAtDesc().stream().map(c -> {
            List<Lesson> all = c.getModules().stream().flatMap(m -> m.getLessons().stream()).toList();
            return new CourseSummaryDto(c.getId(), c.getSlug(), c.getTitle(), c.getCategory(), c.getStatus(),
                    c.getModules().size(), all.size(), duration(all), enrollments.countByCourseId(c.getId()), c.getCreatedAt());
        }).toList();
    }

    @Transactional(readOnly = true)
    public CourseAdminDto get(Long id) { return dto(find(id)); }

    @Transactional
    public CourseAdminDto create(CourseRequest req) {
        Course c = new Course();
        c.setCreatedBy(currentUser.get());
        apply(c, req);
        return dto(courses.save(c));
    }

    @Transactional
    public CourseAdminDto update(Long id, CourseRequest req) {
        Course c = find(id);
        apply(c, req);
        c.setUpdatedAt(Instant.now());
        return dto(c);
    }

    @Transactional
    public CourseAdminDto setStatus(Long id, Course.Status status) {
        Course c = find(id);
        if (status == Course.Status.PUBLISHED) {
            boolean hasLesson = c.getModules().stream().anyMatch(m -> !m.getLessons().isEmpty());
            if (!hasLesson) throw ApiException.badRequest("Add at least one lesson before publishing");
            boolean pending = c.getModules().stream().flatMap(m -> m.getLessons().stream())
                    .anyMatch(l -> l.getAsset() != null && l.getAsset().getStatus() != MediaAsset.Status.READY);
            if (pending) throw ApiException.badRequest("Some lesson videos are still processing or failed");
        }
        c.setStatus(status);
        c.setUpdatedAt(Instant.now());
        return dto(c);
    }

    @Transactional
    public void delete(Long id) {
        Course c = find(id);
        if (enrollments.countByCourseId(id) > 0) throw ApiException.conflict("Learners are enrolled. Archive the course instead.");
        progress.deleteByCourse(id);
        courses.delete(c);
    }

    // ---- modules ----

    @Transactional
    public CourseAdminDto addModule(Long courseId, ModuleRequest req) {
        Course c = find(courseId);
        CourseModule m = new CourseModule();
        m.setCourse(c);
        m.setTitle(req.title().trim());
        m.setPosition(c.getModules().size() + 1);
        c.getModules().add(m);
        courses.flush();
        return dto(c);
    }

    @Transactional
    public CourseAdminDto renameModule(Long moduleId, ModuleRequest req) {
        CourseModule m = module(moduleId);
        m.setTitle(req.title().trim());
        return dto(m.getCourse());
    }

    @Transactional
    public CourseAdminDto deleteModule(Long moduleId) {
        CourseModule m = module(moduleId);
        Course c = m.getCourse();
        progress.deleteByModule(moduleId);
        c.getModules().remove(m);
        renumber(c.getModules());
        return dto(c);
    }

    @Transactional
    public CourseAdminDto reorderModules(Long courseId, List<Long> ids) {
        Course c = find(courseId);
        Map<Long, CourseModule> byId = new HashMap<>();
        c.getModules().forEach(m -> byId.put(m.getId(), m));
        if (!byId.keySet().equals(new HashSet<>(ids))) throw ApiException.badRequest("Send every module id exactly once");
        for (int i = 0; i < ids.size(); i++) byId.get(ids.get(i)).setPosition(i + 1);
        c.getModules().sort(Comparator.comparingInt(CourseModule::getPosition));
        return dto(c);
    }

    // ---- lessons ----

    @Transactional
    public CourseAdminDto addLesson(Long moduleId, LessonRequest req) {
        CourseModule m = module(moduleId);
        Lesson l = new Lesson();
        l.setModule(m);
        applyLesson(l, req);
        l.setPosition(m.getLessons().size() + 1);
        m.getLessons().add(l);
        modules.flush();
        return dto(m.getCourse());
    }

    @Transactional
    public CourseAdminDto updateLesson(Long lessonId, LessonRequest req) {
        Lesson l = lesson(lessonId);
        applyLesson(l, req);
        return dto(l.getModule().getCourse());
    }

    @Transactional
    public CourseAdminDto deleteLesson(Long lessonId) {
        Lesson l = lesson(lessonId);
        CourseModule m = l.getModule();
        progress.deleteByLesson(lessonId);
        m.getLessons().remove(l);
        renumberLessons(m.getLessons());
        return dto(m.getCourse());
    }

    @Transactional
    public CourseAdminDto reorderLessons(Long moduleId, List<Long> ids) {
        CourseModule m = module(moduleId);
        Map<Long, Lesson> byId = new HashMap<>();
        m.getLessons().forEach(l -> byId.put(l.getId(), l));
        if (!byId.keySet().equals(new HashSet<>(ids))) throw ApiException.badRequest("Send every lesson id exactly once");
        for (int i = 0; i < ids.size(); i++) byId.get(ids.get(i)).setPosition(i + 1);
        m.getLessons().sort(Comparator.comparingInt(Lesson::getPosition));
        return dto(m.getCourse());
    }

    // ---- helpers ----

    private void apply(Course c, CourseRequest req) {
        c.setTitle(req.title().trim());
        String slug = req.slug() == null || req.slug().isBlank() ? slugify(req.title()) : req.slug().trim();
        if (slug.isBlank()) slug = "course";
        if (!slug.equals(c.getSlug())) {
            String base = slug;
            int n = 2;
            while (courses.existsBySlug(slug)) slug = base + "-" + n++;
            c.setSlug(slug);
        }
        c.setSubtitle(blank(req.subtitle()));
        c.setDescription(blank(req.description()));
        c.setCategory(req.category());
        c.setValidityDays(req.validityDays());
        String cover = blank(req.coverImage());
        if (cover != null && !cover.startsWith("data:image/")) throw ApiException.badRequest("Cover must be an image");
        c.setCoverImage(cover);
    }

    private void applyLesson(Lesson l, LessonRequest req) {
        l.setTitle(req.title().trim());
        l.setType(req.type());
        l.setBody(blank(req.body()));
        l.setFreePreview(req.freePreview());
        l.setAsset(null);
        l.setExamId(null);
        switch (req.type()) {
            case VIDEO, DOCUMENT -> {
                if (req.assetId() == null) throw ApiException.badRequest("Pick a file from the media library");
                MediaAsset a = assets.findById(req.assetId()).orElseThrow(() -> ApiException.notFound("File not found"));
                MediaAsset.Kind want = req.type() == Lesson.Type.VIDEO ? MediaAsset.Kind.VIDEO : MediaAsset.Kind.DOCUMENT;
                if (a.getKind() != want) throw ApiException.badRequest("That file is a " + a.getKind().name().toLowerCase(Locale.ROOT));
                l.setAsset(a);
            }
            case QUIZ -> {
                if (req.examId() == null || !exams.existsById(req.examId())) throw ApiException.badRequest("Pick an assessment");
                l.setExamId(req.examId());
            }
            case ARTICLE -> {
                if (l.getBody() == null) throw ApiException.badRequest("Write the article text");
            }
        }
    }

    private Course find(Long id) {
        return courses.findById(id).orElseThrow(() -> ApiException.notFound("Course not found"));
    }

    private CourseModule module(Long id) {
        return modules.findById(id).orElseThrow(() -> ApiException.notFound("Module not found"));
    }

    private Lesson lesson(Long id) {
        return lessons.findById(id).orElseThrow(() -> ApiException.notFound("Lesson not found"));
    }

    private static void renumber(List<CourseModule> list) {
        for (int i = 0; i < list.size(); i++) list.get(i).setPosition(i + 1);
    }

    private static void renumberLessons(List<Lesson> list) {
        for (int i = 0; i < list.size(); i++) list.get(i).setPosition(i + 1);
    }

    static int duration(List<Lesson> list) {
        return list.stream().mapToInt(l -> l.getAsset() != null && l.getAsset().getDurationSeconds() != null
                ? l.getAsset().getDurationSeconds() : 0).sum();
    }

    static String slugify(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        n = n.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return n.length() > 80 ? n.substring(0, 80).replaceAll("-$", "") : n;
    }

    private static String blank(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    private CourseAdminDto dto(Course c) {
        Map<Long, String> examTitles = new HashMap<>();
        List<ModuleAdminDto> mods = c.getModules().stream()
                .sorted(Comparator.comparingInt(CourseModule::getPosition))
                .map(m -> new ModuleAdminDto(m.getId(), m.getTitle(), m.getPosition(), m.getLessons().stream()
                        .sorted(Comparator.comparingInt(Lesson::getPosition))
                        .map(l -> {
                            String examTitle = l.getExamId() == null ? null
                                    : examTitles.computeIfAbsent(l.getExamId(), id -> exams.findById(id).map(Exam::getTitle).orElse("(deleted)"));
                            MediaAsset a = l.getAsset();
                            return new LessonAdminDto(l.getId(), l.getTitle(), l.getType(), l.getPosition(),
                                    a == null ? null : a.getId(), a == null ? null : a.getTitle(), a == null ? null : a.getStatus(),
                                    a == null ? null : a.getDurationSeconds(), l.getBody(), l.getExamId(), examTitle, l.isFreePreview());
                        }).toList()))
                .toList();
        List<Lesson> all = c.getModules().stream().flatMap(m -> m.getLessons().stream()).toList();
        return new CourseAdminDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), c.getDescription(), c.getCategory(),
                c.getStatus(), c.getCoverImage(), c.getValidityDays(), c.getId() == null ? 0 : enrollments.countByCourseId(c.getId()),
                all.size(), duration(all), c.getCreatedAt(), mods);
    }
}
