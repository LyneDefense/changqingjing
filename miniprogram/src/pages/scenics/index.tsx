import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getScenics } from '../../services/content'
import type { ScenicSummary } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

const pageSize = 12

export default function ScenicListPage() {
  const [scenics, setScenics] = useState<ScenicSummary[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (targetPage = 1) => {
    const firstPage = targetPage === 1
    if (firstPage) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const result = await getScenics(targetPage, pageSize)
      setScenics((current) => firstPage ? result.items : [...current, ...result.items])
      setPage(targetPage)
      setHasMore(targetPage * result.pageSize < result.total)
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : '景区内容暂时无法加载')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useDidShow(() => {
    void load(1)
  })

  usePullDownRefresh(() => {
    void load(1)
  })

  useReachBottom(() => {
    if (hasMore && !loadingMore) void load(page + 1)
  })

  return (
    <View className='page scenic-list-page'>
      <View className='page-heading'>
        <Text className='page-heading__title'>山水胜境</Text>
        <Text className='page-heading__description'>循文化之脉，抵达值得慢慢感受的风景</Text>
      </View>

      {loading && scenics.length === 0 && <View className='scenic-list-state'><Text>正在加载景区…</Text></View>}
      {error && (
        <View className='scenic-list-state scenic-list-state--error'>
          <Text>{error}</Text>
          <Button className='primary-button' onClick={() => void load(1)}>重新加载</Button>
        </View>
      )}
      {!loading && !error && scenics.length === 0 && (
        <View className='scenic-list-state'><Text>景区内容正在准备中</Text></View>
      )}

      <View className='scenic-list'>
        {scenics.map((scenic) => (
          <View
            className='scenic-card'
            hoverClass='scenic-card--pressed'
            key={scenic.id}
            onClick={() => void Taro.navigateTo({ url: `/pages/scenic-detail/index?id=${scenic.id}` })}
          >
            <Image className='scenic-card__cover' mode='aspectFill' src={scenic.coverUrl} />
            <View className='scenic-card__body'>
              <View className='scenic-card__heading'>
                <Text className='scenic-card__title'>{scenic.title}</Text>
                <Text className={`scenic-status scenic-status--${scenic.openStatus.toLowerCase()}`}>
                  {scenic.openStatus === 'OPEN' ? '正常开放' : '暂停开放'}
                </Text>
              </View>
              <Text className='scenic-card__summary'>{scenic.summary}</Text>
              <Text className='scenic-card__link'>查看详情与导航 →</Text>
            </View>
          </View>
        ))}
      </View>
      {loadingMore && <Text className='scenic-list-footer'>正在加载更多…</Text>}
      {!hasMore && scenics.length > 0 && <Text className='scenic-list-footer'>已经到底了</Text>}
    </View>
  )
}
