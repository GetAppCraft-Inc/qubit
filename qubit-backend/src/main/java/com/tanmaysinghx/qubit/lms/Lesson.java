package com.tanmaysinghx.qubit.lms;

import com.tanmaysinghx.qubit.media.MediaAsset;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "lessons")
@Getter
@Setter
@NoArgsConstructor
public class Lesson {

    public enum Type { VIDEO, DOCUMENT, ARTICLE, QUIZ }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private CourseModule module;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Type type;

    @Column(nullable = false)
    private int position;

    /** VIDEO / DOCUMENT */
    @ManyToOne(fetch = FetchType.LAZY)
    private MediaAsset asset;

    /** ARTICLE body (plain text with $LaTeX$), or notes under a video. */
    @Column(columnDefinition = "TEXT")
    private String body;

    /** QUIZ: an exam (usually an open quiz) taken from inside the course. */
    private Long examId;

    /** Visible to everyone, without enrolling. */
    private boolean freePreview;
}
