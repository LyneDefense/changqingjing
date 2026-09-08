import { Text, View } from '@tarojs/components'
import { PageSection } from '../../components/PageSection'
import './index.scss'

export default function HomePage() {
  return (
    <View className='page home-page'>
      <View className='hero-placeholder'>
        <Text className='hero-label'>宣传视频</Text>
        <Text className='hero-note'>内容将由管理后台维护</Text>
      </View>
      <PageSection title='公司介绍'>展示企业介绍图片和文字内容</PageSection>
      <PageSection title='景区功能'>浏览景区介绍、开放状态和导航地址</PageSection>
    </View>
  )
}
