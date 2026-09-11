package com.changqingjing.media;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.changqingjing.admin.api.media.CreateMediaUploadRequest;
import com.changqingjing.admin.auth.AdminAccount;
import com.changqingjing.admin.auth.AdminAccountRepository;
import com.changqingjing.admin.auth.AdminBootstrapService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.mock.web.MockMultipartFile;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(
        classes = {
            com.changqingjing.ChangqingjingApplication.class,
            MediaServiceIntegrationTest.FakeStorageConfiguration.class
        },
        properties = "app.admin.password.bcrypt-strength=4")
@Testcontainers
class MediaServiceIntegrationTest {

    @Container
    private static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private MediaService mediaService;

    @Autowired
    private MediaCleanupService cleanupService;

    @Autowired
    private FakeMediaStorage storage;

    @Autowired
    private AdminBootstrapService bootstrapService;

    @Autowired
    private AdminAccountRepository accountRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void resetDatabase() {
        storage.clear();
        jdbcTemplate.execute("TRUNCATE TABLE admin_account, app_user CASCADE");
    }

    @Test
    void createsObjectScopedUploadAndOnlyMarksVerifiedImageReady() {
        AdminPrincipal actor = bootstrapAdmin();
        var created = mediaService.createUpload(
                new CreateMediaUploadRequest(
                        " company-cover.png ",
                        MediaType.IMAGE,
                        "image/png",
                        8,
                        MediaPurpose.COMPANY_COVER),
                actor,
                "media-create");

        assertThat(created.media().status()).isEqualTo("UPLOADING");
        assertThat(created.media().originalFilename()).isEqualTo("company-cover.png");
        assertThat(created.upload().objectKey()).matches("local/\\d{4}/\\d{2}/.+\\.png");
        assertThat(created.upload().credentials().secretKey()).isEqualTo("temporary-key");
        assertThat(storage.authorizedObjectKey()).isEqualTo(created.upload().objectKey());

        storage.put(created.upload().objectKey(), new MediaStorage.StoredObject(
                8,
                "image/png",
                "verified-etag",
                new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}));
        var ready = mediaService.completeUpload(created.media().id(), actor, "media-complete");

