package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.config.QubitProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;

@Configuration
public class StorageConfig {

    @Bean
    public ObjectStorage objectStorage(QubitProperties props, UrlSigner signer) {
        var m = props.media();
        if ("r2".equalsIgnoreCase(m.storage())) return new R2ObjectStorage(m.r2());
        return new LocalObjectStorage(Path.of(m.localDir()), signer);
    }
}
