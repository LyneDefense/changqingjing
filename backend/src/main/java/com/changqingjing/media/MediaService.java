package com.changqingjing.media;

import com.changqingjing.admin.api.media.AdminMediaResponse;
import com.changqingjing.admin.api.media.CreateMediaUploadRequest;
import com.changqingjing.admin.api.media.CreateMediaUploadResponse;
import com.changqingjing.admin.api.media.MediaUploadAuthorizationResponse;
import com.changqingjing.admin.audit.AdminAuditService;
import com.changqingjing.admin.auth.AdminPrincipal;
import com.changqingjing.common.api.BusinessException;
import java.io.IOException;
import java.io.InputStream;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaService {

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg",
            "image/png", "png",
            "image/webp", "webp",
            "video/mp4", "mp4");
    private static final Set<String> IMAGE_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp");
    private static final Set<String> VIDEO_CONTENT_TYPES = Set.of("video/mp4");

    private final MediaAssetRepository repository;
    private final MediaStorage storage;
    private final MediaProperties properties;
    private final AdminAuditService auditService;
    private final Clock clock = Clock.systemUTC();

    public MediaService(
            MediaAssetRepository repository,
            MediaStorage storage,
            MediaProperties properties,
            AdminAuditService auditService) {
        this.repository = repository;
        this.storage = storage;
        this.properties = properties;
        this.auditService = auditService;
    }

    @Transactional
    public CreateMediaUploadResponse createUpload(
            CreateMediaUploadRequest request,
            AdminPrincipal actor,
            String traceId) {
        String filename = normalizedFilename(request.originalFilename());
        String contentType = request.contentType().strip().toLowerCase(Locale.ROOT);
        validateUpload(request, contentType);
        UUID id = UUID.randomUUID();
        String objectKey = objectKey(id, contentType);
        MediaStorage.UploadAuthorization authorization;
        try {
            authorization = storage.authorizeUpload(
                    objectKey,
                    contentType,
                    properties.getUploadCredentialTtl());
        } catch (MediaStorageException exception) {
            throw storageUnavailable(exception);
        }
        OffsetDateTime now = now();
        MediaAssetRepository.Asset asset = repository.insert(
                id,
                objectKey,
                filename,
                request.mediaType(),
                contentType,
                request.sizeBytes(),
                request.purpose(),
                actor.accountId(),
                now,
                authorization.expiresAt());
        auditService.recordSuccess(
                actor.accountId(),
                "MEDIA_UPLOAD_CREATE",
                "MEDIA_ASSET",
                id,
                traceId,
                Map.of(
                        "mediaType", request.mediaType().name(),
                        "purpose", request.purpose().name(),
                        "sizeBytes", request.sizeBytes()));
        return new CreateMediaUploadResponse(
                AdminMediaResponse.from(asset, null, null),
                MediaUploadAuthorizationResponse.from(authorization));
    }

    @Transactional
    public AdminMediaResponse completeUpload(
            UUID id,
            AdminPrincipal actor,
            String traceId) {
        MediaAssetRepository.Asset asset = requiredAsset(id);
        if (asset.status() == MediaStatus.READY) {
            return responseWithPreview(asset);
        }
        if (!repository.markVerifying(id, now())) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "MEDIA_STATE_CONFLICT",
                    "当前媒体状态不能执行上传完成确认");
        }

        String failureCode = null;
        MediaStorage.StoredObject storedObject = null;
        try {
            storedObject = storage.inspect(asset.objectKey());
            failureCode = verificationFailure(asset, storedObject);
        } catch (MediaStorageException exception) {
            failureCode = exception.getCode();
        }

        if (failureCode != null) {
            repository.markFailed(id, failureCode, now());
            auditService.recordFailure(
                    actor.accountId(),
                    "MEDIA_UPLOAD_VERIFY",
                    "MEDIA_ASSET",
                    id,
                    traceId);
            return AdminMediaResponse.from(requiredAsset(id), null, null);
        }

        repository.markReady(id, storedObject.etag(), now());
        auditService.recordSuccess(
                actor.accountId(),
                "MEDIA_UPLOAD_VERIFY",
                "MEDIA_ASSET",
                id,
                traceId,
                Map.of("etag", safeEtag(storedObject.etag())));
        return responseWithPreview(requiredAsset(id));
    }

    @Transactional(readOnly = true)
    public AdminMediaResponse getAdminMedia(UUID id) {
        return responseWithPreview(requiredAsset(id));
    }

    @Transactional(readOnly = true)
    public MediaAssetRepository.Asset requireReady(UUID id) {
        MediaAssetRepository.Asset asset = requiredAsset(id);
        if (asset.status() != MediaStatus.READY) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "MEDIA_NOT_READY",
                    "所选媒体尚未完成校验");
        }
        return asset;
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public MediaAssetRepository.Asset storeAppAvatar(
            MultipartFile file,
            UUID appUserId) {
        if (file == null || file.isEmpty()) {
            throw invalid("请选择头像图片");
        }
        String filename = normalizedFilename(
                file.getOriginalFilename() == null ? "avatar" : file.getOriginalFilename());
        String contentType = avatarContentType(file);
        CreateMediaUploadRequest request = new CreateMediaUploadRequest(
                filename,
                MediaType.IMAGE,
                contentType,
                file.getSize(),
                MediaPurpose.APP_USER_AVATAR);
        validateUpload(request, contentType);

        UUID id = UUID.randomUUID();
        String objectKey = objectKey(id, contentType);
        OffsetDateTime now = now();
        repository.insertAppUserUpload(
                id,
                objectKey,
                filename,
                MediaType.IMAGE,
                contentType,
                file.getSize(),
                MediaPurpose.APP_USER_AVATAR,
                appUserId,
                now,
                now.plus(properties.getUploadCredentialTtl()));

        try (InputStream inputStream = file.getInputStream()) {
            storage.store(objectKey, contentType, file.getSize(), inputStream);
        } catch (IOException exception) {
            repository.markFailed(id, "MEDIA_UPLOAD_READ_FAILED", now());
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_UPLOAD_READ_FAILED",
                    "无法读取所选头像，请重新选择");
        } catch (MediaStorageException exception) {
            repository.markFailed(id, exception.getCode(), now());
            throw storageUnavailable(exception);
        }

        if (!repository.markVerifying(id, now())) {
            throw new BusinessException(
                    HttpStatus.CONFLICT,
                    "MEDIA_STATE_CONFLICT",
                    "当前头像状态不能执行校验");
        }
        MediaStorage.StoredObject storedObject;
        try {
            storedObject = storage.inspect(objectKey);
        } catch (MediaStorageException exception) {
            repository.markFailed(id, exception.getCode(), now());
            throw storageUnavailable(exception);
        }
        String failureCode = verificationFailure(requiredAsset(id), storedObject);
        if (failureCode != null) {
            repository.markFailed(id, failureCode, now());
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    failureCode,
                    "头像图片格式不正确，请重新选择");
        }
        repository.markReady(id, storedObject.etag(), now());
        return requiredAsset(id);
    }

    private String avatarContentType(MultipartFile file) {
        String declared = file.getContentType() == null
                ? ""
                : file.getContentType().strip().toLowerCase(Locale.ROOT);
        if (IMAGE_CONTENT_TYPES.contains(declared)) {
            return declared;
        }
        try (InputStream inputStream = file.getInputStream()) {
            byte[] header = inputStream.readNBytes(12);
            if (startsWith(header, "ffd8ff")) {
                return "image/jpeg";
            }
            if (startsWith(header, "89504e470d0a1a0a")) {
                return "image/png";
            }
            if (startsWith(header, "52494646") && at(header, 8, "57454250")) {
                return "image/webp";
            }
            return declared;
        } catch (IOException exception) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_UPLOAD_READ_FAILED",
                    "无法读取所选头像，请重新选择");
        }
    }

    public MediaStorage.SignedObjectUrl signReadyMedia(UUID id) {
        MediaAssetRepository.Asset asset = requireReady(id);
        try {
            return storage.signRead(asset.objectKey(), properties.getReadUrlTtl());
        } catch (MediaStorageException exception) {
            throw storageUnavailable(exception);
        }
    }

    private AdminMediaResponse responseWithPreview(MediaAssetRepository.Asset asset) {
        if (asset.status() != MediaStatus.READY) {
            return AdminMediaResponse.from(asset, null, null);
        }
        MediaStorage.SignedObjectUrl signed = signReadyMedia(asset.id());
        return AdminMediaResponse.from(asset, signed.url(), signed.expiresAt());
    }

    private void validateUpload(CreateMediaUploadRequest request, String contentType) {
        if (request.purpose().mediaType() != request.mediaType()) {
            throw invalid("媒体类型与使用场景不匹配");
        }
        Set<String> allowed = request.mediaType() == MediaType.IMAGE
                ? IMAGE_CONTENT_TYPES
                : VIDEO_CONTENT_TYPES;
        if (!allowed.contains(contentType)) {
            throw invalid(request.mediaType() == MediaType.IMAGE
                    ? "图片仅支持 JPEG、PNG 或 WebP"
                    : "视频仅支持 MP4");
        }
        long limit = request.mediaType() == MediaType.IMAGE
                ? properties.getMaxImageBytes()
                : properties.getMaxVideoBytes();
        if (request.sizeBytes() > limit) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "MEDIA_SIZE_EXCEEDED",
                    "文件大小超过当前上传限制");
        }
    }

    private String verificationFailure(
            MediaAssetRepository.Asset expected,
            MediaStorage.StoredObject actual) {
        if (actual.sizeBytes() != expected.sizeBytes()) {
            return "MEDIA_SIZE_MISMATCH";
        }
        if (actual.contentType() == null
                || !expected.contentType().equals(actual.contentType().toLowerCase(Locale.ROOT))) {
            return "MEDIA_CONTENT_TYPE_MISMATCH";
        }
        if (actual.etag() == null || actual.etag().isBlank()) {
            return "MEDIA_ETAG_MISSING";
        }
        return matchesMagic(expected.contentType(), actual.header())
                ? null
                : "MEDIA_FILE_SIGNATURE_INVALID";
    }

    private boolean matchesMagic(String contentType, byte[] header) {
        return switch (contentType) {
            case "image/jpeg" -> startsWith(header, "ffd8ff");
            case "image/png" -> startsWith(header, "89504e470d0a1a0a");
            case "image/webp" -> startsWith(header, "52494646")
                    && at(header, 8, "57454250");
            case "video/mp4" -> at(header, 4, "66747970");
            default -> false;
        };
    }

    private boolean startsWith(byte[] source, String hex) {
        return at(source, 0, hex);
    }

    private boolean at(byte[] source, int offset, String hex) {
        byte[] expected = HexFormat.of().parseHex(hex);
        if (source.length < offset + expected.length) {
            return false;
        }
        for (int index = 0; index < expected.length; index++) {
            if (source[offset + index] != expected[index]) {
                return false;
            }
        }
        return true;
    }

    private String objectKey(UUID id, String contentType) {
        String prefix = properties.getObjectPrefix().strip();
        if (!prefix.matches("[A-Za-z0-9/_-]+")) {
            throw new IllegalStateException("app.media.object-prefix contains invalid characters");
        }
        OffsetDateTime now = now();
        return "%s/%04d/%02d/%s.%s".formatted(
                prefix.replaceAll("^/+|/+$", ""),
                now.getYear(),
                now.getMonthValue(),
                id,
                EXTENSIONS.get(contentType));
    }

    private String normalizedFilename(String filename) {
        String normalized = filename.strip();
        if (normalized.isEmpty() || normalized.chars().anyMatch(Character::isISOControl)) {
            throw invalid("文件名不合法");
        }
        return normalized;
    }

    private String safeEtag(String etag) {
        return etag.length() <= 100 ? etag : etag.substring(0, 100);
    }

    private MediaAssetRepository.Asset requiredAsset(UUID id) {
        return repository.findById(id).orElseThrow(() -> new BusinessException(
                HttpStatus.NOT_FOUND,
                "MEDIA_NOT_FOUND",
                "媒体资源不存在"));
    }

    private BusinessException invalid(String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, "MEDIA_INVALID", message);
    }

    private BusinessException storageUnavailable(MediaStorageException exception) {
        return new BusinessException(
                HttpStatus.SERVICE_UNAVAILABLE,
                exception.getCode(),
                exception.getMessage());
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
