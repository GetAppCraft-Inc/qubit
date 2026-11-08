package com.tanmaysinghx.qubit.auth;

import com.tanmaysinghx.qubit.auth.AuthDtos.*;
import com.tanmaysinghx.qubit.security.CurrentUser;
import com.tanmaysinghx.qubit.user.UserDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;
    private final CurrentUser currentUser;

    @PostMapping("/api/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse register(@Valid @RequestBody RegisterRequest req) {
        auth.register(req);
        return new MessageResponse("Account created. Check your inbox to confirm your email.");
    }

    @PostMapping("/api/auth/verify")
    public MessageResponse verify(@Valid @RequestBody VerifyRequest req) {
        auth.verify(req.token());
        return new MessageResponse("Email confirmed. You can now sign in.");
    }

    @PostMapping("/api/auth/resend-verification")
    public MessageResponse resend(@Valid @RequestBody EmailRequest req) {
        auth.resendVerification(req.email());
        return new MessageResponse("If that account exists and is unconfirmed, a new link is on its way.");
    }

    @PostMapping("/api/auth/forgot-password")
    public MessageResponse forgot(@Valid @RequestBody EmailRequest req) {
        auth.forgotPassword(req.email());
        return new MessageResponse("If an account exists for that email, a reset link is on its way. It's valid for one hour.");
    }

    @PostMapping("/api/auth/reset-password")
    public MessageResponse reset(@Valid @RequestBody ResetPasswordRequest req) {
        auth.resetPassword(req);
        return new MessageResponse("Password updated. You can now sign in.");
    }

    @PostMapping("/api/auth/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest req) {
        return auth.login(req);
    }

    @GetMapping("/api/me")
    public UserDto me() {
        return UserDto.of(currentUser.get());
    }

    @PutMapping("/api/me")
    public UserDto updateProfile(@Valid @RequestBody ProfileRequest req) {
        return auth.updateProfile(currentUser.get().getId(), req);
    }

    @PostMapping("/api/me/password")
    public MessageResponse changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        auth.changePassword(currentUser.get().getId(), req);
        return new MessageResponse("Password changed.");
    }
}
