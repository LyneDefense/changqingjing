import { Button, Image, Text, View } from '@tarojs/components'
import Taro, { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getCompanyContent } from '../../services/content'
import type { CompanyContent } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

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

  return (
    <View className='page company-page'>
      <View className='company-page__header'>
        <Text className='section-kicker'>ABOUT US</Text>
        <Text className='company-page__title'>{content.title}</Text>
        <Text className='company-page__summary'>{content.summary}</Text>
      </View>
      {content.coverUrl && (
        <Image
          className='company-page__cover'
          mode='aspectFill'
          src={content.coverUrl}
        />
      )}
      <View className='company-page__body'>
        {content.blocks.map((block, index) => {
          if (block.type === 'HEADING') {
            return <Text className='company-content-heading' key={index}>{block.text}</Text>
          }
          if (block.type === 'IMAGE' && block.imageUrl) {
            return (
              <View className='company-content-image-wrap' key={index}>
                <Image
                  className='company-content-image'
                  mode='widthFix'
                  src={block.imageUrl}
                />
                {block.altText && (
                  <Text className='company-content-caption'>{block.altText}</Text>
                )}
              </View>
            )
          }
          return <Text className='company-content-paragraph' key={index}>{block.text}</Text>
        })}
      </View>
    </View>
  )
}
