package com.tanmaysinghx.qubit.auth;

import com.tanmaysinghx.qubit.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    static final String PASSWORD_RULE = "^(?=.*[A-Za-z])(?=.*\\d).+$";
    static final String PASSWORD_MSG = "must contain at least one letter and one number";

    public record RegisterRequest(
            @NotBlank @Size(max = 120) String fullName,
            @NotBlank @Email @Size(max = 190) String email,
            @NotBlank @Size(min = 8, max = 72) @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MSG) String password,
            @Size(max = 20) String phone) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}

    public record VerifyRequest(@NotBlank String token) {}

    public record EmailRequest(@NotBlank @Email String email) {}

    public record ResetPasswordRequest(
            @NotBlank String token,
            @NotBlank @Size(min = 8, max = 72) @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MSG) String password) {}

    public record ProfileRequest(@NotBlank @Size(max = 120) String fullName, @Size(max = 20) String phone) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 8, max = 72) @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MSG) String newPassword) {}

    public record LoginResponse(String token, UserDto user) {}

    public record MessageResponse(String message) {}
}
