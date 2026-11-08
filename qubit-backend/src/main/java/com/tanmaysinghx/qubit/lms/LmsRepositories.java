package com.tanmaysinghx.qubit.lms;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

interface CourseRepository extends JpaRepository<Course, Long> {
    Optional<Course> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<Course> findAllByOrderByCreatedAtDesc();
    List<Course> findByStatusOrderByCreatedAtDesc(Course.Status status);
}

interface CourseModuleRepository extends JpaRepository<CourseModule, Long> {}

interface LessonRepository extends JpaRepository<Lesson, Long> {
    boolean existsByAssetId(Long assetId);

    @Query("select count(l) from Lesson l where l.module.course.id = :courseId")
    long countByCourse(Long courseId);
}

interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {
    Optional<Enrollment> findByUserIdAndCourseId(Long userId, Long courseId);

    @Query("select e from Enrollment e join fetch e.course where e.user.id = :userId order by e.enrolledAt desc")
    List<Enrollment> findForUser(Long userId);

    long countByCourseId(Long courseId);
}

interface LessonProgressRepository extends JpaRepository<LessonProgress, Long> {
    Optional<LessonProgress> findByUserIdAndLessonId(Long userId, Long lessonId);

    @Query("select p from LessonProgress p where p.user.id = :userId and p.lesson.module.course.id = :courseId")
    List<LessonProgress> findForCourse(Long userId, Long courseId);

    @Query("select count(p) from LessonProgress p where p.lesson.module.course.id = :courseId and p.completed = true")
    long countCompletedInCourse(Long courseId);

    @Modifying
    @Query("delete from LessonProgress p where p.lesson.id = :lessonId")
    void deleteByLesson(Long lessonId);

    @Modifying
    @Query("delete from LessonProgress p where p.lesson.id in (select l.id from Lesson l where l.module.id = :moduleId)")
    void deleteByModule(Long moduleId);

    @Modifying
    @Query("delete from LessonProgress p where p.lesson.id in (select l.id from Lesson l where l.module.course.id = :courseId)")
    void deleteByCourse(Long courseId);
}
