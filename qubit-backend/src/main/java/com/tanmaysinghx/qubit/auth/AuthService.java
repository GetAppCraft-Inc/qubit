package com.tanmaysinghx.qubit.auth;

import com.tanmaysinghx.qubit.auth.AuthDtos.*;
import com.tanmaysinghx.qubit.auth.EmailToken.Purpose;
import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.mail.MailService;
import com.tanmaysinghx.qubit.security.TokenService;
import com.tanmaysinghx.qubit.user.Role;
import com.tanmaysinghx.qubit.user.User;
import com.tanmaysinghx.qubit.user.UserDto;
import com.tanmaysinghx.qubit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration VERIFY_TTL = Duration.ofHours(24);
    private static final Duration RESET_TTL = Duration.ofHours(1);

    private final UserRepository users;
    private final EmailTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final MailService mail;

    @Transactional
    public void register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with this email already exists");
        }
        User user = new User();
        user.setEmail(email);
        user.setFullName(req.fullName().trim());
        user.setPhone(blankToNull(req.phone()));
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(Role.QUBIT_USER);
        users.save(user);
        EmailToken t = issue(user, Purpose.VERIFY_EMAIL, VERIFY_TTL);
        mail.sendVerification(user.getEmail(), user.getFullName(), t.getToken());
    }

    @Transactional
    public void resendVerification(String email) {
        users.findByEmailIgnoreCase(email.trim())
                .filter(u -> !u.isEmailVerified() && u.isActive())
                .ifPresent(u -> mail.sendVerification(u.getEmail(), u.getFullName(),
                        issue(u, Purpose.VERIFY_EMAIL, VERIFY_TTL).getToken()));
    }

    @Transactional
    public void verify(String token) {
        EmailToken t = tokens.findByToken(token)
                .filter(x -> x.effectivePurpose() == Purpose.VERIFY_EMAIL)
                .orElseThrow(() -> ApiException.badRequest("This verification link is invalid"));
        User user = t.getUser();
        if (user.isEmailVerified()) return;
        if (t.getUsedAt() != null || t.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("This verification link has expired. Request a new one from the sign-in page.");
        }
        t.setUsedAt(Instant.now());
        user.setEmailVerified(true);
        mail.sendWelcome(user.getEmail(), user.getFullName());
    }

    /** Always succeeds from the caller's point of view so accounts can't be enumerated. */
    @Transactional
    public void forgotPassword(String email) {
        users.findByEmailIgnoreCase(email.trim())
                .filter(User::isActive)
                .ifPresent(u -> mail.sendPasswordReset(u.getEmail(), u.getFullName(),
                        issue(u, Purpose.RESET_PASSWORD, RESET_TTL).getToken()));
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest req) {
        EmailToken t = tokens.findByToken(req.token())
                .filter(x -> x.effectivePurpose() == Purpose.RESET_PASSWORD)
                .orElseThrow(() -> ApiException.badRequest("This reset link is invalid"));
        if (t.getUsedAt() != null || t.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("This reset link has expired. Request a new one.");
        }
        User user = t.getUser();
        t.setUsedAt(Instant.now());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        // Following a link from the inbox proves ownership of the address.
        user.setEmailVerified(true);
    }

    @Transactional
    public LoginResponse login(LoginRequest req) {
        User user = users.findByEmailIgnoreCase(req.email().trim())
                .filter(u -> passwordEncoder.matches(req.password(), u.getPasswordHash()))
                .orElseThrow(() -> ApiException.unauthorized("Incorrect email or password"));
        if (!user.isActive()) {
            throw ApiException.forbidden("This account has been suspended. Contact support.");
        }
        if (!user.isEmailVerified()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED",
                    "Please confirm your email before signing in. We've sent you a link.");
        }
        user.setLastLoginAt(Instant.now());
        return new LoginResponse(tokenService.issue(user), UserDto.of(user));
    }

    @Transactional
    public UserDto updateProfile(Long userId, ProfileRequest req) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("Not signed in"));
        u.setFullName(req.fullName().trim());
        u.setPhone(blankToNull(req.phone()));
        return UserDto.of(u);
    }

    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("Not signed in"));
        if (!passwordEncoder.matches(req.currentPassword(), u.getPasswordHash())) {
            throw ApiException.badRequest("Your current password is incorrect");
        }
        if (req.currentPassword().equals(req.newPassword())) {
            throw ApiException.badRequest("Choose a password you haven't used here before");
        }
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
    }

    private EmailToken issue(User user, Purpose purpose, Duration ttl) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        EmailToken t = new EmailToken();
        t.setUser(user);
        t.setPurpose(purpose);
        t.setToken(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
        t.setExpiresAt(Instant.now().plus(ttl));
        return tokens.save(t);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
