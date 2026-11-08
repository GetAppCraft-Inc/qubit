package com.tanmaysinghx.qubit.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "qubit")
public record QubitProperties(
        Jwt jwt,
        Mail mail,
        String frontendUrl,
        List<String> corsOrigins,
        Superadmin superadmin,
        Proctoring proctoring,
        Media media
) {
    public record Jwt(String secret, int ttlHours) {}
    public record Mail(String from) {}
    public record Superadmin(String email, String password) {}
    public record Proctoring(int disconnectGraceSeconds) {}

    /**
     * @param storage              "local" (dev, files on disk served by the backend) or "r2" (Cloudflare R2)
     * @param publicBase           in r2 mode, the media gateway (Cloudflare Worker) origin, e.g. https://media.example.com
     * @param masterKey            base64 32-byte key that encrypts per-video content keys at rest
     * @param urlSecret            HMAC secret for signed media URLs (shared with the Worker)
     * @param encoder              auto | h264_nvenc | libx264
     * @param maxConcurrentStreams simultaneous playback sessions allowed per account
     */
    public record Media(String storage, String localDir, String workDir, String publicBase, R2 r2, String masterKey,
                        String urlSecret, String ffmpeg, String ffprobe, String encoder, boolean workerEnabled,
                        int maxConcurrentStreams) {
        public record R2(String accountId, String accessKeyId, String secretAccessKey, String bucket) {}
    }
}
