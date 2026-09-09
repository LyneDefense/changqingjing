import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import { getScenicContent, recordScenicView } from '../../services/content'
import type { ScenicContent } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

function createViewId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function formatDate(value: string) {
  const date = new Date(value)
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export default function ScenicDetailPage() {
  const [scenicId, setScenicId] = useState('')
  const [content, setContent] = useState<ScenicContent>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const viewId = useRef(createViewId())
  const reported = useRef(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError('')
    try {
      const next = await getScenicContent(id)
      setContent(next)
      if (!reported.current) {
        reported.current = true
        void recordScenicView(id, viewId.current)
          .then((result) => setContent((current) => current ? { ...current, viewCount: result.viewCount } : current))
          .catch(() => {
            reported.current = false
          })
      }
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : '景区详情暂时无法加载')
    } finally {
      setLoading(false)
    }
  }, [])

  useLoad((options) => {
    const id = options.id ?? ''
    setScenicId(id)
    if (id) void load(id)
    else {
      setLoading(false)
      setError('景区链接无效')
    }
  })

  async function navigate() {
    if (!content) return
    try {
      await Taro.openLocation({
        latitude: content.latitude,
        longitude: content.longitude,
        name: content.displayName,
        address: content.address,
        scale: 16
      })
    } catch {
      const result = await Taro.showModal({
        title: '暂时无法打开地图',
        content: '你可以复制详细地址，稍后在地图应用中搜索。',
        confirmText: '复制地址'
      })
      if (result.confirm) await Taro.setClipboardData({ data: content.address })
    }
  }

  if (loading) return <View className='page scenic-detail-state'><Text>正在加载景区详情…</Text></View>

  if (error || !content) {
    return (
      <View className='page scenic-detail-state scenic-detail-state--error'>
        <Text>{error || '这条景区介绍暂不可查看'}</Text>
        {scenicId && <Button className='primary-button' onClick={() => void load(scenicId)}>重新加载</Button>}
      </View>
    )
  }

  return (
    <View className='page scenic-detail-page'>
      <Image className='scenic-detail-cover' mode='aspectFill' src={content.coverUrl} />
      <View className='scenic-detail-heading'>
        <Text className='scenic-detail-title'>{content.title}</Text>
        <Text className={`scenic-detail-status scenic-detail-status--${content.openStatus.toLowerCase()}`}>
          {content.openStatus === 'OPEN' ? '正常开放' : '暂停开放'}
        </Text>
        <Text className='scenic-detail-summary'>{content.summary}</Text>
        <Text className='scenic-detail-meta'>发布于 {formatDate(content.firstPublishedAt)} · 浏览 {content.viewCount}</Text>
      </View>

      <View className='scenic-detail-body'>
        {content.blocks.map((block, index) => {
          if (block.type === 'HEADING') return <Text className='scenic-content-heading' key={index}>{block.text}</Text>
          if (block.type === 'IMAGE' && block.imageUrl) {
            return (
              <View className='scenic-content-image-wrap' key={index}>
                <Image className='scenic-content-image' mode='widthFix' src={block.imageUrl} />
                {block.altText && <Text className='scenic-content-caption'>{block.altText}</Text>}
              </View>
            )
          }
          return <Text className='scenic-content-paragraph' key={index}>{block.text}</Text>
        })}
      </View>

      <View className='scenic-location-card'>
        <View className='scenic-location-copy'>
          <Text className='scenic-location-label'>导航目的地</Text>
          <Text className='scenic-location-name'>{content.displayName}</Text>
          <Text className='scenic-location-address'>{content.address}</Text>
        </View>
        <Button className='primary-button scenic-navigation-button' onClick={() => void navigate()}>开始导航</Button>
      </View>
    </View>
  )
}
