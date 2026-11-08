package com.tanmaysinghx.qubit.media;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.tanmaysinghx.qubit.config.QubitProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Turns an uploaded master into encrypted adaptive HLS:
 * H.264 + AAC, 240p…2160p (never above the source), 6 s MPEG-TS segments, AES-128 with a random
 * per-video key that never leaves the server except through an authorised playback session.
 * Uses NVIDIA NVENC when available, libx264 otherwise.
 */
@Slf4j
@Component
public class TranscodeWorker {

    /** height → video bitrate (kbps) */
    private static final int[][] LADDER = {
            {2160, 14000}, {1440, 8000}, {1080, 5000}, {720, 2800}, {480, 1400}, {360, 800}, {240, 400}};

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ProbeStream(String codec_type, Integer width, Integer height, String r_frame_rate) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ProbeFormat(String duration) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Probe(List<ProbeStream> streams, ProbeFormat format) {}

    private final MediaAssetRepository assets;
    private final ObjectStorage storage;
    private final KeyVault vault;
    private final ObjectMapper mapper;
    private final QubitProperties.Media cfg;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(Thread.ofVirtual().name("transcode").factory());
    private final AtomicBoolean busy = new AtomicBoolean();
    private volatile String encoder = "libx264";

    public TranscodeWorker(MediaAssetRepository assets, ObjectStorage storage, KeyVault vault, ObjectMapper mapper,
                           QubitProperties props) {
        this.assets = assets;
        this.storage = storage;
        this.vault = vault;
        this.mapper = mapper;
        this.cfg = props.media();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void init() {
        if (!cfg.workerEnabled()) {
            log.info("Transcode worker disabled on this instance");
            return;
        }
        int n = assets.requeueInterrupted();
        if (n > 0) log.info("Re-queued {} video(s) interrupted by a restart", n);
        encoder = chooseEncoder();
        log.info("Transcode worker ready (encoder: {})", encoder);
    }

    @Scheduled(fixedDelay = 4000, initialDelay = 8000)
    public void poll() {
        if (!cfg.workerEnabled() || busy.get()) return;
        assets.findFirstByStatusOrderByCreatedAtAsc(MediaAsset.Status.QUEUED).ifPresent(a -> {
            if (assets.claim(a.getId()) == 1 && busy.compareAndSet(false, true)) {
                executor.submit(() -> {
                    try {
                        process(a.getId());
                    } finally {
                        busy.set(false);
                    }
                });
            }
        });
    }

    private void process(Long id) {
        MediaAsset a = assets.findById(id).orElse(null);
        if (a == null) return;
        Path work = Path.of(cfg.workDir()).toAbsolutePath().resolve("asset-" + id);
        long started = System.currentTimeMillis();
        try {
            deleteTree(work);
            Files.createDirectories(work);
            Path src = work.resolve("source" + extOf(a.getSourceKey()));
            storage.download(a.getSourceKey(), src);

            Probe probe = probe(src);
            ProbeStream video = probe.streams().stream().filter(s -> "video".equals(s.codec_type())).findFirst()
                    .orElseThrow(() -> new IllegalStateException("No video stream found in the file"));
            boolean hasAudio = probe.streams().stream().anyMatch(s -> "audio".equals(s.codec_type()));
            double duration = probe.format() == null || probe.format().duration() == null ? 0 : Double.parseDouble(probe.format().duration());
            // The "p" class is the short side, so portrait videos keep their quality.
            boolean portrait = video.height() > video.width();
            int srcH = Math.min(video.width(), video.height());

            List<int[]> ladder = Arrays.stream(LADDER).filter(r -> r[0] <= srcH).collect(Collectors.toCollection(ArrayList::new));
            if (ladder.isEmpty()) ladder.add(new int[]{srcH - (srcH % 2), 400});

            byte[] key = vault.newContentKey();
            byte[] iv = vault.newContentKey();
            Path keyFile = work.resolve("enc.key");
            Files.write(keyFile, key);
            Path keyInfo = work.resolve("enc.keyinfo");
            Files.writeString(keyInfo, "qubit-key\n" + keyFile + "\n" + HexFormat.of().formatHex(iv) + "\n");

            Path out = work.resolve("hls");
            Files.createDirectories(out);
            for (int[] r : ladder) Files.createDirectories(out.resolve(r[0] + "p"));

            runFfmpeg(buildArgs(src, out, keyInfo, ladder, hasAudio, portrait), id, duration);
            // FFmpeg on Windows writes variant paths with backslashes; playlists must use URL separators.
            Path master = out.resolve("master.m3u8");
            Files.writeString(master, Files.readString(master).replace('\\', '/'));

            Path poster = work.resolve("poster.jpg");
            runQuiet(List.of(cfg.ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-ss", String.valueOf(Math.max(0, duration * 0.1)),
                    "-i", src.toString(), "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "3", poster.toString()));

            String prefix = "videos/" + id + "/hls/";
            storage.deletePrefix(prefix);
            try (Stream<Path> files = Files.walk(out)) {
                for (Path f : files.filter(Files::isRegularFile).toList()) {
                    String rel = out.relativize(f).toString().replace('\\', '/');
                    storage.putFile(prefix + rel, f, contentType(rel));
                }
            }
            String posterKey = "videos/" + id + "/poster.jpg";
            if (Files.exists(poster)) storage.putFile(posterKey, poster, "image/jpeg");

            MediaAsset done = assets.findById(id).orElseThrow();
            done.setStatus(MediaAsset.Status.READY);
            done.setProgress(100);
            done.setError(null);
            done.setDurationSeconds((int) Math.round(duration));
            done.setWidth(video.width());
            done.setHeight(video.height());
            done.setRenditions(ladder.stream().map(r -> String.valueOf(r[0])).collect(Collectors.joining(",")));
            done.setHlsPrefix(prefix);
            done.setPosterKey(Files.exists(poster) ? posterKey : null);
            done.setWrappedKey(vault.wrap(key));
            done.setEncoder(encoder);
            done.setReadyAt(Instant.now());
            assets.save(done);
            log.info("Asset {} ready: {}p ladder in {}s", id, done.getRenditions(), (System.currentTimeMillis() - started) / 1000);
        } catch (Exception e) {
            log.error("Transcoding asset {} failed", id, e);
            assets.findById(id).ifPresent(f -> {
                f.setStatus(MediaAsset.Status.FAILED);
                String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                f.setError(msg.length() > 480 ? msg.substring(0, 480) : msg);
                assets.save(f);
            });
        } finally {
            deleteTree(work); // removes the clear-text key file too
        }
    }

    private List<String> buildArgs(Path src, Path out, Path keyInfo, List<int[]> ladder, boolean audio, boolean portrait) {
        int n = ladder.size();
        List<String> a = new ArrayList<>(List.of(cfg.ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", src.toString()));

        StringBuilder fc = new StringBuilder("[0:v]split=" + n);
        for (int i = 0; i < n; i++) fc.append("[s").append(i).append(']');
        fc.append(';');
        for (int i = 0; i < n; i++) {
            int px = ladder.get(i)[0];
            fc.append("[s").append(i).append("]scale=").append(portrait ? px + ":-2" : "-2:" + px)
                    .append(":flags=lanczos[v").append(i).append(']');
            if (i < n - 1) fc.append(';');
        }
        a.addAll(List.of("-filter_complex", fc.toString()));

        for (int i = 0; i < n; i++) {
            int kbps = ladder.get(i)[1];
            a.addAll(List.of("-map", "[v" + i + "]"));
            a.addAll(List.of("-b:v:" + i, kbps + "k", "-maxrate:v:" + i, (int) (kbps * 1.1) + "k", "-bufsize:v:" + i, (kbps * 2) + "k"));
            if (audio) a.addAll(List.of("-map", "0:a:0"));
        }
        if ("h264_nvenc".equals(encoder)) {
            a.addAll(List.of("-c:v", "h264_nvenc", "-preset", "p5", "-tune", "hq", "-rc", "vbr", "-forced-idr", "1"));
        } else {
            a.addAll(List.of("-c:v", "libx264", "-preset", "veryfast", "-sc_threshold", "0"));
        }
        a.addAll(List.of("-profile:v", "high", "-pix_fmt", "yuv420p", "-force_key_frames", "expr:gte(t,n_forced*2)"));
        if (audio) a.addAll(List.of("-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000"));

        StringBuilder map = new StringBuilder();
        for (int i = 0; i < n; i++) {
            if (i > 0) map.append(' ');
            map.append("v:").append(i);
            if (audio) map.append(",a:").append(i);
            map.append(",name:").append(ladder.get(i)[0]).append('p');
        }
        a.addAll(List.of(
                "-f", "hls", "-hls_time", "6", "-hls_playlist_type", "vod", "-hls_segment_type", "mpegts",
                "-hls_flags", "independent_segments", "-hls_key_info_file", keyInfo.toString(),
                "-hls_segment_filename", out.resolve("%v").resolve("seg_%05d.ts").toString(),
                "-master_pl_name", "master.m3u8", "-var_stream_map", map.toString(),
                "-progress", "pipe:1", "-nostats",
                out.resolve("%v").resolve("index.m3u8").toString()));
        return a;
    }

    private void runFfmpeg(List<String> args, Long id, double duration) throws IOException, InterruptedException {
        Process p = new ProcessBuilder(args).start();
        StringBuilder err = new StringBuilder();
        Thread errReader = Thread.ofVirtual().start(() -> drain(p, err));
        long lastUpdate = 0;
        try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                if (line.startsWith("out_time_us=") && duration > 0) {
                    try {
                        double secs = Long.parseLong(line.substring(12).trim()) / 1_000_000.0;
                        int pct = (int) Math.min(97, Math.max(0, secs * 100 / duration));
                        if (System.currentTimeMillis() - lastUpdate > 1500) {
                            assets.updateProgress(id, pct);
                            lastUpdate = System.currentTimeMillis();
                        }
                    } catch (NumberFormatException ignored) {
                        // N/A at start
                    }
                }
            }
        }
        int code = p.waitFor();
        errReader.join(2000);
        if (code != 0) throw new IllegalStateException("ffmpeg exited with " + code + ": " + tail(err.toString()));
    }

    private Probe probe(Path src) throws IOException, InterruptedException {
        Process p = new ProcessBuilder(cfg.ffprobe(), "-v", "error", "-print_format", "json", "-show_format", "-show_streams",
                src.toString()).redirectErrorStream(false).start();
        String json = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        if (!p.waitFor(60, TimeUnit.SECONDS) || p.exitValue() != 0) throw new IllegalStateException("This file isn't a readable video");
        return mapper.readValue(json, Probe.class);
    }

    private String chooseEncoder() {
        String want = cfg.encoder() == null ? "auto" : cfg.encoder();
        if (!"auto".equals(want)) return want;
        try {
            int code = runQuiet(List.of(cfg.ffmpeg(), "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
                    "color=c=black:s=640x360:d=0.2", "-c:v", "h264_nvenc", "-f", "null", "-"));
            return code == 0 ? "h264_nvenc" : "libx264";
        } catch (Exception e) {
            log.warn("FFmpeg not usable ({}). Set FFMPEG_PATH / FFPROBE_PATH.", e.getMessage());
            return "libx264";
        }
    }

    private int runQuiet(List<String> args) throws IOException, InterruptedException {
        Process p = new ProcessBuilder(args).redirectErrorStream(true).start();
        p.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());
        return p.waitFor();
    }

    private static void drain(Process p, StringBuilder into) {
        try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getErrorStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                into.append(line).append('\n');
                if (into.length() > 8000) into.delete(0, into.length() - 4000);
            }
        } catch (IOException ignored) {
            // process ended
        }
    }

    private static String tail(String s) {
        String t = s.strip();
        return t.length() > 400 ? t.substring(t.length() - 400) : t;
    }

    private static String extOf(String key) {
        int i = key.lastIndexOf('.');
        return i < 0 ? ".bin" : key.substring(i);
    }

    private static String contentType(String name) {
        if (name.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
        if (name.endsWith(".ts")) return "video/mp2t";
        return "application/octet-stream";
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
