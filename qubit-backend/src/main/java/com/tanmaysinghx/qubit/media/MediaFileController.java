package com.tanmaysinghx.qubit.media;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Local-storage stand-in for what R2 + the Cloudflare Worker do in production:
 * signed segment/file reads and signed multipart part uploads. Disabled in r2 mode.
 */
@RestController
@RequiredArgsConstructor
public class MediaFileController {

    private final ObjectStorage storage;
    private final UrlSigner signer;

    @GetMapping("/api/media/seg/**")
    public void segment(HttpServletRequest req, HttpServletResponse res, @RequestParam long exp, @RequestParam String sig) throws IOException {
        serve(req, res, "/api/media/seg/", exp, sig, null, CacheControl.maxAge(Duration.ofHours(6)).cachePrivate());
    }

    @GetMapping("/api/media/file/**")
    public void file(HttpServletRequest req, HttpServletResponse res, @RequestParam long exp, @RequestParam String sig,
                     @RequestParam(required = false) String ct) throws IOException {
        serve(req, res, "/api/media/file/", exp, sig, ct, CacheControl.noStore());
    }

    @PutMapping("/api/media/upload-part/{uploadId}/{part}")
    public ResponseEntity<Void> uploadPart(@PathVariable String uploadId, @PathVariable int part, @RequestParam long exp,
                                           @RequestParam String sig, HttpServletRequest req) throws IOException {
        if (!(storage instanceof LocalObjectStorage local)) return ResponseEntity.notFound().build();
        String path = "/api/media/upload-part/" + uploadId + "/" + part;
        if (!signer.verify(path, exp, sig) || part < 1 || part > 10000) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        try (InputStream body = req.getInputStream()) {
            String etag = local.writePart(uploadId, part, body);
            return ResponseEntity.ok().header("ETag", etag).header("Access-Control-Expose-Headers", "ETag").build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    private void serve(HttpServletRequest req, HttpServletResponse res, String prefix, long exp, String sig, String ct,
                       CacheControl cache) throws IOException {
        if (!(storage instanceof LocalObjectStorage local)) {
            res.sendError(404);
            return;
        }
        String uri = URLDecoder.decode(req.getRequestURI(), StandardCharsets.UTF_8);
        if (!uri.startsWith(prefix) || uri.contains("..")) {
            res.sendError(404);
            return;
        }
        if (!signer.verify(uri, exp, sig)) {
            res.sendError(403);
            return;
        }
        String key = uri.substring(prefix.length());
        if (key.startsWith("sources/") && prefix.equals("/api/media/seg/")) {
            res.sendError(403); // originals are never streamed as segments
            return;
        }
        if (!local.exists(key)) {
            res.sendError(404);
            return;
        }
        res.setContentType(ct != null ? ct : guess(key));
        res.setHeader("Cache-Control", cache.getHeaderValue());
        res.setHeader("X-Content-Type-Options", "nosniff");
        if (ct != null) res.setHeader("Content-Disposition", "inline");
        try (InputStream in = local.open(key)) {
            in.transferTo(res.getOutputStream());
        }
    }

    private static String guess(String key) {
        if (key.endsWith(".ts")) return "video/mp2t";
        if (key.endsWith(".jpg")) return MediaType.IMAGE_JPEG_VALUE;
        if (key.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
        return MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }
}
