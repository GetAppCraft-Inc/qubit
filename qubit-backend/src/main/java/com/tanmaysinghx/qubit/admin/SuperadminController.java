package com.tanmaysinghx.qubit.admin;

import com.tanmaysinghx.qubit.admin.AdminDtos.SystemInfo;
import com.tanmaysinghx.qubit.admin.AdminDtos.UserPatch;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.mail.MailService;
import com.tanmaysinghx.qubit.proctor.ProctorHub;
import com.tanmaysinghx.qubit.security.CurrentUser;
import com.tanmaysinghx.qubit.user.User;
import com.tanmaysinghx.qubit.user.UserDto;
import com.tanmaysinghx.qubit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.SpringBootVersion;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.time.Instant;
import java.util.List;

/** QUBIT_SUPERADMIN only: user & role management plus developer diagnostics. */
@RestController
@RequestMapping("/api/super")
@RequiredArgsConstructor
public class SuperadminController {

    private final UserRepository users;
    private final CurrentUser currentUser;
    private final DataSource dataSource;
    private final MailService mail;
    private final ProctorHub hub;

    @GetMapping("/users")
    public List<UserDto> users() {
        return users.findAllByOrderByCreatedAtDesc().stream().map(UserDto::of).toList();
    }

    @PatchMapping("/users/{id}")
    @Transactional
    public UserDto patch(@PathVariable Long id, @RequestBody UserPatch patch) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("User not found"));
        if (u.getId().equals(currentUser.id())) throw ApiException.badRequest("You can't change your own role or status");
        if (patch.role() != null) u.setRole(patch.role());
        if (patch.active() != null) u.setActive(patch.active());
        return UserDto.of(u);
    }

    @GetMapping("/system")
    public SystemInfo system() {
        boolean dbUp = false;
        String product = null;
        try (Connection c = dataSource.getConnection()) {
            dbUp = c.isValid(3);
            product = c.getMetaData().getDatabaseProductName() + " " + c.getMetaData().getDatabaseProductVersion();
        } catch (Exception ignored) {
            // reported as down
        }
        Runtime rt = Runtime.getRuntime();
        return new SystemInfo(System.getProperty("java.version"), SpringBootVersion.getVersion(), Instant.now().toString(),
                ManagementFactory.getRuntimeMXBean().getUptime() / 1000, dbUp, product, mail.isEnabled(),
                hub.candidateCount(), hub.monitorCount(), (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024),
                rt.maxMemory() / (1024 * 1024), rt.availableProcessors());
    }
}
