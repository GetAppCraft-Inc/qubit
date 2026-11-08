package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.config.QubitProperties;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.util.Base64;

/** Wraps per-video content keys with AES-256-GCM so a database leak alone doesn't expose them. */
@Component
public class KeyVault {

    private static final SecureRandom RANDOM = new SecureRandom();
    private final SecretKeySpec master;

    public KeyVault(QubitProperties props) {
        String b64 = props.media().masterKey();
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(b64 == null ? "" : b64.trim());
        } catch (IllegalArgumentException e) {
            raw = new byte[0];
        }
        if (raw.length != 32) throw new IllegalStateException("MEDIA_MASTER_KEY must be a base64-encoded 32-byte key");
        this.master = new SecretKeySpec(raw, "AES");
    }

    public byte[] newContentKey() {
        byte[] k = new byte[16];
        RANDOM.nextBytes(k);
        return k;
    }

    public String wrap(byte[] contentKey) {
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, master, new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(contentKey);
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + ct.length).put(iv).put(ct).array());
        } catch (Exception e) {
            throw new IllegalStateException("Key wrap failed", e);
        }
    }

    public byte[] unwrap(String wrapped) {
        try {
            byte[] all = Base64.getDecoder().decode(wrapped);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, master, new GCMParameterSpec(128, all, 0, 12));
            return c.doFinal(all, 12, all.length - 12);
        } catch (Exception e) {
            throw new IllegalStateException("Key unwrap failed", e);
        }
    }
}
