package com.tanmaysinghx.qubit.exam;

import com.tanmaysinghx.qubit.media.UrlSigner;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/** Signed, expiring URLs for question figures (issued only to people allowed to see the question). */
@Component
@RequiredArgsConstructor
public class QuestionImages {

    private final UrlSigner signer;

    public String url(Question q, Instant expires) {
        if (q == null || !q.hasImage() || q.getId() == null) return null;
        String path = "/api/media/qimg/" + q.getId();
        return path + "?" + signer.query(path, expires.getEpochSecond());
    }

    public String url(Question q, Duration ttl) {
        return url(q, Instant.now().plus(ttl));
    }

    @RestController
    @RequiredArgsConstructor
    static class Controller {
        private final QuestionRepository questions;
        private final UrlSigner signer;

        @GetMapping("/api/media/qimg/{id}")
        @Transactional(readOnly = true)
        public ResponseEntity<byte[]> image(@PathVariable Long id, @RequestParam long exp, @RequestParam String sig) {
            if (!signer.verify("/api/media/qimg/" + id, exp, sig)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            Question q = questions.findById(id).orElse(null);
            if (q == null || !q.hasImage()) return ResponseEntity.notFound().build();
            String data = q.getImage().getData();
            int comma = data.indexOf(',');
            String type = data.substring(5, data.indexOf(';'));
            byte[] bytes = Base64.getMimeDecoder().decode(data.substring(comma + 1));
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(type))
                    .cacheControl(CacheControl.maxAge(Duration.ofHours(12)).cachePrivate())
                    .header("X-Content-Type-Options", "nosniff").body(bytes);
        }
    }
}
