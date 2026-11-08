package com.tanmaysinghx.qubit.media;

import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

/**
 * Development storage on local disk. Browser uploads and reads go through signed backend URLs
 * ({@link MediaFileController}) that mimic presigned R2 URLs, so the frontend has one code path.
 */
@Slf4j
public class LocalObjectStorage implements ObjectStorage {

    private final Path root;
    private final Path uploads;
    private final UrlSigner signer;

    public LocalObjectStorage(Path root, UrlSigner signer) {
        this.root = root.toAbsolutePath().normalize();
        this.uploads = this.root.resolve(".uploads");
        this.signer = signer;
        try {
            Files.createDirectories(uploads);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        log.info("Media storage: local disk at {}", this.root);
    }

    @Override public String mode() { return "local"; }

    Path resolve(String key) {
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root) || p.startsWith(uploads)) throw new IllegalArgumentException("Invalid key");
        return p;
    }

    @Override
    public void putFile(String key, Path file, String contentType) {
        try {
            Path target = resolve(key);
            Files.createDirectories(target.getParent());
            Files.copy(file, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void download(String key, Path target) {
        try {
            Files.createDirectories(target.getParent());
            Files.copy(resolve(key), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public InputStream open(String key) {
        try {
            return Files.newInputStream(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public String readText(String key) {
        try {
            return Files.readString(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override public boolean exists(String key) { return Files.isRegularFile(resolve(key)); }

    @Override
    public void deletePrefix(String prefix) {
        deleteTree(resolve(prefix));
    }

    @Override
    public String createMultipart(String key, String contentType) {
        String id = UUID.randomUUID().toString().replace("-", "");
        try {
            Files.createDirectories(uploads.resolve(id));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return id;
    }

    @Override
    public String presignPart(String key, String uploadId, int partNumber, Duration ttl) {
        String path = "/api/media/upload-part/" + uploadId + "/" + partNumber;
        long exp = Instant.now().plus(ttl).getEpochSecond();
        return path + "?" + signer.query(path, exp);
    }

    /** Stores one uploaded part; returns its ETag (MD5 hex). */
    public String writePart(String uploadId, int partNumber, InputStream body) {
        if (!uploadId.matches("^[a-f0-9]{32}$")) throw new IllegalArgumentException("Invalid upload id");
        Path dir = uploads.resolve(uploadId);
        if (!Files.isDirectory(dir)) throw new IllegalArgumentException("Unknown upload");
        try {
            MessageDigest md5 = MessageDigest.getInstance("MD5");
            Path part = dir.resolve(String.format("%05d", partNumber));
            try (OutputStream out = Files.newOutputStream(part)) {
                byte[] buf = new byte[1 << 16];
                int n;
                while ((n = body.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    md5.update(buf, 0, n);
                }
            }
            return "\"" + HexFormat.of().formatHex(md5.digest()) + "\"";
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public void completeMultipart(String key, String uploadId, List<Part> parts) {
        Path dir = uploads.resolve(uploadId);
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            try (OutputStream out = Files.newOutputStream(target)) {
                for (Part p : parts.stream().sorted(Comparator.comparingInt(Part::partNumber)).toList()) {
                    Path part = dir.resolve(String.format("%05d", p.partNumber()));
                    if (!Files.exists(part)) throw new IllegalStateException("Missing part " + p.partNumber());
                    Files.copy(part, out);
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        } finally {
            deleteTree(dir);
        }
    }

    @Override
    public void abortMultipart(String key, String uploadId) {
        deleteTree(uploads.resolve(uploadId));
    }

    @Override
    public String presignGet(String key, Duration ttl, String contentType) {
        String path = "/api/media/file/" + key;
        long exp = Instant.now().plus(ttl).getEpochSecond();
        return path + "?" + signer.query(path, exp) + (contentType == null ? "" : "&ct=" + URLEncoder.encode(contentType, StandardCharsets.UTF_8));
    }

    private static void deleteTree(Path dir) {
        if (!Files.exists(dir)) return;
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // best effort
                }
            });
        } catch (IOException ignored) {
            // best effort
        }
    }
}
