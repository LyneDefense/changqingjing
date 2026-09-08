package com.changqingjing.media;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(MediaProperties.class)
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
