package com.tanmaysinghx.qubit.auth;

import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "email_tokens")
@Getter
@Setter
@NoArgsConstructor
public class EmailToken {

    public enum Purpose { VERIFY_EMAIL, RESET_PASSWORD }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String token;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;

    /** Nullable for rows created before this column existed; null means VERIFY_EMAIL. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Purpose purpose;

    @Column(nullable = false)
    private Instant expiresAt;

    private Instant usedAt;

    public Purpose effectivePurpose() {
        return purpose == null ? Purpose.VERIFY_EMAIL : purpose;
    }
}
