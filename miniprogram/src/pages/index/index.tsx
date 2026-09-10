import { Button, Image, Text, Video, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getHomeContent } from '../../services/content'
import type { HomeContent } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

export default function HomePage() {
  const [content, setContent] = useState<HomeContent>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [videoFailed, setVideoFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setContent(await getHomeContent())
      setVideoFailed(false)
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : '首页内容暂时无法加载'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    void load()
  })

  function openCompany() {
    void Taro.navigateTo({ url: '/pages/company/index' })
  }

  function openScenic(scenicId: string) {
    void Taro.navigateTo({ url: `/pages/scenic-detail/index?id=${scenicId}` })
  }

  const scenic = content?.scenics[0]
  const heroHasCopy = Boolean(content?.hero?.title || content?.hero?.subtitle)

  return (
    <View className='page home-page'>
      {content?.hero && (
        <View className='home-hero'>
          <Image
            className='home-hero__image'
            mode='aspectFill'
            src={content.hero.coverUrl}
            style={{ objectPosition: `${content.hero.focusX}% ${content.hero.focusY}%` }}
          />
          {heroHasCopy && (
            <View className='home-hero__copy'>
              {content.hero.title && (
                <Text className='home-hero__title'>{content.hero.title}</Text>
              )}
              {content.hero.subtitle && (
                <Text className='home-hero__subtitle'>{content.hero.subtitle}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {loading && !content && (
        <View className='home-state'>
          <View className='home-state__mark' />
          <Text>正在加载首页内容…</Text>
        </View>
      )}

      {error && (
        <View className='home-state home-state--error'>
          <Text className='home-state__title'>暂时无法加载</Text>
          <Text>{error}</Text>
          <Button className='retry-button' onClick={() => void load()}>重新加载</Button>
        </View>
      )}

      {!error && content?.video && (
        <View className='home-video-section'>
          <View className='home-section-heading'>
            <View className='home-section-heading__copy'>
              <Text className='home-section-kicker'>本期影像</Text>
              <Text className='home-section-title home-video-card__title'>{content.video.title}</Text>
            </View>
            <View className='home-section-heading__line' />
          </View>
          <View className='home-video-frame'>
            {!videoFailed ? (
              <Video
                autoplay={false}
                className='home-video'
                controls
                enableProgressGesture
                loop={false}
                objectFit='contain'
                onError={() => setVideoFailed(true)}
                poster={content.video.coverUrl}
                showCenterPlayBtn
                showFullscreenBtn
                showPlayBtn
                src={content.video.playbackUrl}
              />
            ) : (
              <View className='media-failure'>
                <Image className='media-failure__cover' mode='aspectFill' src={content.video.coverUrl} />
                <View className='media-failure__copy'>
                  <Text>视频暂时无法播放，访问地址可能已过期。</Text>
                  <Button className='retry-button retry-button--light' onClick={() => void load()}>刷新视频</Button>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {!error && content?.company && (
        <View
          className={`company-card${content.company.coverUrl ? '' : ' company-card--text-only'}`}
          hoverClass='home-card--pressed'
          onClick={openCompany}
        >
          <View className='company-card__copy'>
            <View className='content-heading'>
              <Text className='content-heading__title company-card__title'>{content.company.title}</Text>
              <View className='content-heading__line' />
            </View>
            <Text className='company-card__summary'>{content.company.summary}</Text>
            <Text className='home-card-link'>了解我们 <Text className='home-card-link__arrow'>→</Text></Text>
          </View>
          {content.company.coverUrl && (
            <Image
              className='company-card__cover'
              mode='aspectFill'
              src={content.company.coverUrl}
            />
          )}
          <Text className='company-card__seal'>净</Text>
        </View>
      )}

      {!error && scenic && (
        <View className='home-scenic-section'>
          <View className='content-heading content-heading--outside'>
            <Text className='content-heading__title'>景区介绍</Text>
            <View className='content-heading__line' />
          </View>
          <View
            className='home-scenic-card'
            hoverClass='home-card--pressed'
            onClick={() => openScenic(scenic.id)}
          >
            <Image className='home-scenic-card__cover' mode='aspectFill' src={scenic.coverUrl} />
            <View className='home-scenic-card__copy'>
              <View className='home-scenic-card__heading'>
                <Text className='home-scenic-card__title'>{scenic.title}</Text>
                <Text className='home-scenic-card__arrow'>→</Text>
              </View>
              <Text className='home-scenic-card__summary'>{scenic.summary}</Text>
            </View>
          </View>
        </View>
      )}

      {!loading && !error && !content?.hero && !content?.video && !content?.company && !scenic && (
        <View className='home-state'>
          <View className='home-state__mark' />
          <Text className='home-state__title'>内容正在准备中</Text>
          <Text>稍后再来看看。</Text>
        </View>
      )}
    </View>
  )
}
