package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.common.ApiException;
import com.tanmaysinghx.qubit.config.QubitProperties;
import com.tanmaysinghx.qubit.media.MediaDtos.PlaybackInfo;
import com.tanmaysinghx.qubit.user.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Playback sessions are the only way to get a content key:
 * one session = one user + one device + one video, limited per account, revocable, expiring,
 * and only valid while the player keeps sending heartbeats.
 */
@Slf4j
@Service
public class PlaybackService {

    /** Implemented by the LMS so watch progress is recorded without a package cycle. */
    public interface ProgressSink {
        void recordVideoProgress(Long userId, Long lessonId, double position, int watchedDelta, Integer duration, boolean ended);
    }

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration SESSION_TTL = Duration.ofHours(6);
    private static final Duration ACTIVE_WINDOW = Duration.ofSeconds(90);
    private static final int MAX_KEY_FETCHES = 40;
    private static final Pattern KEY_LINE = Pattern.compile("URI=\"qubit-key\"");
    private static final Pattern VARIANT = Pattern.compile("^[0-9]{3,4}p$");

    private final PlaybackSessionRepository sessions;
    private final MediaAssetRepository assets;
    private final ObjectStorage storage;
    private final UrlSigner signer;
    private final KeyVault vault;
    private final MediaService media;
    private final QubitProperties.Media cfg;
    private final ObjectProvider<ProgressSink> progress;

    public PlaybackService(PlaybackSessionRepository sessions, MediaAssetRepository assets, ObjectStorage storage,
                           UrlSigner signer, KeyVault vault, MediaService media, QubitProperties props,
                           ObjectProvider<ProgressSink> progress) {
        this.sessions = sessions;
        this.assets = assets;
        this.storage = storage;
        this.signer = signer;
        this.vault = vault;
        this.media = media;
        this.cfg = props.media();
        this.progress = progress;
    }

    @Transactional
    public PlaybackInfo start(User user, MediaAsset asset, Long lessonId, String deviceId, String ip, String ua, int resumeAt) {
        if (asset.getKind() != MediaAsset.Kind.VIDEO || asset.getStatus() != MediaAsset.Status.READY) {
            throw ApiException.conflict("This video isn't ready yet");
        }
        Instant now = Instant.now();
        List<PlaybackSession> active = sessions.findActive(user.getId(), now, now.minus(ACTIVE_WINDOW));
        // The same device replaces its own older session (new tab, reload).
        active.stream().filter(s -> s.getDeviceId().equals(deviceId)).forEach(s -> s.setRevoked(true));
        long otherDevices = active.stream().filter(s -> !s.getDeviceId().equals(deviceId)).map(PlaybackSession::getDeviceId).distinct().count();
        if (otherDevices >= cfg.maxConcurrentStreams()) {
            throw new ApiException(HttpStatus.CONFLICT, "STREAM_LIMIT",
                    "You're already watching on " + otherDevices + " other device" + (otherDevices == 1 ? "" : "s")
                            + ". Stop playback there to watch here.");
        }

        byte[] t = new byte[32];
        RANDOM.nextBytes(t);
        PlaybackSession s = new PlaybackSession();
        s.setToken(Base64.getUrlEncoder().withoutPadding().encodeToString(t));
        s.setUser(user);
        s.setAsset(asset);
        s.setLessonId(lessonId);
        s.setDeviceId(deviceId);
        s.setIpAddress(trim(ip, 64));
        s.setUserAgent(trim(ua, 300));
        s.setExpiresAt(now.plus(SESSION_TTL));
        sessions.save(s);

        List<Integer> renditions = asset.getRenditions() == null ? List.of()
                : Arrays.stream(asset.getRenditions().split(",")).map(Integer::valueOf).toList();
        String mark = user.getEmail() + (user.getPhone() != null ? " · " + user.getPhone() : "") + " · ID " + user.getId();
        return new PlaybackInfo(s.getToken(), "/api/media/play/" + s.getToken() + "/master.m3u8", media.posterUrl(asset),
                asset.getDurationSeconds(), renditions, resumeAt, mark, s.getExpiresAt());
    }

