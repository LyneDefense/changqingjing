import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getCooperationContent } from '../../services/content'
import type { CooperationContent } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import { syncCustomTabBar } from '../../utils/customTabBar'
import './index.scss'

export default function CooperationPage() {
  const [content, setContent] = useState<CooperationContent>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setContent(await getCooperationContent())
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError
        ? requestError.message
        : '合作权益暂时无法加载')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useDidShow(() => {
    syncCustomTabBar(2)
    void load()
  })

  usePullDownRefresh(() => {
    void load()
  })

  function showComingSoon() {
    void Taro.showToast({ title: '敬请期待', icon: 'none' })
  }

  return (
    <View className='page cooperation-page'>
      <View className='cooperation-hero'>
        <Text className='cooperation-hero__eyebrow'>COOPERATION</Text>
        <Text className='cooperation-hero__title'>{content?.title || '合作权益'}</Text>
        <Text className='cooperation-hero__summary'>{content?.summary || '了解核心收益来源与长期合作价值'}</Text>
      </View>

      <View className='cooperation-tabs'>
        <View className='cooperation-tab cooperation-tab--active'><Text>收益板块</Text></View>
        <View className='cooperation-tab' onClick={showComingSoon}><Text>分公司方案</Text></View>
        <View className='cooperation-tab' onClick={showComingSoon}><Text>会员体系</Text></View>
      </View>

      {loading && !content && <View className='cooperation-state'><Text>正在加载合作权益…</Text></View>}
      {error && (
        <View className='cooperation-state cooperation-state--error'>
          <Text>{error}</Text>
          <Button className='primary-button' onClick={() => void load()}>重新加载</Button>
        </View>
      )}

      {content && (
        <>
          <View className='cooperation-section-heading'>
            <Text className='cooperation-section-heading__mark'>✦</Text>
            <Text className='cooperation-section-heading__title'>核心收益来源</Text>
          </View>
          <View className='revenue-grid'>
            {content.revenueSections.map((item, index) => (
              <View className='revenue-card' key={index}>
                <Text className='revenue-card__icon'>{item.icon}</Text>
                <View className='revenue-card__copy'>
                  <Text className='revenue-card__title'>{item.title}</Text>
                  <Text className='revenue-card__description'>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className='cooperation-section-heading cooperation-section-heading--value'>
            <Text className='cooperation-section-heading__mark'>✧</Text>
            <Text className='cooperation-section-heading__title'>合作价值</Text>
          </View>
          <View className='cooperation-value-list'>
            {content.valueSections.map((item, index) => (
              <View className='cooperation-value-card' key={index}>
                {item.imageUrl && <Image className='cooperation-value-card__image' mode='aspectFill' src={item.imageUrl} />}
                <View className='cooperation-value-card__copy'>
                  <Text className='cooperation-value-card__title'>{item.title}</Text>
                  <Text className='cooperation-value-card__description'>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  )
}
