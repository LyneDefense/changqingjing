package com.changqingjing.media;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.exception.CosClientException;
import com.qcloud.cos.http.HttpProtocol;
import com.qcloud.cos.model.COSObject;
import com.qcloud.cos.model.GetObjectRequest;
import com.qcloud.cos.model.ObjectMetadata;
import com.qcloud.cos.region.Region;
import com.tencent.cloud.CosStsClient;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.TreeMap;
import org.json.JSONObject;

final class CosMediaStorage implements MediaStorage {

    private static final String[] UPLOAD_ACTIONS = {"name/cos:PutObject"};
    private static final int HEADER_BYTES = 32;

    private final String bucket;
    private final String region;
    private final String secretId;
    private final String secretKey;
    private final COSClient client;

    CosMediaStorage(MediaProperties.Cos properties) {
        this.bucket = required(properties.getBucket(), "COS_BUCKET");
        this.region = required(properties.getRegion(), "COS_REGION");
        this.secretId = required(properties.getSecretId(), "COS_SECRET_ID");
        this.secretKey = required(properties.getSecretKey(), "COS_SECRET_KEY");
        ClientConfig clientConfig = new ClientConfig(new Region(region));
        clientConfig.setHttpProtocol(HttpProtocol.https);
        client = new COSClient(new BasicCOSCredentials(secretId, secretKey), clientConfig);
    }

    @Override
    public UploadAuthorization authorizeUpload(
            String objectKey,
            String contentType,
            Duration validity) {
        TreeMap<String, Object> configuration = new TreeMap<>();
        configuration.put("secretId", secretId);
        configuration.put("secretKey", secretKey);
        configuration.put("durationSeconds", Math.toIntExact(validity.toSeconds()));
        configuration.put("bucket", bucket);
        configuration.put("region", region);
        configuration.put("allowPrefixes", new String[] {objectKey});
        configuration.put("allowActions", UPLOAD_ACTIONS);
        try {
            JSONObject response = CosStsClient.getCredential(configuration);
            JSONObject credentials = response.getJSONObject("credentials");
            long startTime = response.getLong("startTime");
            long expiredTime = response.getLong("expiredTime");
            return new UploadAuthorization(
                    bucket,
                    region,
                    objectKey,
                    OffsetDateTime.ofInstant(Instant.ofEpochSecond(expiredTime), ZoneOffset.UTC),
                    new TemporaryCredentials(
                            credentials.getString("tmpSecretId"),
                            credentials.getString("tmpSecretKey"),
                            credentials.getString("sessionToken"),
                            startTime,
                            expiredTime));
        } catch (IOException | RuntimeException exception) {
            throw new MediaStorageException(
                    "COS_CREDENTIAL_REQUEST_FAILED",
                    "暂时无法创建上传凭证",
                    exception);
        }
    }

    @Override
    public StoredObject inspect(String objectKey) {
        try {
            ObjectMetadata metadata = client.getObjectMetadata(bucket, objectKey);
            GetObjectRequest request = new GetObjectRequest(bucket, objectKey);
            request.setRange(0, HEADER_BYTES - 1L);
            byte[] header;
            try (COSObject object = client.getObject(request);
                    InputStream input = object.getObjectContent()) {
                header = input.readNBytes(HEADER_BYTES);
            }
            return new StoredObject(
                    metadata.getContentLength(),
                    metadata.getContentType(),
                    metadata.getETag(),
                    header);
        } catch (IOException | CosClientException exception) {
            throw new MediaStorageException(
                    "COS_OBJECT_INSPECTION_FAILED",
                    "暂时无法核验已上传文件",
                    exception);
        }
    }

    @Override
    public SignedObjectUrl signRead(String objectKey, Duration validity) {
        OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plus(validity);
        try {
            String url = client.generatePresignedUrl(
                    bucket,
                    objectKey,
                    Date.from(expiresAt.toInstant())).toExternalForm();
            return new SignedObjectUrl(url, expiresAt);
        } catch (CosClientException exception) {
            throw new MediaStorageException(
                    "COS_READ_URL_FAILED",
                    "暂时无法生成媒体访问地址",
                    exception);
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            client.deleteObject(bucket, objectKey);
        } catch (CosClientException exception) {
            throw new MediaStorageException(
                    "COS_OBJECT_DELETE_FAILED",
                    "暂时无法清理媒体文件",
                    exception);
        }
    }

    @PreDestroy
    void close() {
        client.shutdown();
    }

    private static String required(String value, String environmentName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    environmentName + " is required when COS media storage is enabled");
        }
        return value.strip();
    }
}
