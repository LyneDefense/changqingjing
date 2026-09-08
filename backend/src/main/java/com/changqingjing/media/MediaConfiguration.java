package com.changqingjing.media;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableConfigurationProperties(MediaProperties.class)
@EnableScheduling
public class MediaConfiguration {

    @Bean
    @ConditionalOnProperty(name = "app.media.cos.enabled", havingValue = "true")
    MediaStorage cosMediaStorage(MediaProperties properties) {
        return new CosMediaStorage(properties.getCos());
    }

    @Bean
    @ConditionalOnMissingBean(MediaStorage.class)
    MediaStorage unavailableMediaStorage() {
        return new UnavailableMediaStorage();
    }
}
