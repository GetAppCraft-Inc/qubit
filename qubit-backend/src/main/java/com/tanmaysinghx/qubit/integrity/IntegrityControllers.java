package com.tanmaysinghx.qubit.integrity;

import com.tanmaysinghx.qubit.integrity.IntegrityService.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

final class IntegrityControllers {
    private IntegrityControllers() {}

    @RestController
    @RequestMapping("/api/admin")
    @RequiredArgsConstructor
    static class StaffIntegrityController {
        private final IntegrityService service;

        @GetMapping("/integrity/summary")
        public Summary summary() { return service.summary(); }

        @GetMapping("/integrity/cases")
        public List<CaseRow> cases(@RequestParam(required = false) String status) { return service.cases(status); }

        @PostMapping("/integrity/cases/{id}/cancel")
        public CaseRow cancel(@PathVariable Long id, @RequestBody(required = false) DecisionRequest req) {
            return service.cancelCase(id, req == null ? null : req.note());
        }

        @PostMapping("/integrity/cases/{id}/dismiss")
        public CaseRow dismiss(@PathVariable Long id, @RequestBody(required = false) DecisionRequest req) {
            return service.dismissCase(id, req == null ? null : req.note());
        }

        @GetMapping("/appeals")
        public List<AppealRow> appeals() { return service.appeals(); }

        @PostMapping("/appeals/{id}/approve")
        public AppealRow approve(@PathVariable Long id, @RequestBody(required = false) ApproveRequest req) {
            return service.approve(id, req == null ? null : req.note(), req == null ? null : req.hours());
        }

        @PostMapping("/appeals/{id}/reject")
        public AppealRow reject(@PathVariable Long id, @RequestBody(required = false) DecisionRequest req) {
            return service.reject(id, req == null ? null : req.note());
        }
    }

    @RestController
    @RequestMapping("/api/registrations")
    @RequiredArgsConstructor
    static class CandidateAppealController {
        private final IntegrityService service;

        @PostMapping("/{id}/appeal")
        @ResponseStatus(HttpStatus.CREATED)
        public AppealRow appeal(@PathVariable Long id, @RequestBody AppealRequest req) {
            return service.submitAppeal(id, req.message());
        }
    }
}
