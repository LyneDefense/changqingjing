import { Button, Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
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

  const detailImageUrls = content.blocks.flatMap((block) =>
    block.type === 'IMAGE' && block.imageUrl ? [block.imageUrl] : []
  )
  const productImageUrls = content.imageUrls?.length
    ? content.imageUrls
    : [content.coverUrl]
  const hasProductDetail = content.blocks.length > 0 || Boolean(content.specification)

  return (
    <View className='page product-detail-page'>
      <View className='product-detail-hero'>
        <Swiper
          className='product-detail-gallery'
          circular={productImageUrls.length > 1}
          indicatorActiveColor='#f5f2e9'
          indicatorColor='rgba(245, 242, 233, 0.46)'
          indicatorDots={productImageUrls.length > 1}
        >
          {productImageUrls.map((imageUrl, index) => (
            <SwiperItem key={`${imageUrl}-${index}`}>
              <Image
                className='product-detail-cover'
                mode='aspectFill'
                onClick={() => void Taro.previewImage({ current: imageUrl, urls: productImageUrls })}
                src={imageUrl}
              />
            </SwiperItem>
          ))}
        </Swiper>
        {productImageUrls.length > 1 && (
          <Text className='product-detail-gallery__hint'>左右滑动查看</Text>
        )}
      </View>

      <View className='product-detail-intro'>
        {content.categoryName && (
          <View className='product-detail-category-row'>
            <Text className='product-detail-category'>{content.categoryName}</Text>
            <View className='product-detail-category-line' />
          </View>
        )}
        <Text className='product-detail-title'>{content.name}</Text>
        <Text className='product-detail-summary'>{content.summary}</Text>
      </View>

      {content.blocks.length > 0 && (
        <View className='product-detail-section'>
          <View className='product-detail-section__heading'>
            <View className='product-detail-section__mark' />
            <Text>产品详情</Text>
            <View className='product-detail-section__line' />
          </View>
          <View className='product-detail-body'>
            {content.blocks.map((block, index) => {
              if (block.type === 'HEADING') return <Text className='product-content-heading' key={index}>{block.text}</Text>
              if (block.type === 'IMAGE' && block.imageUrl) {
                return (
                  <View className='product-content-image-wrap' key={index}>
                    <Image
                      className='product-content-image'
                      mode='widthFix'
                      onClick={() => void Taro.previewImage({
                        current: block.imageUrl,
                        urls: detailImageUrls,
                      })}
                      src={block.imageUrl}
                    />
                    {block.altText && <Text className='product-content-caption'>{block.altText}</Text>}
                  </View>
                )
              }
              return <Text className='product-content-paragraph' key={index}>{block.text}</Text>
            })}
          </View>
        </View>
      )}

      {content.specification && (
        <View className='product-detail-section product-detail-section--specification'>
          <View className='product-detail-section__heading'>
            <View className='product-detail-section__mark' />
            <Text>规格说明</Text>
            <View className='product-detail-section__line' />
          </View>
          <View className='product-specification'>
            <Text className='product-specification__content'>{content.specification}</Text>
          </View>
        </View>
      )}
      {hasProductDetail && (
        <Text className='product-detail-footnote'>本页面仅作福利产品展示，不提供购买、领取或咨询入口。</Text>
      )}
    </View>
  )
}
