package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.exam.ExamCategory;
import com.tanmaysinghx.qubit.media.MediaAsset;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;

public final class LmsDtos {
    private LmsDtos() {}

    // ---------- admin ----------

    public record CourseRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 120) @Pattern(regexp = "^[a-z0-9-]*$", message = "lowercase letters, numbers and dashes only") String slug,
            @Size(max = 300) String subtitle,
            String description,
            @NotNull ExamCategory category,
            @Min(1) @Max(3650) Integer validityDays,
            @Size(max = 700_000) String coverImage) {}

    public record ModuleRequest(@NotBlank @Size(max = 200) String title) {}

    public record LessonRequest(
            @NotBlank @Size(max = 200) String title,
            @NotNull Lesson.Type type,
            Long assetId,
            String body,
            Long examId,
            boolean freePreview,
            Long moduleId) {}

    public record ReorderRequest(@NotEmpty List<Long> ids) {}

    public record LessonAdminDto(Long id, String title, Lesson.Type type, int position, Long assetId, String assetTitle,
                                 MediaAsset.Status assetStatus, Integer durationSeconds, String body, Long examId,
                                 String examTitle, boolean freePreview) {}

    public record ModuleAdminDto(Long id, String title, int position, List<LessonAdminDto> lessons) {}

    public record CourseAdminDto(Long id, String slug, String title, String subtitle, String description,
                                 ExamCategory category, Course.Status status, String coverImage, Integer validityDays,
                                 long enrollments, int lessonCount, int totalDurationSeconds, Instant createdAt,
                                 List<ModuleAdminDto> modules) {}

    public record CourseSummaryDto(Long id, String slug, String title, ExamCategory category, Course.Status status,
                                   int moduleCount, int lessonCount, int totalDurationSeconds, long enrollments,
                                   Instant createdAt) {}

    // ---------- learner ----------

    public record CourseCardDto(Long id, String slug, String title, String subtitle, ExamCategory category,
                                String coverImage, int lessonCount, int totalDurationSeconds, boolean enrolled,
                                Integer progressPercent) {}

    public record CurriculumLesson(Long id, String title, Lesson.Type type, Integer durationSeconds, boolean freePreview,
                                   boolean completed, boolean locked) {}

    public record CurriculumModule(Long id, String title, List<CurriculumLesson> lessons) {}

    public record EnrollmentInfo(Instant enrolledAt, Instant expiresAt, boolean active) {}

    public record CourseDetailDto(CourseCardDto course, String description, Integer validityDays, EnrollmentInfo enrollment,
                                  List<CurriculumModule> modules, Long nextLessonId) {}

    public record MyCourseDto(CourseCardDto course, Instant enrolledAt, Instant expiresAt, Instant lastAccessedAt,
                              int completedLessons, Long nextLessonId, String nextLessonTitle) {}

    public record QuizInfo(Long examId, String examTitle, String mode, Long registrationId, String attemptStatus) {}

    public record LessonView(Long id, String title, Lesson.Type type, String courseSlug, String courseTitle,
                             String moduleTitle, String body, Integer durationSeconds, String documentUrl,
                             String posterUrl, QuizInfo quiz, int lastPositionSeconds, boolean completed,
                             Long prevLessonId, Long nextLessonId, List<CurriculumModule> curriculum,
                             int progressPercent) {}
}
