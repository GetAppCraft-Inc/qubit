package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.media.MediaDtos.*;
import com.tanmaysinghx.qubit.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    static final long PART_SIZE = 64L * 1024 * 1024;
    static final long MAX_VIDEO = 60L * 1024 * 1024 * 1024;   // 60 GB masters
    static final long MAX_OTHER = 200L * 1024 * 1024;         // 200 MB PDFs / images

    private final MediaAssetRepository assets;
    private final ObjectStorage storage;
    private final CurrentUser currentUser;

    /** Lets the LMS tell us which assets are referenced by lessons (avoids a package cycle). */
    private Predicate<Long> inUse = id -> false;

    public void setInUseCheck(Predicate<Long> check) { this.inUse = check; }

    @Transactional
    public UploadPlan startUpload(UploadRequest req) {
        String ct = req.contentType().toLowerCase(Locale.ROOT);
        MediaAsset.Kind kind;
        if (ct.startsWith("video/")) kind = MediaAsset.Kind.VIDEO;
        else if (ct.equals("application/pdf")) kind = MediaAsset.Kind.DOCUMENT;
        else if (ct.startsWith("image/")) kind = MediaAsset.Kind.IMAGE;
        else throw ApiException.badRequest("Upload a video, a PDF or an image");
        long max = kind == MediaAsset.Kind.VIDEO ? MAX_VIDEO : MAX_OTHER;
        if (req.size() > max) throw ApiException.badRequest("File is too large (limit " + (max >> 30 > 0 ? (max >> 30) + " GB" : (max >> 20) + " MB") + ")");

        MediaAsset a = new MediaAsset();
        a.setKind(kind);
        a.setOriginalName(req.fileName());
        a.setTitle(req.title() == null || req.title().isBlank() ? stripExt(req.fileName()) : req.title().trim());
        a.setContentType(ct);
        a.setSizeBytes(req.size());
        a.setSourceKey("pending");
        a.setCreatedBy(currentUser.get());
        assets.saveAndFlush(a);

        a.setSourceKey("sources/" + a.getId() + "/original" + ext(req.fileName()));
        a.setUploadId(storage.createMultipart(a.getSourceKey(), ct));

        int parts = (int) Math.max(1, (req.size() + PART_SIZE - 1) / PART_SIZE);
        List<String> urls = new ArrayList<>(parts);
        for (int i = 1; i <= parts; i++) urls.add(storage.presignPart(a.getSourceKey(), a.getUploadId(), i, Duration.ofHours(12)));
        return new UploadPlan(a.getId(), PART_SIZE, urls);
    }

    @Transactional
    public MediaDto completeUpload(Long id, CompleteRequest req) {
        MediaAsset a = find(id);
        if (a.getStatus() != MediaAsset.Status.UPLOADING) throw ApiException.conflict("Upload already completed");
        try {
            storage.completeMultipart(a.getSourceKey(), a.getUploadId(), req.parts());
        } catch (Exception e) {
            log.warn("Completing upload {} failed: {}", id, e.getMessage());
            throw ApiException.badRequest("Upload could not be completed. Try uploading again.");
        }
        a.setUploadId(null);
        if (a.getKind() == MediaAsset.Kind.VIDEO) {
            a.setStatus(MediaAsset.Status.QUEUED);
        } else {
            a.setStatus(MediaAsset.Status.READY);
            a.setReadyAt(Instant.now());
        }
        return dto(a);
    }

    @Transactional(readOnly = true)
    public List<MediaDto> list() {
        return assets.findAllByOrderByCreatedAtDesc().stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public MediaDto get(Long id) {
        return dto(find(id));
    }

    @Transactional
    public MediaDto rename(Long id, String title) {
        MediaAsset a = find(id);
        if (title == null || title.isBlank()) throw ApiException.badRequest("Title can't be empty");
        a.setTitle(title.trim());
        return dto(a);
    }

    @Transactional
    public MediaDto retry(Long id) {
        MediaAsset a = find(id);
        if (a.getStatus() != MediaAsset.Status.FAILED || a.getKind() != MediaAsset.Kind.VIDEO) {
            throw ApiException.conflict("Only failed videos can be retried");
        }
        a.setStatus(MediaAsset.Status.QUEUED);
        a.setError(null);
        a.setProgress(0);
        return dto(a);
    }

    @Transactional
    public void delete(Long id) {
        MediaAsset a = find(id);
        if (inUse.test(id)) throw ApiException.conflict("This file is used by a lesson. Remove it from the lesson first.");
        if (a.getStatus() == MediaAsset.Status.PROCESSING) throw ApiException.conflict("Wait for processing to finish");
        try {
            if (a.getUploadId() != null) storage.abortMultipart(a.getSourceKey(), a.getUploadId());
            storage.deletePrefix("sources/" + a.getId() + "/");
            storage.deletePrefix("videos/" + a.getId() + "/");
        } catch (Exception e) {
            log.warn("Could not delete objects for asset {}: {}", id, e.getMessage());
        }
        assets.delete(a);
    }

    public String posterUrl(MediaAsset a) {
        return a.getPosterKey() == null ? null : storage.presignGet(a.getPosterKey(), Duration.ofHours(6), "image/jpeg");
    }

    public String documentUrl(MediaAsset a) {
        return storage.presignGet(a.getSourceKey(), Duration.ofMinutes(15), a.getContentType());
    }

    MediaAsset find(Long id) {
        return assets.findById(id).orElseThrow(() -> ApiException.notFound("File not found"));
    }

    public MediaDto dto(MediaAsset a) {
        List<Integer> r = a.getRenditions() == null || a.getRenditions().isBlank() ? List.of()
                : Arrays.stream(a.getRenditions().split(",")).map(Integer::valueOf).toList();
        String poster = a.getKind() == MediaAsset.Kind.IMAGE && a.getStatus() == MediaAsset.Status.READY
                ? storage.presignGet(a.getSourceKey(), Duration.ofHours(6), a.getContentType())
                : posterUrl(a);
        return new MediaDto(a.getId(), a.getKind(), a.getStatus(), a.getTitle(), a.getOriginalName(), a.getContentType(),
                a.getSizeBytes(), a.getProgress(), a.getError(), a.getDurationSeconds(), a.getWidth(), a.getHeight(), r,
                a.getEncoder(), poster, a.getCreatedAt(), a.getReadyAt(), inUse.test(a.getId()));
    }

    private static String ext(String name) {
        int i = name.lastIndexOf('.');
        String e = i < 0 ? "" : name.substring(i).toLowerCase(Locale.ROOT);
        return e.matches("^\\.[a-z0-9]{1,5}$") ? e : "";
    }

    private static String stripExt(String name) {
        int i = name.lastIndexOf('.');
        return i > 0 ? name.substring(0, i) : name;
    }
}
