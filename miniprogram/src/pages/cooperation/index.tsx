import { Text, View } from '@tarojs/components'
import { PageSection } from '../../components/PageSection'

export default function CooperationPage() {
  return (
    <View className='page'>
      <View className='page-heading'>
        <Text className='page-heading__title'>合作权益</Text>
        <Text className='page-heading__description'>了解业务架构与合作价值</Text>
      </View>
      <PageSection title='收益版块'>展示七大核心收益来源与合作价值</PageSection>
      <PageSection title='分公司方案'>敬请期待</PageSection>
      <PageSection title='会员体系'>敬请期待</PageSection>
    </View>
  )
}
