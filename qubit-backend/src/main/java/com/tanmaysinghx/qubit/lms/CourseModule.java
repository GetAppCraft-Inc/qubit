package com.tanmaysinghx.qubit.lms;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "course_modules")
@Getter
@Setter
@NoArgsConstructor
public class CourseModule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Course course;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private int position;

    @OneToMany(mappedBy = "module", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, id ASC")
    private List<Lesson> lessons = new ArrayList<>();
}
