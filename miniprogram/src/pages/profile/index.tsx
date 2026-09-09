import { Button, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { PageSection } from '../../components/PageSection'
import { useAuth } from '../../hooks/useAuth'
import './index.scss'

export default function ProfilePage() {
  const auth = useAuth()
  const user = auth.user

  function showComingSoon() {
    void Taro.showToast({ title: '敬请期待', icon: 'none' })
  }

  const unavailableValue = auth.status === 'authenticated' ? '暂未开放' : '—'
  const services = [
    ['会', '成为会员'],
    ['单', '我的订单'],
    ['充', '充值记录'],
    ['址', '地址管理'],
    ['荐', '我的推荐'],
  ]

  return (
    <View className='page profile-page'>
      <View className='profile-card'>
        <View className='profile-avatar'>常</View>
        <View className='profile-card__copy'>
          <Text className='profile-card__name'>
            {auth.status === 'authenticated' ? user?.displayName : '未登录用户'}
          </Text>
          <Text className='profile-card__phone'>
            {auth.status === 'authenticated'
              ? user?.maskedPhone || '手机号未绑定'
              : '登录后可查看会员福利与个人资料'}
          </Text>
        </View>
      </View>
      {auth.status === 'initializing' && (
        <Text className='profile-restoring'>正在恢复登录状态…</Text>
      )}
      {auth.status === 'guest' && (
        <Button
          className='primary-button'
          onClick={() => void Taro.navigateTo({ url: '/pages/login/index?target=profile' })}
        >微信手机号一键登录</Button>
      )}
      <PageSection title='账号信息'>
        {auth.status === 'authenticated'
          ? `用户编号：${user?.id}`
          : '尚未登录，暂无账号资料'}
      </PageSection>
      <View className='profile-metrics'>
        {['会员等级', '余额', '功德', '会员号'].map((label) => (
          <View className='profile-metric' key={label}>
            <Text className='profile-metric__value'>{unavailableValue}</Text>
            <Text className='profile-metric__label'>{label}</Text>
          </View>
        ))}
      </View>
      <View className='profile-services'>
        <Text className='profile-services__heading'>更多服务</Text>
        {services.map(([icon, label]) => (
          <View className='profile-service-row' hoverClass='profile-service-row--pressed' key={label} onClick={showComingSoon}>
            <Text className='profile-service-row__icon'>{icon}</Text>
            <Text className='profile-service-row__label'>{label}</Text>
            <Text className='profile-service-row__status'>敬请期待</Text>
            <Text className='profile-service-row__arrow'>›</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
