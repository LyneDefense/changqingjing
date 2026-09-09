import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getProductContent } from '../../services/content'
import type { ProductContent } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

export default function ProductDetailPage() {
  const auth = useAuth()
  const [productId, setProductId] = useState('')
  const [content, setContent] = useState<ProductContent>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const redirecting = useRef(false)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError('')
    try {
      setContent(await getProductContent(id))
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.statusCode === 404) {
        setError('这个福利产品已下架或不存在')
      } else {
        setError(requestError instanceof ApiRequestError
          ? requestError.message
          : '福利产品详情暂时无法加载')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useLoad((options) => {
    const id = options.id ?? ''
    setProductId(id)
    if (!id) {
      setLoading(false)
      setError('产品链接无效')
    }
  })

  useEffect(() => {
    if (!productId || auth.status === 'initializing') return
    if (auth.status === 'guest') {
      if (!redirecting.current) {
        redirecting.current = true
        void Taro.navigateTo({
          url: `/pages/login/index?target=product&productId=${encodeURIComponent(productId)}`
        })
      }
      return
    }
    redirecting.current = false
    void load(productId)
  }, [auth.status, load, productId])

  if (auth.status !== 'authenticated') {
    return <View className='page product-detail-state'><Text>正在进入会员登录…</Text></View>
  }

  if (loading) return <View className='page product-detail-state'><Text>正在加载产品详情…</Text></View>

  if (error || !content) {
    return (
      <View className='page product-detail-state product-detail-state--error'>
        <Text>{error || '这件福利产品暂不可查看'}</Text>
        {productId && <Button className='primary-button' onClick={() => void load(productId)}>重新加载</Button>}
        <Button className='product-detail-back' onClick={() => void Taro.navigateBack()}>返回</Button>
      </View>
    )
  }

  return (
    <View className='page product-detail-page'>
      <Image className='product-detail-cover' mode='aspectFill' src={content.coverUrl} />
      <View className='product-detail-heading'>
        {content.categoryName && <Text className='product-detail-category'>{content.categoryName}</Text>}
        <Text className='product-detail-title'>{content.name}</Text>
        <Text className='product-detail-summary'>{content.summary}</Text>
      </View>

      <View className='product-detail-body'>
        {content.blocks.map((block, index) => {
          if (block.type === 'HEADING') return <Text className='product-content-heading' key={index}>{block.text}</Text>
          if (block.type === 'IMAGE' && block.imageUrl) {
            return (
              <View className='product-content-image-wrap' key={index}>
                <Image className='product-content-image' mode='widthFix' src={block.imageUrl} />
                {block.altText && <Text className='product-content-caption'>{block.altText}</Text>}
              </View>
            )
          }
          return <Text className='product-content-paragraph' key={index}>{block.text}</Text>
        })}
      </View>

      {content.specification && (
        <View className='product-specification'>
          <Text className='product-specification__title'>规格说明</Text>
          <Text className='product-specification__content'>{content.specification}</Text>
        </View>
      )}
      <Text className='product-detail-footnote'>本页面仅作福利产品展示，不提供购买、领取或咨询入口。</Text>
    </View>
  )
}
