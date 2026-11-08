package com.tanmaysinghx.qubit.exam;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "exam_slots")
@Getter
@Setter
@NoArgsConstructor
public class ExamSlot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Exam exam;

    @Column(nullable = false)
    private Instant startsAt;

    @Column(nullable = false)
    private int capacity = 100;

    @Column(length = 80)
    private String label;
}
