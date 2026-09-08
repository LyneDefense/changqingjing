import { Button, Text, View } from '@tarojs/components'
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

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setContent(await getHomeContent())
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

      {!error && content?.company && (
        <View className='company-card' hoverClass='company-card--pressed' onClick={openCompany}>
          <Text className='section-kicker'>ABOUT US</Text>
          <Text className='company-card__title'>{content.company.title}</Text>
          <Text className='company-card__summary'>{content.company.summary}</Text>
          <Text className='company-card__link'>了解更多 →</Text>
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
