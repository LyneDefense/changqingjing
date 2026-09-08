import { Button, Text, View } from '@tarojs/components'
import { PageSection } from '../../components/PageSection'
import { isLoggedIn } from '../../services/auth'

export default function ProfilePage() {
  const loggedIn = isLoggedIn()

  return (
    <View className='page'>
      <View className='page-heading'>
        <Text className='page-heading__title'>{loggedIn ? '微信用户' : '未登录用户'}</Text>
        <Text className='page-heading__description'>可在个人中心主动发起微信登录</Text>
      </View>
      {!loggedIn && <Button className='primary-button'>微信一键登录</Button>}
      <PageSection title='个人资料'>会员等级、余额、功德和会员号</PageSection>
      <PageSection title='更多功能'>我的订单、充值记录、地址管理、我的推荐：敬请期待</PageSection>
    </View>
  )
}
