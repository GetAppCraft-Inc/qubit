package com.tanmaysinghx.qubit.exam;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Figure for a question, kept out of the questions table so lists and papers load without the bytes. */
@Entity
@Table(name = "question_images")
@Getter
@Setter
@NoArgsConstructor
public class QuestionImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** data:image/…;base64,… */
    @Lob
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String data;

    public QuestionImage(String data) {
        this.data = data;
    }
}
