package com.tanmaysinghx.qubit.registration;

import com.tanmaysinghx.qubit.exam.Exam;
import com.tanmaysinghx.qubit.exam.ExamSlot;
import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "registrations", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "exam_id"}))
@Getter
@Setter
@NoArgsConstructor
public class Registration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Exam exam;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private ExamSlot slot;

    @Column(nullable = false, unique = true, length = 20)
    private String hallTicketNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RegistrationStatus status = RegistrationStatus.REGISTERED;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
