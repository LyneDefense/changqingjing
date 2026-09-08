package com.changqingjing.media;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "app.media")
public class MediaProperties {

    @NotBlank
    private String objectPrefix = "local";
    private Duration uploadCredentialTtl = Duration.ofMinutes(15);
    private Duration readUrlTtl = Duration.ofMinutes(15);
    @Positive
    private long maxImageBytes = 10 * 1024 * 1024;
    @Positive
    private long maxVideoBytes = 200 * 1024 * 1024;
    @Valid
    private Cos cos = new Cos();

    public String getObjectPrefix() {
        return objectPrefix;
    }

    public void setObjectPrefix(String objectPrefix) {
        this.objectPrefix = objectPrefix;
    }

    public Duration getUploadCredentialTtl() {
        return uploadCredentialTtl;
    }

    public void setUploadCredentialTtl(Duration uploadCredentialTtl) {
        this.uploadCredentialTtl = uploadCredentialTtl;
    }

    public Duration getReadUrlTtl() {
        return readUrlTtl;
    }

    public void setReadUrlTtl(Duration readUrlTtl) {
        this.readUrlTtl = readUrlTtl;
    }

    public long getMaxImageBytes() {
        return maxImageBytes;
    }

    public void setMaxImageBytes(long maxImageBytes) {
        this.maxImageBytes = maxImageBytes;
    }

    public long getMaxVideoBytes() {
        return maxVideoBytes;
    }

    public void setMaxVideoBytes(long maxVideoBytes) {
        this.maxVideoBytes = maxVideoBytes;
    }

    public Cos getCos() {
        return cos;
    }

    public void setCos(Cos cos) {
        this.cos = cos;
    }

    public static class Cos {

        private boolean enabled;
        private String bucket = "";
        private String region = "";
        private String secretId = "";
        private String secretKey = "";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getBucket() {
            return bucket;
        }

        public void setBucket(String bucket) {
            this.bucket = bucket;
        }

        public String getRegion() {
            return region;
        }

        public void setRegion(String region) {
            this.region = region;
        }

        public String getSecretId() {
            return secretId;
        }

        public void setSecretId(String secretId) {
            this.secretId = secretId;
        }

        public String getSecretKey() {
            return secretKey;
        }

        public void setSecretKey(String secretKey) {
            this.secretKey = secretKey;
        }
    }
}
