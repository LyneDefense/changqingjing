package com.changqingjing.media;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class MediaCleanupService {

    private static final Logger log = LoggerFactory.getLogger(MediaCleanupService.class);
    private static final int BATCH_SIZE = 50;

    private final MediaAssetRepository repository;
    private final MediaStorage storage;
    private final Clock clock = Clock.systemUTC();

    public MediaCleanupService(MediaAssetRepository repository, MediaStorage storage) {
        this.repository = repository;
        this.storage = storage;
    }

    @Scheduled(
            fixedDelayString = "${app.media.cleanup.interval-ms:600000}",
            initialDelayString = "${app.media.cleanup.initial-delay-ms:600000}")
    public void cleanExpiredUploads() {
        OffsetDateTime now = now();
        for (UUID id : repository.findExpiredCleanupCandidates(now, BATCH_SIZE)) {
            cleanOne(id, now);
        }
    }

    void cleanOne(UUID id, OffsetDateTime now) {
        if (!repository.markPendingDeleteIfUnreferenced(id, now)) {
            return;
        }
        MediaAssetRepository.Asset asset = repository.findById(id).orElseThrow();
        try {
            storage.delete(asset.objectKey());
            repository.markDeleted(id, now());
        } catch (MediaStorageException exception) {
            repository.markCleanupFailed(id, now());
            log.warn(
                    "Media cleanup failed mediaId={}, errorCode={}",
                    id,
                    exception.getCode());
        }
    }

    private OffsetDateTime now() {
        return OffsetDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }
}
