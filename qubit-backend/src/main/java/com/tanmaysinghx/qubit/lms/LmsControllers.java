package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.lms.LmsDtos.*;
import com.tanmaysinghx.qubit.media.MediaDtos.PlaybackInfo;
import com.tanmaysinghx.qubit.media.MediaDtos.PlaybackRequest;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/courses")
@RequiredArgsConstructor
class CourseAdminController {

    private final CourseAdminService service;

    @GetMapping public List<CourseSummaryDto> list() { return service.list(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseAdminDto create(@Valid @RequestBody CourseRequest req) { return service.create(req); }

    @GetMapping("/{id}") public CourseAdminDto get(@PathVariable Long id) { return service.get(id); }

    @PutMapping("/{id}") public CourseAdminDto update(@PathVariable Long id, @Valid @RequestBody CourseRequest req) { return service.update(id, req); }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { service.delete(id); }

    @PostMapping("/{id}/status/{status}")
    public CourseAdminDto status(@PathVariable Long id, @PathVariable Course.Status status) { return service.setStatus(id, status); }

    @PostMapping("/{id}/modules") public CourseAdminDto addModule(@PathVariable Long id, @Valid @RequestBody ModuleRequest req) { return service.addModule(id, req); }

    @PutMapping("/{id}/modules/order") public CourseAdminDto orderModules(@PathVariable Long id, @Valid @RequestBody ReorderRequest req) { return service.reorderModules(id, req.ids()); }

    @PutMapping("/modules/{moduleId}") public CourseAdminDto renameModule(@PathVariable Long moduleId, @Valid @RequestBody ModuleRequest req) { return service.renameModule(moduleId, req); }

    @DeleteMapping("/modules/{moduleId}") public CourseAdminDto deleteModule(@PathVariable Long moduleId) { return service.deleteModule(moduleId); }

    @PostMapping("/modules/{moduleId}/lessons") public CourseAdminDto addLesson(@PathVariable Long moduleId, @Valid @RequestBody LessonRequest req) { return service.addLesson(moduleId, req); }

    @PutMapping("/modules/{moduleId}/lessons/order") public CourseAdminDto orderLessons(@PathVariable Long moduleId, @Valid @RequestBody ReorderRequest req) { return service.reorderLessons(moduleId, req.ids()); }

    @PutMapping("/lessons/{lessonId}") public CourseAdminDto updateLesson(@PathVariable Long lessonId, @Valid @RequestBody LessonRequest req) { return service.updateLesson(lessonId, req); }

    @DeleteMapping("/lessons/{lessonId}") public CourseAdminDto deleteLesson(@PathVariable Long lessonId) { return service.deleteLesson(lessonId); }
}

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
class LearnController {

    private final LearnService service;

    @GetMapping("/courses") public List<CourseCardDto> catalog() { return service.catalog(); }

    @GetMapping("/courses/{slug}") public CourseDetailDto course(@PathVariable String slug) { return service.detail(slug); }

    @PostMapping("/courses/{slug}/enroll") public CourseDetailDto enroll(@PathVariable String slug) { return service.enroll(slug); }

    @GetMapping("/learn") public List<MyCourseDto> mine() { return service.myCourses(); }

    @GetMapping("/learn/lessons/{id}") public LessonView lesson(@PathVariable Long id) { return service.lesson(id); }

    @PostMapping("/learn/lessons/{id}/complete")
    public LessonView complete(@PathVariable Long id, @RequestBody(required = false) Map<String, Boolean> body) {
        return service.markComplete(id, body == null || !Boolean.FALSE.equals(body.get("completed")));
    }

    @PostMapping("/learn/lessons/{id}/playback")
    public PlaybackInfo playback(@PathVariable Long id, @Valid @RequestBody PlaybackRequest req, HttpServletRequest http) {
        String ip = http.getHeader("X-Forwarded-For");
        return service.startPlayback(id, req.deviceId(), ip == null || ip.isBlank() ? http.getRemoteAddr() : ip, http.getHeader("User-Agent"));
    }
}
