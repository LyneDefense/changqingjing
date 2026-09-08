import { Text, View } from '@tarojs/components'
import { PageSection } from '../../components/PageSection'

export default function MemberPage() {
  return (
    <View className='page'>
      <View className='page-heading'>
        <Text className='page-heading__title'>会员专区</Text>
        <Text className='page-heading__description'>登录后可查看会员福利产品详情</Text>
      </View>
      <PageSection title='会员福利'>产品列表与多图详情将在内容节点中接入</PageSection>
      <PageSection title='会员空间'>敬请期待</PageSection>
    </View>
  )
}
