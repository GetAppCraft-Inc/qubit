package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.media.MediaDtos.*;
import com.tanmaysinghx.qubit.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Admin media library. */
@RestController
@RequestMapping("/api/admin/media")
@RequiredArgsConstructor
class AdminMediaController {

    private final MediaService media;
    private final PlaybackService playback;
    private final MediaAssetRepository assets;
    private final CurrentUser currentUser;

    @GetMapping
    public List<MediaDto> list() { return media.list(); }

    @GetMapping("/{id}")
    public MediaDto get(@PathVariable Long id) { return media.get(id); }

    @PostMapping("/uploads")
    public UploadPlan startUpload(@Valid @RequestBody UploadRequest req) { return media.startUpload(req); }

    @PostMapping("/{id}/complete")
    public MediaDto complete(@PathVariable Long id, @Valid @RequestBody CompleteRequest req) { return media.completeUpload(id, req); }

    @PatchMapping("/{id}")
    public MediaDto rename(@PathVariable Long id, @RequestBody Map<String, String> body) { return media.rename(id, body.get("title")); }

    @PostMapping("/{id}/retry")
    public MediaDto retry(@PathVariable Long id) { return media.retry(id); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { media.delete(id); }

    /** Lets staff preview a processed video through the same protected pipeline. */
    @PostMapping("/{id}/preview")
    public PlaybackInfo preview(@PathVariable Long id, @Valid @RequestBody PlaybackRequest req, HttpServletRequest http) {
        MediaAsset a = assets.findById(id).orElseThrow(() -> ApiException.notFound("File not found"));
        return playback.start(currentUser.get(), a, null, req.deviceId(), http.getRemoteAddr(), http.getHeader("User-Agent"), 0);
    }
}

/** Authenticated (JWT) player endpoints: playlists, key, heartbeat. */
@RestController
@RequestMapping("/api/media/play/{token}")
@RequiredArgsConstructor
class PlaybackController {

    private static final MediaType M3U8 = MediaType.parseMediaType("application/vnd.apple.mpegurl");

    private final PlaybackService playback;
    private final CurrentUser currentUser;

    @GetMapping("/master.m3u8")
    public ResponseEntity<String> master(@PathVariable String token) {
        return ResponseEntity.ok().contentType(M3U8).cacheControl(CacheControl.noStore())
                .body(playback.masterPlaylist(token, currentUser.id()));
    }

    @GetMapping("/{variant}/index.m3u8")
    public ResponseEntity<String> variant(@PathVariable String token, @PathVariable String variant) {
        return ResponseEntity.ok().contentType(M3U8).cacheControl(CacheControl.noStore())
                .body(playback.variantPlaylist(token, currentUser.id(), variant));
    }

    @GetMapping("/key")
    public ResponseEntity<byte[]> key(@PathVariable String token, @RequestHeader(value = "X-Qubit-Device", required = false) String device) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache").body(playback.key(token, currentUser.id(), device));
    }

    @PostMapping("/heartbeat")
    public void heartbeat(@PathVariable String token, @RequestBody Heartbeat hb) {
        playback.heartbeat(token, currentUser.id(), hb.position(), hb.watchedDelta(), hb.ended());
    }

    @DeleteMapping
    public void end(@PathVariable String token) {
        playback.end(token, currentUser.id());
    }
}
