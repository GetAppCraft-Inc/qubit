package com.tanmaysinghx.qubit.media;

import java.io.InputStream;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

/** Minimal object-store contract implemented by local disk (dev) and Cloudflare R2 (S3 API). */
public interface ObjectStorage {

    record Part(int partNumber, String etag) {}

    /** "local" or "r2". */
    String mode();

    void putFile(String key, Path file, String contentType);

    void download(String key, Path target);

    InputStream open(String key);

    String readText(String key);

    boolean exists(String key);

    void deletePrefix(String prefix);

    String createMultipart(String key, String contentType);

    /** URL the browser PUTs one part to (absolute for R2, app-relative for local). */
    String presignPart(String key, String uploadId, int partNumber, Duration ttl);

    void completeMultipart(String key, String uploadId, List<Part> parts);

    void abortMultipart(String key, String uploadId);

    /** Short-lived URL for reading an object (documents, posters). */
    String presignGet(String key, Duration ttl, String contentType);
}
