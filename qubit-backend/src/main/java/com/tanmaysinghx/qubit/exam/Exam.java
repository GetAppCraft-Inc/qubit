package com.tanmaysinghx.qubit.exam;

import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "exams")
@Getter
@Setter
@NoArgsConstructor
public class Exam {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ExamCategory category = ExamCategory.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ExamStatus status = ExamStatus.DRAFT;

    @Column(nullable = false)
    private int durationMinutes = 180;

    /** Minutes after slot start during which a candidate may still begin. */
    @Column(nullable = false)
    private int lateEntryMinutes = 15;

    /** Number of integrity violations tolerated before the attempt is terminated. 0 = terminate on first. */
    @Column(nullable = false)
    private int violationTolerance = 0;

    private boolean showResults = true;

    /** Nullable so the column can be added to existing rows; null means PROCTORED. */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private ExamMode mode;

    /** Optional endpoint notified (signed POST) whenever an attempt on this exam finishes. */
    @Column(length = 500)
    private String webhookUrl;

    @Column(length = 64)
    private String webhookSecret;

    private Instant registrationOpensAt;
    private Instant registrationClosesAt;

    @ManyToOne(fetch = FetchType.LAZY)
    private User createdBy;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant updatedAt;

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("startsAt ASC")
    private List<ExamSlot> slots = new ArrayList<>();

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, id ASC")
    private List<Question> questions = new ArrayList<>();

    public ExamMode effectiveMode() {
        return mode == null ? ExamMode.PROCTORED : mode;
    }

    public boolean isOpenMode() {
        return effectiveMode() == ExamMode.OPEN;
    }

    /** For OPEN exams: when the form accepts responses. */
    public Instant windowOpensAt() {
        return registrationOpensAt != null ? registrationOpensAt : createdAt;
    }

    public Instant windowClosesAt() {
        return registrationClosesAt != null ? registrationClosesAt : Instant.parse("2100-01-01T00:00:00Z");
    }

    public boolean isRegistrationOpen(Instant now) {
        return status == ExamStatus.PUBLISHED
                && (registrationOpensAt == null || !now.isBefore(registrationOpensAt))
                && (registrationClosesAt == null || now.isBefore(registrationClosesAt));
    }

    public int totalMarks() {
        return questions.stream().mapToInt(Question::getMarks).sum();
    }
}
