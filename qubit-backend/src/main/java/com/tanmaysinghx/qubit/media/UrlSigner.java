package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.config.QubitProperties;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;

/**
 * HMAC-SHA256 signatures for media URLs: {@code sig = hex(HMAC(secret, path + "|" + exp))}.
 * The Cloudflare Worker (infra/cloudflare/media-gateway) verifies exactly the same format.
 */
@Component
public class UrlSigner {

    private final byte[] secret;

    public UrlSigner(QubitProperties props) {
        String s = props.media().urlSecret();
        if (s == null || s.length() < 24) throw new IllegalStateException("MEDIA_URL_SECRET must be set (24+ chars)");
        this.secret = s.getBytes(StandardCharsets.UTF_8);
    }

    public String sign(String path, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((path + "|" + exp).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Returns "exp=…&sig=…" for the path. */
    public String query(String path, long exp) {
        return "exp=" + exp + "&sig=" + sign(path, exp);
    }

    public boolean verify(String path, long exp, String sig) {
        if (sig == null || exp < Instant.now().getEpochSecond()) return false;
        return MessageDigest.isEqual(sign(path, exp).getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8));
    }
}
