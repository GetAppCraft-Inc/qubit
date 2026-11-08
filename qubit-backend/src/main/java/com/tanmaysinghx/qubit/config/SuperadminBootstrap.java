package com.tanmaysinghx.qubit.config;

import com.tanmaysinghx.qubit.user.Role;
import com.tanmaysinghx.qubit.user.User;
import com.tanmaysinghx.qubit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/** Ensures the configured superadmin account exists (SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD). */
@Slf4j
@Component
@RequiredArgsConstructor
public class SuperadminBootstrap implements ApplicationRunner {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final QubitProperties props;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        var cfg = props.superadmin();
        if (cfg == null || cfg.email() == null || cfg.email().isBlank()) return;
        String email = cfg.email().trim().toLowerCase(Locale.ROOT);
        users.findByEmailIgnoreCase(email).ifPresentOrElse(existing -> {
            if (existing.getRole() != Role.QUBIT_SUPERADMIN) {
                existing.setRole(Role.QUBIT_SUPERADMIN);
                existing.setEmailVerified(true);
                log.info("Promoted {} to QUBIT_SUPERADMIN", email);
            }
        }, () -> {
            if (cfg.password() == null || cfg.password().isBlank()) {
                log.warn("SUPERADMIN_EMAIL set but SUPERADMIN_PASSWORD missing; superadmin not created");
                return;
            }
            User u = new User();
            u.setEmail(email);
            u.setFullName("Qubit Superadmin");
            u.setPasswordHash(passwordEncoder.encode(cfg.password()));
            u.setRole(Role.QUBIT_SUPERADMIN);
            u.setEmailVerified(true);
            users.save(u);
            log.info("Created superadmin account {}", email);
        });
    }
}
