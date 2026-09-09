import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuth } from '../../hooks/useAuth'
import './index.scss'

export default function MemberPage() {
  const auth = useAuth()

  function openBenefits() {
    if (auth.status === 'authenticated') {
      void Taro.navigateTo({ url: '/pages/products/index' })
      return
    }
    void Taro.navigateTo({ url: '/pages/login/index?target=products' })
  }

  function showComingSoon() {
    void Taro.showToast({ title: '敬请期待', icon: 'none' })
  }

  return (
    <View className='page member-page'>
      <View className='member-hero'>
        <Text className='member-hero__eyebrow'>MEMBER SERVICES</Text>
        <Text className='member-hero__title'>会员专区</Text>
        <Text className='member-hero__description'>选择你要访问的服务</Text>
      </View>
      <View className='member-service-card' onClick={openBenefits}>
        <View className='member-service-card__icon'>礼</View>
        <View className='member-service-card__content'>
          <Text className='member-service-card__title'>会员福利</Text>
          <Text className='member-service-card__description'>查看会员专属福利产品</Text>
          <Text className='member-service-card__status'>
            {auth.status === 'authenticated' ? '已登录，可直接进入' : '需要微信手机号登录'}
          </Text>
        </View>
        <Text className='member-service-card__arrow'>›</Text>
      </View>
      <View className='member-service-card member-service-card--muted' onClick={showComingSoon}>
        <View className='member-service-card__icon'>享</View>
        <View className='member-service-card__content'>
          <Text className='member-service-card__title'>会员空间</Text>
          <Text className='member-service-card__description'>更多会员服务正在准备中</Text>
          <Text className='member-service-card__status'>敬请期待</Text>
        </View>
      </View>
    </View>
  )
}
