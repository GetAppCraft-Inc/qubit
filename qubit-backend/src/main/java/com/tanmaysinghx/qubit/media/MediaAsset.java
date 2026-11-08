package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "media_assets")
@Getter
@Setter
@NoArgsConstructor
public class MediaAsset {

    public enum Kind { VIDEO, DOCUMENT, IMAGE }

    public enum Status { UPLOADING, QUEUED, PROCESSING, READY, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Kind kind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status = Status.UPLOADING;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 255)
    private String originalName;

    @Column(nullable = false, length = 120)
    private String contentType;

    private long sizeBytes;

    /** Object key of the uploaded original. */
    @Column(nullable = false, length = 300)
    private String sourceKey;

    @Column(length = 200)
    private String uploadId;

    /** 0–100 while processing. */
    private int progress;

    @Column(length = 500)
    private String error;

    private Integer durationSeconds;
    private Integer width;
    private Integer height;

    /** e.g. "2160,1440,1080,720,480,360,240" */
    @Column(length = 80)
    private String renditions;

    /** Key prefix of the packaged HLS output, e.g. videos/12/hls/ */
    @Column(length = 200)
    private String hlsPrefix;

    @Column(length = 300)
    private String posterKey;

    /** AES-128 content key, wrapped with the master key (see KeyVault). */
    @Column(length = 200)
    private String wrappedKey;

    @Column(length = 40)
    private String encoder;

    @ManyToOne(fetch = FetchType.LAZY)
    private User createdBy;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant readyAt;
}
