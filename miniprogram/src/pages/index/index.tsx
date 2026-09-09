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

  return (
    <View className='page home-page'>
      <View className='home-hero'>
        <Text className='home-hero__eyebrow'>常清净文旅投</Text>
        <Text className='home-hero__title'>循文化之脉，见山水之美</Text>
        <Text className='home-hero__note'>发现值得抵达的风景与故事</Text>
      </View>

      {loading && !content && (
        <View className='home-state'>
          <Text>正在加载首页内容…</Text>
        </View>
      )}

      {error && (
        <View className='home-state home-state--error'>
          <Text>{error}</Text>
          <Button className='retry-button' onClick={() => void load()}>重新加载</Button>
        </View>
      )}

      {!error && content?.video && (
        <View className='home-video-card'>
          <Text className='section-kicker'>FEATURED FILM</Text>
          <Text className='home-video-card__title'>{content.video.title}</Text>
          {!videoFailed ? (
            <Video
              className='home-video'
              controls
              enableProgressGesture
              objectFit='contain'
              onError={() => setVideoFailed(true)}
              poster={content.video.coverUrl}
              showCenterPlayBtn
              showFullscreenBtn
              src={content.video.playbackUrl}
            />
          ) : (
            <View className='media-failure'>
              <Image className='media-failure__cover' mode='aspectFill' src={content.video.coverUrl} />
              <Text>视频暂时无法播放，可能是访问地址已过期。</Text>
              <Button className='retry-button' onClick={() => void load()}>刷新视频</Button>
            </View>
          )}
        </View>
      )}

      {!error && content?.company && (
        <View className='company-card' hoverClass='company-card--pressed' onClick={openCompany}>
          {content.company.coverUrl && (
            <Image
              className='company-card__cover'
              mode='aspectFill'
              src={content.company.coverUrl}
            />
          )}
          <Text className='section-kicker'>ABOUT US</Text>
          <Text className='company-card__title'>{content.company.title}</Text>
          <Text className='company-card__summary'>{content.company.summary}</Text>
          <Text className='company-card__link'>了解更多 →</Text>
        </View>
      )}

      {!error && Boolean(content?.scenics.length) && (
        <View className='home-scenics'>
          <View className='home-section-heading'>
            <View>
              <Text className='section-kicker'>DESTINATIONS</Text>
              <Text className='home-section-title'>景区介绍</Text>
            </View>
            <Text
              className='home-section-link'
              onClick={() => void Taro.navigateTo({ url: '/pages/scenics/index' })}
            >查看全部 →</Text>
          </View>
          <View className='home-scenic-list'>
            {content?.scenics.map((scenic) => (
              <View
                className='home-scenic-card'
                hoverClass='home-scenic-card--pressed'
                key={scenic.id}
                onClick={() => openScenic(scenic.id)}
              >
                <Image className='home-scenic-card__cover' mode='aspectFill' src={scenic.coverUrl} />
                <View className='home-scenic-card__copy'>
                  <Text className='home-scenic-card__title'>{scenic.title}</Text>
                  <Text className='home-scenic-card__summary'>{scenic.summary}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {!loading && !error && !content?.video && !content?.company && !content?.scenics.length && (
        <View className='home-state'>
          <Text className='home-state__title'>内容正在准备中</Text>
          <Text>稍后再来看看新的文旅故事。</Text>
        </View>
      )}
    </View>
  )
}
