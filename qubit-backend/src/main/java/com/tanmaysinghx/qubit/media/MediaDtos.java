package com.tanmaysinghx.qubit.media;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class MediaDtos {
    private MediaDtos() {}

    public record UploadRequest(@NotBlank @Size(max = 255) String fileName, @Min(1) long size,
                                @NotBlank @Size(max = 120) String contentType, @Size(max = 255) String title) {}

    public record UploadPlan(Long assetId, long partSize, List<String> partUrls) {}

    public record CompleteRequest(@NotEmpty List<ObjectStorage.Part> parts) {}

    public record MediaDto(Long id, MediaAsset.Kind kind, MediaAsset.Status status, String title, String originalName,
                           String contentType, long sizeBytes, int progress, String error, Integer durationSeconds,
                           Integer width, Integer height, List<Integer> renditions, String encoder, String posterUrl,
                           Instant createdAt, Instant readyAt, boolean inUse) {}

    public record PlaybackRequest(@NotBlank @Size(max = 64) String deviceId) {}

    public record PlaybackInfo(String token, String manifestUrl, String posterUrl, Integer durationSeconds,
                               List<Integer> renditions, int resumeAt, String watermark, Instant expiresAt) {}

    public record Heartbeat(double position, int watchedDelta, boolean ended) {}
}
