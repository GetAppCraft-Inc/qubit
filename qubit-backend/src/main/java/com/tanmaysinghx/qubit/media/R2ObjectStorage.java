package com.tanmaysinghx.qubit.media;

import com.tanmaysinghx.qubit.config.QubitProperties;
import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

/** Cloudflare R2 through its S3-compatible API. The bucket stays private. */
@Slf4j
public class R2ObjectStorage implements ObjectStorage {

    private final S3Client s3;
    private final S3Presigner presigner;
    private final String bucket;

    public R2ObjectStorage(QubitProperties.Media.R2 cfg) {
        if (blank(cfg.accountId()) || blank(cfg.accessKeyId()) || blank(cfg.secretAccessKey()) || blank(cfg.bucket())) {
            throw new IllegalStateException("MEDIA_STORAGE=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET");
        }
        URI endpoint = URI.create("https://" + cfg.accountId() + ".r2.cloudflarestorage.com");
        var creds = StaticCredentialsProvider.create(AwsBasicCredentials.create(cfg.accessKeyId(), cfg.secretAccessKey()));
        var s3cfg = S3Configuration.builder().pathStyleAccessEnabled(true).chunkedEncodingEnabled(false).build();
        this.s3 = S3Client.builder().endpointOverride(endpoint).region(Region.of("auto")).credentialsProvider(creds)
                .serviceConfiguration(s3cfg).httpClient(UrlConnectionHttpClient.create()).build();
        this.presigner = S3Presigner.builder().endpointOverride(endpoint).region(Region.of("auto")).credentialsProvider(creds)
                .serviceConfiguration(s3cfg).build();
        this.bucket = cfg.bucket();
        log.info("Media storage: Cloudflare R2 bucket {}", bucket);
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }

    @Override public String mode() { return "r2"; }

    @Override
    public void putFile(String key, Path file, String contentType) {
        s3.putObject(PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build(), RequestBody.fromFile(file));
    }

    @Override
    public void download(String key, Path target) {
        try {
            Files.createDirectories(target.getParent());
            Files.deleteIfExists(target);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        s3.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build(), ResponseTransformer.toFile(target));
    }

    @Override
    public InputStream open(String key) {
        return s3.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build());
    }

    @Override
    public String readText(String key) {
        return s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asString(StandardCharsets.UTF_8);
    }

    @Override
    public boolean exists(String key) {
        try {
            s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        }
    }

    @Override
    public void deletePrefix(String prefix) {
        String token = null;
        do {
            var page = s3.listObjectsV2(ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).continuationToken(token).build());
            List<ObjectIdentifier> ids = page.contents().stream().map(o -> ObjectIdentifier.builder().key(o.key()).build()).toList();
            if (!ids.isEmpty()) {
                s3.deleteObjects(DeleteObjectsRequest.builder().bucket(bucket).delete(Delete.builder().objects(ids).build()).build());
            }
            token = page.isTruncated() ? page.nextContinuationToken() : null;
        } while (token != null);
    }

    @Override
    public String createMultipart(String key, String contentType) {
        return s3.createMultipartUpload(CreateMultipartUploadRequest.builder().bucket(bucket).key(key).contentType(contentType).build()).uploadId();
    }

    @Override
    public String presignPart(String key, String uploadId, int partNumber, Duration ttl) {
        var req = UploadPartRequest.builder().bucket(bucket).key(key).uploadId(uploadId).partNumber(partNumber).build();
        return presigner.presignUploadPart(b -> b.signatureDuration(ttl).uploadPartRequest(req)).url().toString();
    }

    @Override
    public void completeMultipart(String key, String uploadId, List<Part> parts) {
        List<CompletedPart> done = parts.stream()
                .sorted((a, b) -> Integer.compare(a.partNumber(), b.partNumber()))
                .map(p -> CompletedPart.builder().partNumber(p.partNumber()).eTag(p.etag()).build()).toList();
        s3.completeMultipartUpload(CompleteMultipartUploadRequest.builder().bucket(bucket).key(key).uploadId(uploadId)
                .multipartUpload(CompletedMultipartUpload.builder().parts(done).build()).build());
    }

    @Override
    public void abortMultipart(String key, String uploadId) {
        s3.abortMultipartUpload(AbortMultipartUploadRequest.builder().bucket(bucket).key(key).uploadId(uploadId).build());
    }

    @Override
    public String presignGet(String key, Duration ttl, String contentType) {
        var get = GetObjectRequest.builder().bucket(bucket).key(key);
        if (contentType != null) get.responseContentType(contentType).responseContentDisposition("inline");
        return presigner.presignGetObject(b -> b.signatureDuration(ttl).getObjectRequest(get.build())).url().toString();
    }
}