        assertThat(ready.status()).isEqualTo("READY");
        assertThat(ready.previewUrl()).contains(created.upload().objectKey());
        assertThat(ready.previewExpiresAt()).isNotNull();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM admin_audit_event WHERE target_type = 'MEDIA_ASSET'",
                Long.class)).isEqualTo(2);
    }

    @Test
    void rejectsSpoofedFileAndKeepsItOutOfReadyState() {
        AdminPrincipal actor = bootstrapAdmin();
        var created = mediaService.createUpload(
                new CreateMediaUploadRequest(
                        "spoofed.jpg",
                        MediaType.IMAGE,
                        "image/jpeg",
                        8,
                        MediaPurpose.COMPANY_IMAGE),
                actor,
                "media-spoofed");
        storage.put(created.upload().objectKey(), new MediaStorage.StoredObject(
                8,
                "image/jpeg",
                "spoofed-etag",
                "not-jpeg".getBytes(java.nio.charset.StandardCharsets.US_ASCII)));

        var failed = mediaService.completeUpload(
                created.media().id(), actor, "media-spoofed-complete");

        assertThat(failed.status()).isEqualTo("FAILED");
        assertThat(failed.failureCode()).isEqualTo("MEDIA_FILE_SIGNATURE_INVALID");
        assertThat(failed.previewUrl()).isNull();
        assertThatThrownBy(() -> mediaService.requireReady(created.media().id()))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("MEDIA_NOT_READY");
    }

    @Test
    void validatesPurposeFormatAndConfiguredSizeBeforeRequestingCredentials() {
        AdminPrincipal actor = bootstrapAdmin();
        assertThatThrownBy(() -> mediaService.createUpload(
                new CreateMediaUploadRequest(
                        "wrong.mp4",
                        MediaType.VIDEO,
                        "video/mp4",
                        20,
                        MediaPurpose.COMPANY_IMAGE),
                actor,
                "media-purpose"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("MEDIA_INVALID");

        assertThatThrownBy(() -> mediaService.createUpload(
                new CreateMediaUploadRequest(
                        "oversize.png",
                        MediaType.IMAGE,
                        "image/png",
                        10 * 1024 * 1024L + 1,
                        MediaPurpose.COMPANY_IMAGE),
                actor,
                "media-size"))
                .isInstanceOf(BusinessException.class)
                .extracting(error -> ((BusinessException) error).getCode())
                .isEqualTo("MEDIA_SIZE_EXCEEDED");
    }

    @Test
    void cleanupDeletesExpiredUnreferencedUploads() {
        AdminPrincipal actor = bootstrapAdmin();
        var created = mediaService.createUpload(
                new CreateMediaUploadRequest(
                        "abandoned.webp",
                        MediaType.IMAGE,
                        "image/webp",
                        12,
                        MediaPurpose.COMPANY_IMAGE),
                actor,
                "media-abandoned");
        jdbcTemplate.update(
                "UPDATE media_asset SET upload_expires_at = now() - interval '1 minute' WHERE id = ?",
                created.media().id());

        cleanupService.cleanExpiredUploads();

        assertThat(mediaService.getAdminMedia(created.media().id()).status()).isEqualTo("DELETED");
    }

    @Test
    void cleanupNeverDeletesAnAssetReferencedByAContentRevision() {
        AdminPrincipal actor = bootstrapAdmin();
        var created = mediaService.createUpload(
                new CreateMediaUploadRequest(
                        "referenced.webp",
                        MediaType.IMAGE,
                        "image/webp",
                        12,
                        MediaPurpose.COMPANY_IMAGE),
                actor,
                "media-referenced");
        UUID entryId = UUID.randomUUID();
        UUID revisionId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO content_entry (
                    id, kind, business_key, created_by, updated_by
                ) VALUES (?, 'COMPANY', ?, ?, ?)
                """, entryId, "cleanup-" + entryId, actor.accountId(), actor.accountId());
        jdbcTemplate.update("""
                INSERT INTO content_revision (
                    id, entry_id, revision_no, title, payload, created_by
                ) VALUES (?, ?, 1, 'cleanup guard', '{}'::jsonb, ?)
                """, revisionId, entryId, actor.accountId());
        jdbcTemplate.update("""
                INSERT INTO content_revision_media (
                    revision_id, media_id, usage, display_order
                ) VALUES (?, ?, 'BODY_IMAGE', 0)
                """, revisionId, created.media().id());
        jdbcTemplate.update(
                "UPDATE media_asset SET upload_expires_at = now() - interval '1 minute' WHERE id = ?",
                created.media().id());

        cleanupService.cleanExpiredUploads();

        assertThat(mediaService.getAdminMedia(created.media().id()).status())
                .isEqualTo("UPLOADING");
    }

    @Test
    void storesAndVerifiesAnAvatarOwnedByAnAppUser() {
        UUID userId = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO app_user (
                    id, display_name, status, registered_at, last_login_at, updated_at
                ) VALUES (?, 'avatar user', 'ACTIVE', now(), now(), now())
                """, userId);
        byte[] png = new byte[] {
            (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
        };

        var asset = mediaService.storeAppAvatar(
                new MockMultipartFile(
                        "avatar", "avatar.png", "application/octet-stream", png),
                userId);

        assertThat(asset.status()).isEqualTo(MediaStatus.READY);
        assertThat(asset.purpose()).isEqualTo(MediaPurpose.APP_USER_AVATAR);
        assertThat(asset.contentType()).isEqualTo("image/png");
        assertThat(asset.uploadedBy()).isNull();
        assertThat(asset.uploadedByAppUser()).isEqualTo(userId);
    }

    private AdminPrincipal bootstrapAdmin() {
        UUID id = bootstrapService.createFirstAdmin(
                "media.admin", "媒体管理员", "MediaAdmin2026", "bootstrap");
        AdminAccount account = accountRepository.findById(id).orElseThrow();
        return new AdminPrincipal(
                id,
                account.loginNameNormalized(),
                account.displayName(),
                account.role(),
                account.lockVersion(),
                Instant.now());
    }

    @TestConfiguration
    static class FakeStorageConfiguration {

        @Bean
        @Primary
        FakeMediaStorage fakeMediaStorage() {
            return new FakeMediaStorage();
        }
    }

    static class FakeMediaStorage implements MediaStorage {

        private final Map<String, StoredObject> objects = new ConcurrentHashMap<>();
        private String authorizedObjectKey;

        @Override
        public UploadAuthorization authorizeUpload(
                String objectKey,
                String contentType,
                Duration validity) {
            authorizedObjectKey = objectKey;
            OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plus(validity);
            return new UploadAuthorization(
                    "test-bucket-123456",
                    "ap-guangzhou",
                    objectKey,
                    expiresAt,
                    new TemporaryCredentials(
                            "temporary-id",
                            "temporary-key",
                            "temporary-token",
                            expiresAt.minus(validity).toEpochSecond(),
                            expiresAt.toEpochSecond()));
        }

        @Override
        public StoredObject inspect(String objectKey) {
            StoredObject object = objects.get(objectKey);
            if (object == null) {
                throw new MediaStorageException("OBJECT_NOT_FOUND", "object is absent");
            }
            return object;
        }

        @Override
        public void store(
                String objectKey,
                String contentType,
                long sizeBytes,
                InputStream inputStream) {
            try {
                byte[] bytes = inputStream.readAllBytes();
                objects.put(objectKey, new StoredObject(
                        sizeBytes,
                        contentType,
                        "uploaded-etag",
                        bytes.length > 32
                                ? java.util.Arrays.copyOf(bytes, 32)
                                : bytes));
            } catch (IOException exception) {
                throw new MediaStorageException(
                        "OBJECT_UPLOAD_FAILED",
                        "object upload failed",
                        exception);
            }
        }

        @Override
        public SignedObjectUrl signRead(String objectKey, Duration validity) {
            OffsetDateTime expiresAt = OffsetDateTime.now(ZoneOffset.UTC).plus(validity);
            return new SignedObjectUrl(
                    "https://test.invalid/" + objectKey + "?signature=redacted",
                    expiresAt);
        }

        @Override
        public void delete(String objectKey) {
            objects.remove(objectKey);
        }

        void put(String objectKey, StoredObject object) {
            objects.put(objectKey, object);
        }

        String authorizedObjectKey() {
            return authorizedObjectKey;
        }

        void clear() {
            objects.clear();
            authorizedObjectKey = null;
        }
    }
}
