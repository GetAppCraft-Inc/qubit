package com.tanmaysinghx.qubit.security;

import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.user.User;
import com.tanmaysinghx.qubit.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CurrentUser {

    private final UserRepository users;

    public Long id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) throw ApiException.unauthorized("Not signed in");
        try {
            return Long.valueOf(auth.getName());
        } catch (NumberFormatException e) {
            throw ApiException.unauthorized("Not signed in");
        }
    }

    public User get() {
        return users.findById(id())
                .filter(User::isActive)
                .orElseThrow(() -> ApiException.unauthorized("Account is not active"));
    }
}
