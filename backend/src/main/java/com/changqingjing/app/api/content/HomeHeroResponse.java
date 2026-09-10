package com.changqingjing.app.api.content;

import com.changqingjing.content.HomeHeroContentService;
import com.changqingjing.media.MediaService;

public record HomeHeroResponse(
        String title, String subtitle, String coverUrl, int focusX, int focusY) {

    public static HomeHeroResponse from(
            HomeHeroContentService.PublishedHomeHero hero, MediaService mediaService) {
        var revision = hero.revision();
        return new HomeHeroResponse(
                revision.title(), revision.subtitle(),
                mediaService.signReadyMedia(revision.coverMediaId()).url(),
                revision.focusX(), revision.focusY());
    }
}
