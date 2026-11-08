package com.tanmaysinghx.qubit.registration;

import com.tanmaysinghx.qubit.registration.CandidateDtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CandidateController {

    private final CandidateService service;

    @GetMapping("/exams")
    public List<PublicExamDto> exams() {
        return service.listExams();
    }

    @GetMapping("/exams/{id}")
    public PublicExamDetailDto exam(@PathVariable Long id) {
        return service.examDetail(id);
    }

    @PostMapping("/exams/{id}/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegistrationDto register(@PathVariable Long id, @Valid @RequestBody SlotChoice body) {
        return service.register(id, body.slotId());
    }

    @GetMapping("/registrations")
    public List<RegistrationDto> registrations() {
        return service.myRegistrations();
    }

    @GetMapping("/registrations/{id}")
    public RegistrationDto registration(@PathVariable Long id) {
        return service.myRegistration(id);
    }

    @PutMapping("/registrations/{id}/slot")
    public RegistrationDto reschedule(@PathVariable Long id, @Valid @RequestBody SlotChoice body) {
        return service.reschedule(id, body.slotId());
    }
}