    @Transactional(readOnly = true)
    public String masterPlaylist(String token, Long userId) {
        PlaybackSession s = valid(token, userId);
        String master = storage.readText(s.getAsset().getHlsPrefix() + "master.m3u8");
        StringBuilder out = new StringBuilder();
        for (String line : master.split("\r?\n")) {
            if (!line.isBlank() && !line.startsWith("#")) {
                out.append("/api/media/play/").append(token).append('/').append(line.trim().replace('\\', '/'));
            } else {
                out.append(line);
            }
            out.append('\n');
        }
        return out.toString();
    }

    @Transactional(readOnly = true)
    public String variantPlaylist(String token, Long userId, String variant) {
        if (!VARIANT.matcher(variant).matches()) throw ApiException.notFound("Not found");
        PlaybackSession s = valid(token, userId);
        String prefix = s.getAsset().getHlsPrefix() + variant + "/";
        String playlist = storage.readText(prefix + "index.m3u8");
        long exp = s.getExpiresAt().getEpochSecond();
        StringBuilder out = new StringBuilder();
        for (String line : playlist.split("\r?\n")) {
            if (line.startsWith("#EXT-X-KEY")) {
                Matcher m = KEY_LINE.matcher(line);
                out.append(m.replaceFirst(Matcher.quoteReplacement("URI=\"/api/media/play/" + token + "/key\"")));
            } else if (!line.isBlank() && !line.startsWith("#")) {
                out.append(segmentUrl(prefix + line.trim(), exp));
            } else {
                out.append(line);
            }
            out.append('\n');
        }
        return out.toString();
    }

    /** The AES-128 key: only to the session's owner, on the session's device, while heartbeats are current. */
    @Transactional
    public byte[] key(String token, Long userId, String deviceId) {
        PlaybackSession s = valid(token, userId);
        if (deviceId == null || !deviceId.equals(s.getDeviceId())) throw ApiException.forbidden("Playback isn't allowed on this device");
        if (s.getLastSeenAt().isBefore(Instant.now().minus(Duration.ofMinutes(3)))) {
            throw new ApiException(HttpStatus.CONFLICT, "SESSION_STALE", "Playback session expired. Reload the lesson.");
        }
        if (s.getKeyFetches() >= MAX_KEY_FETCHES) {
            s.setRevoked(true);
            log.warn("Revoked playback session {} for user {}: too many key requests", s.getId(), userId);
            throw ApiException.forbidden("Too many key requests");
        }
        s.setKeyFetches(s.getKeyFetches() + 1);
        return vault.unwrap(s.getAsset().getWrappedKey());
    }

    @Transactional
    public void heartbeat(String token, Long userId, double position, int watchedDelta, boolean ended) {
        PlaybackSession s = valid(token, userId);
        s.setLastSeenAt(Instant.now());
        if (s.getLessonId() != null) {
            ProgressSink sink = progress.getIfAvailable();
            if (sink != null) {
                sink.recordVideoProgress(userId, s.getLessonId(), position, Math.clamp(watchedDelta, 0, 120),
                        s.getAsset().getDurationSeconds(), ended);
            }
        }
    }

    @Transactional
    public void end(String token, Long userId) {
        sessions.findByToken(token).filter(s -> s.getUser().getId().equals(userId)).ifPresent(s -> s.setRevoked(true));
    }

    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void purgeOld() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(7));
        sessions.findAll().stream().filter(s -> s.getExpiresAt().isBefore(cutoff)).forEach(sessions::delete);
    }

    private PlaybackSession valid(String token, Long userId) {
        PlaybackSession s = sessions.findByToken(token).orElseThrow(() -> ApiException.notFound("Playback session not found"));
        if (!s.getUser().getId().equals(userId)) throw ApiException.notFound("Playback session not found");
        if (s.isRevoked() || s.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.GONE, "SESSION_ENDED", "This playback session has ended. Reload the lesson.");
        }
        return s;
    }

    private String segmentUrl(String key, long exp) {
        if ("r2".equals(storage.mode())) {
            String base = cfg.publicBase() == null ? "" : cfg.publicBase().replaceAll("/+$", "");
            String path = "/" + key;
            return base + path + "?" + signer.query(path, exp);
        }
        String path = "/api/media/seg/" + key;
        return path + "?" + signer.query(path, exp);
    }

    private static String trim(String s, int max) {
        return s == null ? null : s.length() <= max ? s : s.substring(0, max);
    }
}
