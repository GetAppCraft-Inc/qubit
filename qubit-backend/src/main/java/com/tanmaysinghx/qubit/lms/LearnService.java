package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.attempt.AttemptRepository;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.exam.ExamRepository;
import com.tanmaysinghx.qubit.lms.LmsDtos.*;
import com.tanmaysinghx.qubit.media.MediaAsset;
import com.tanmaysinghx.qubit.media.MediaDtos.PlaybackInfo;
import com.tanmaysinghx.qubit.media.MediaService;
import com.tanmaysinghx.qubit.media.PlaybackService;
import com.tanmaysinghx.qubit.registration.RegistrationRepository;
import com.tanmaysinghx.qubit.security.CurrentUser;
import com.tanmaysinghx.qubit.user.User;
import com.tanmaysinghx.qubit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LearnService implements PlaybackService.ProgressSink {

    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final EnrollmentRepository enrollments;
    private final LessonProgressRepository progress;
    private final UserRepository users;
    private final ExamRepository exams;
    private final RegistrationRepository registrations;
    private final AttemptRepository attempts;
    private final MediaService media;
    private final PlaybackService playback;
    private final CurrentUser currentUser;

    // ------------------------------------------------------------ catalog

    @Transactional(readOnly = true)
    public List<CourseCardDto> catalog() {
        Long uid = currentUser.id();
        Map<Long, Enrollment> mine = enrollments.findForUser(uid).stream()
                .collect(Collectors.toMap(e -> e.getCourse().getId(), Function.identity()));
        return courses.findByStatusOrderByCreatedAtDesc(Course.Status.PUBLISHED).stream()
                .map(c -> card(c, mine.get(c.getId()), uid)).toList();
    }

    @Transactional(readOnly = true)
    public CourseDetailDto detail(String slug) {
        User u = currentUser.get();
        Course c = visible(slug, u);
        Enrollment e = enrollments.findByUserIdAndCourseId(u.getId(), c.getId()).orElse(null);
        boolean access = hasCourseAccess(u, c, e);
        Set<Long> done = completedIds(u.getId(), c.getId());
        List<CurriculumModule> curriculum = curriculum(c, done, access);
        return new CourseDetailDto(card(c, e, u.getId()), c.getDescription(), c.getValidityDays(),
                e == null ? null : new EnrollmentInfo(e.getEnrolledAt(), e.getExpiresAt(), e.isActive(Instant.now())),
                curriculum, nextLesson(c, done));
    }

    @Transactional
    public CourseDetailDto enroll(String slug) {
        User u = currentUser.get();
        Course c = courses.findBySlug(slug).filter(x -> x.getStatus() == Course.Status.PUBLISHED)
                .orElseThrow(() -> ApiException.notFound("Course not found"));
        Enrollment e = enrollments.findByUserIdAndCourseId(u.getId(), c.getId()).orElse(null);
        Instant now = Instant.now();
        if (e != null && e.isActive(now)) return detail(slug);
        if (e != null && e.isRevoked()) throw ApiException.forbidden("Your access to this course was removed. Contact support.");
        if (e == null) {
            e = new Enrollment();
            e.setUser(u);
            e.setCourse(c);
        }
        e.setEnrolledAt(now);
        e.setExpiresAt(c.getValidityDays() == null ? null : now.plus(c.getValidityDays(), ChronoUnit.DAYS));
        enrollments.save(e);
        return detail(slug);
    }

    @Transactional(readOnly = true)
    public List<MyCourseDto> myCourses() {
        Long uid = currentUser.id();
        Instant now = Instant.now();
        return enrollments.findForUser(uid).stream()
                .filter(e -> e.getCourse().getStatus() != Course.Status.DRAFT)
                .map(e -> {
                    Course c = e.getCourse();
                    Set<Long> done = completedIds(uid, c.getId());
                    Long next = nextLesson(c, done);
                    String nextTitle = next == null ? null : lessons.findById(next).map(Lesson::getTitle).orElse(null);
                    return new MyCourseDto(card(c, e, uid), e.getEnrolledAt(), e.getExpiresAt(), e.getLastAccessedAt(),
                            done.size(), e.isActive(now) ? next : null, nextTitle);
                }).toList();
    }

    // ------------------------------------------------------------ lessons

    @Transactional
    public LessonView lesson(Long lessonId) {
        User u = currentUser.get();
        Lesson l = lessons.findById(lessonId).orElseThrow(() -> ApiException.notFound("Lesson not found"));
        Course c = l.getModule().getCourse();
        Enrollment e = authorize(u, l);
        if (e != null) e.setLastAccessedAt(Instant.now());

        LessonProgress p = progress.findByUserIdAndLessonId(u.getId(), l.getId()).orElse(null);
        Set<Long> done = completedIds(u.getId(), c.getId());
        List<Lesson> ordered = ordered(c);
        int idx = ordered.indexOf(l);
        MediaAsset a = l.getAsset();

        QuizInfo quiz = null;
        if (l.getType() == Lesson.Type.QUIZ && l.getExamId() != null) {
            var exam = exams.findById(l.getExamId()).orElse(null);
            if (exam != null) {
                var reg = registrations.findByUserIdAndExamId(u.getId(), exam.getId()).orElse(null);
                String status = reg == null ? null : attempts.findByRegistrationId(reg.getId()).map(x -> x.getStatus().name()).orElse(reg.getStatus().name());
                quiz = new QuizInfo(exam.getId(), exam.getTitle(), exam.effectiveMode().name(), reg == null ? null : reg.getId(), status);
            }
        }
        boolean access = hasCourseAccess(u, c, e);
        int total = ordered.size();
        return new LessonView(l.getId(), l.getTitle(), l.getType(), c.getSlug(), c.getTitle(), l.getModule().getTitle(),
                l.getBody(), a == null ? null : a.getDurationSeconds(),
                l.getType() == Lesson.Type.DOCUMENT && a != null && a.getStatus() == MediaAsset.Status.READY ? media.documentUrl(a) : null,
                a == null || l.getType() != Lesson.Type.VIDEO ? null : media.posterUrl(a),
                quiz, p == null ? 0 : p.getLastPositionSeconds(), p != null && p.isCompleted(),
                idx > 0 ? ordered.get(idx - 1).getId() : null, idx >= 0 && idx < total - 1 ? ordered.get(idx + 1).getId() : null,
                curriculum(c, done, access), total == 0 ? 0 : (int) Math.round(100.0 * done.size() / total));
    }

    @Transactional
    public PlaybackInfo startPlayback(Long lessonId, String deviceId, String ip, String ua) {
        User u = currentUser.get();
        Lesson l = lessons.findById(lessonId).orElseThrow(() -> ApiException.notFound("Lesson not found"));
        authorize(u, l);
        if (l.getType() != Lesson.Type.VIDEO || l.getAsset() == null) throw ApiException.badRequest("This lesson has no video");
        int resume = progress.findByUserIdAndLessonId(u.getId(), lessonId)
                .filter(p -> !p.isCompleted()).map(LessonProgress::getLastPositionSeconds).orElse(0);
        return playback.start(u, l.getAsset(), lessonId, deviceId, ip, ua, resume);
    }

    @Transactional
    public LessonView markComplete(Long lessonId, boolean completed) {
        User u = currentUser.get();
        Lesson l = lessons.findById(lessonId).orElseThrow(() -> ApiException.notFound("Lesson not found"));
        authorize(u, l);
        LessonProgress p = progressFor(u, l);
        p.setCompleted(completed);
        p.setCompletedAt(completed ? Instant.now() : null);
        p.setUpdatedAt(Instant.now());
        progress.save(p);
        return lesson(lessonId);
    }

    /** Heartbeats from the player. */
    @Override
    @Transactional
    public void recordVideoProgress(Long userId, Long lessonId, double position, int watchedDelta, Integer duration, boolean ended) {
        Lesson l = lessons.findById(lessonId).orElse(null);
        User u = users.findById(userId).orElse(null);
        if (l == null || u == null) return;
        LessonProgress p = progressFor(u, l);
        p.setLastPositionSeconds((int) Math.max(0, position));
        p.setWatchedSeconds(p.getWatchedSeconds() + watchedDelta);
        p.setUpdatedAt(Instant.now());
        if (!p.isCompleted() && duration != null && duration > 0
                && (ended || position >= duration * 0.9 || p.getWatchedSeconds() >= duration * 0.9)) {
            p.setCompleted(true);
            p.setCompletedAt(Instant.now());
        }
        progress.save(p);
    }

    // ------------------------------------------------------------ helpers

    /** Returns the enrollment (null for staff / free previews), or throws. */
    private Enrollment authorize(User u, Lesson l) {
        Course c = l.getModule().getCourse();
        if (u.getRole().isStaff()) return enrollments.findByUserIdAndCourseId(u.getId(), c.getId()).orElse(null);
        if (c.getStatus() != Course.Status.PUBLISHED && c.getStatus() != Course.Status.ARCHIVED) throw ApiException.notFound("Lesson not found");
        Enrollment e = enrollments.findByUserIdAndCourseId(u.getId(), c.getId()).orElse(null);
        if (e != null && e.isActive(Instant.now())) return e;
        if (l.isFreePreview() && c.getStatus() == Course.Status.PUBLISHED) return null;
        throw ApiException.forbidden(e != null && !e.isRevoked() ? "Your access to this course has expired" : "Enroll in the course to open this lesson");
    }

    private boolean hasCourseAccess(User u, Course c, Enrollment e) {
        return u.getRole().isStaff() || (e != null && e.isActive(Instant.now()));
    }

    private Course visible(String slug, User u) {
        Course c = courses.findBySlug(slug).orElseThrow(() -> ApiException.notFound("Course not found"));
        if (c.getStatus() == Course.Status.PUBLISHED || u.getRole().isStaff()) return c;
        if (c.getStatus() == Course.Status.ARCHIVED && enrollments.findByUserIdAndCourseId(u.getId(), c.getId()).isPresent()) return c;
        throw ApiException.notFound("Course not found");
    }

    private LessonProgress progressFor(User u, Lesson l) {
        return progress.findByUserIdAndLessonId(u.getId(), l.getId()).orElseGet(() -> {
            LessonProgress p = new LessonProgress();
            p.setUser(u);
            p.setLesson(l);
            return p;
        });
    }

    private Set<Long> completedIds(Long userId, Long courseId) {
        return progress.findForCourse(userId, courseId).stream().filter(LessonProgress::isCompleted)
                .map(p -> p.getLesson().getId()).collect(Collectors.toSet());
    }

    private static List<Lesson> ordered(Course c) {
        return c.getModules().stream().sorted(Comparator.comparingInt(CourseModule::getPosition))
                .flatMap(m -> m.getLessons().stream().sorted(Comparator.comparingInt(Lesson::getPosition))).toList();
    }

    private static Long nextLesson(Course c, Set<Long> done) {
        List<Lesson> all = ordered(c);
        return all.stream().filter(l -> !done.contains(l.getId())).findFirst()
                .or(() -> all.stream().findFirst()).map(Lesson::getId).orElse(null);
    }

    private static List<CurriculumModule> curriculum(Course c, Set<Long> done, boolean access) {
        return c.getModules().stream().sorted(Comparator.comparingInt(CourseModule::getPosition))
                .map(m -> new CurriculumModule(m.getId(), m.getTitle(), m.getLessons().stream()
                        .sorted(Comparator.comparingInt(Lesson::getPosition))
                        .map(l -> new CurriculumLesson(l.getId(), l.getTitle(), l.getType(),
                                l.getAsset() == null ? null : l.getAsset().getDurationSeconds(), l.isFreePreview(),
                                done.contains(l.getId()), !access && !l.isFreePreview()))
                        .toList()))
                .toList();
    }

    private CourseCardDto card(Course c, Enrollment e, Long userId) {
        List<Lesson> all = ordered(c);
        boolean enrolled = e != null && e.isActive(Instant.now());
        Integer pct = null;
        if (e != null && !all.isEmpty()) pct = (int) Math.round(100.0 * completedIds(userId, c.getId()).size() / all.size());
        return new CourseCardDto(c.getId(), c.getSlug(), c.getTitle(), c.getSubtitle(), c.getCategory(), c.getCoverImage(),
                all.size(), CourseAdminService.duration(all), enrolled, pct);
    }
}
