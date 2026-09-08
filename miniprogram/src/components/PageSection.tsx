import { PropsWithChildren } from 'react'
import { Text, View } from '@tarojs/components'
import './PageSection.scss'

interface PageSectionProps extends PropsWithChildren {
  title: string
}

export function PageSection({ title, children }: PageSectionProps) {
  return (
    <View className='page-section'>
      <Text className='page-section__title'>{title}</Text>
      <Text className='page-section__description'>{children}</Text>
    </View>
  )
}
