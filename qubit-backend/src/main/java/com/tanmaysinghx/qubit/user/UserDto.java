package com.tanmaysinghx.qubit.user;

import java.time.Instant;

public record UserDto(Long id, String email, String fullName, String phone, Role role,
                      boolean emailVerified, boolean active, Instant createdAt, Instant lastLoginAt) {
    public static UserDto of(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(), u.getRole(),
                u.isEmailVerified(), u.isActive(), u.getCreatedAt(), u.getLastLoginAt());
    }
}
