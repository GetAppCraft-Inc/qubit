package com.tanmaysinghx.qubit.exam;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "questions")
@Getter
@Setter
@NoArgsConstructor
public class Question {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Exam exam;

    @Column(nullable = false, length = 60)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private QuestionType type = QuestionType.SINGLE;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "question_options", joinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "option_index")
    @Column(name = "option_text", columnDefinition = "TEXT")
    private List<String> options = new ArrayList<>();

    /** SINGLE: "2" ; MULTIPLE: "0,2" ; NUMERIC: "42.5" */
    @Column(nullable = false, length = 120)
    private String correctAnswer;

    @Column(nullable = false)
    private int marks = 4;

    /** Marks deducted for a wrong answer (stored positive). */
    @Column(nullable = false)
    private int negativeMarks = 1;

    @Column(nullable = false)
    private int position;

    /** Optional heading shown above the question, e.g. "Section 2 · One or more correct". */
    @Column(length = 120)
    private String section;

    /** Optional figure; lazily loaded and served through a signed URL. */
    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "image_id")
    private QuestionImage image;

    public boolean hasImage() {
        return image != null;
    }

    /** MULTIPLE only: JEE Advanced style partial marks (+1 per correct option chosen when no wrong option is chosen). */
    private Boolean partialMarking;

    /** NUMERIC only: accepted absolute deviation from the key (e.g. 0.01 for "round to two decimals"). */
    private Double answerTolerance;

    public boolean isPartialMarking() {
        return Boolean.TRUE.equals(partialMarking);
    }

    public double tolerance() {
        return answerTolerance == null ? 0 : answerTolerance;
    }
}
