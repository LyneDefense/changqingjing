import { Button, Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getCompanyContent } from '../../services/content'
import type { CompanyContent } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

interface CompanySection {
  title: string
  text: string
  imageUrls: string[]
}

function sectionsFromBlocks(content: CompanyContent): CompanySection[] {
  const sections: CompanySection[] = []
  for (const block of content.blocks) {
    if (block.type === 'HEADING') {
      sections.push({ title: block.text ?? '', text: '', imageUrls: [] })
      continue
    }
    if (block.type === 'PARAGRAPH') {
      if (sections.length === 0) {
        sections.push({ title: '公司介绍', text: '', imageUrls: [] })
      }
      const section = sections[sections.length - 1]
      section.text = [section.text, block.text ?? ''].filter(Boolean).join('\n\n')
      continue
    }
    if (block.type === 'IMAGE' && block.imageUrl) {
      if (sections.length === 0) {
        sections.push({ title: '公司介绍', text: '', imageUrls: [] })
      }
      sections[sections.length - 1].imageUrls.push(block.imageUrl)
    }
  }
  if (content.galleryUrls?.length) {
    if (sections.length === 0) sections.push({ title: '公司介绍', text: '', imageUrls: [] })
    sections[0].imageUrls.push(...content.galleryUrls)
  }
  return sections.filter((section) => section.title || section.text)
}

export default function CompanyPage() {
  const [content, setContent] = useState<CompanyContent>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setContent(await getCompanyContent())
    } catch (requestError) {
      setContent(undefined)
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : '公司介绍暂时无法加载'
      )
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useLoad(() => {
    void load()
  })

  usePullDownRefresh(() => {
    void load()
  })

  if (loading && !content) {
    return (
      <View className='page company-page-state'>
        <Text>正在加载公司介绍…</Text>
      </View>
    )
  }

  if (error || !content) {
    return (
      <View className='page company-page-state company-page-state--error'>
        <Text className='company-page-state__title'>暂时无法查看</Text>
        <Text>{error || '公司介绍暂未发布'}</Text>
        <Button className='retry-button' onClick={() => void load()}>重新加载</Button>
      </View>
    )
  }

  const sections = sectionsFromBlocks(content)

  return (
    <View className='page company-page'>
      <View className='company-page__body'>
        {sections.map((section, index) => (
          <View className='company-content-section' key={`${section.title}-${index}`}>
            <View className='company-content-heading-row'>
              <View className='company-content-heading-mark' />
              <Text className='company-content-heading'>{section.title}</Text>
              <View className='company-content-heading-line' />
            </View>
            <Text className='company-content-paragraph'>{section.text}</Text>
            {section.imageUrls.length > 0 && (
              <View className='company-section-gallery'>
                <Swiper
                  className='company-section-gallery__swiper'
                  circular={section.imageUrls.length > 1}
                  indicatorActiveColor='#f5f2e9'
                  indicatorColor='rgba(245, 242, 233, 0.45)'
                  indicatorDots={section.imageUrls.length > 1}
                >
                  {section.imageUrls.map((imageUrl, imageIndex) => (
                    <SwiperItem key={`${imageUrl}-${imageIndex}`}>
                      <Image
                        className='company-section-gallery__image'
                        mode='aspectFill'
                        src={imageUrl}
                      />
                    </SwiperItem>
                  ))}
                </Swiper>
                {section.imageUrls.length > 1 && (
                  <Text className='company-section-gallery__hint'>左右滑动查看</Text>
                )}
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
