package com.changqingjing.app.api.content;

import com.changqingjing.content.HomeHeroContentService;
import com.changqingjing.media.MediaService;

public record HomeHeroResponse(String coverUrl) {

    public static HomeHeroResponse from(
            HomeHeroContentService.PublishedHomeHero hero, MediaService mediaService) {
        var revision = hero.revision();
        return new HomeHeroResponse(mediaService.signReadyMedia(revision.coverMediaId()).url());
    }
}
