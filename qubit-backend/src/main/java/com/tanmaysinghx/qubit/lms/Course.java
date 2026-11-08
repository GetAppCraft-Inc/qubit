package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.exam.ExamCategory;
import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "courses")
@Getter
@Setter
@NoArgsConstructor
public class Course {

    public enum Status { DRAFT, PUBLISHED, ARCHIVED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String slug;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 300)
    private String subtitle;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ExamCategory category = ExamCategory.OTHER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.DRAFT;

    /** Cover as a data URL (small image). */
    @Lob
    @Basic(fetch = FetchType.LAZY)
    @Column(columnDefinition = "LONGTEXT")
    private String coverImage;

    /** Days of access after enrolling; null = lifetime. */
    private Integer validityDays;

    @ManyToOne(fetch = FetchType.LAZY)
    private User createdBy;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant updatedAt;

    @OneToMany(mappedBy = "course", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, id ASC")
    private List<CourseModule> modules = new ArrayList<>();
}
