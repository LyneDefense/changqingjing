import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuth } from '../../hooks/useAuth'
import { syncCustomTabBar } from '../../utils/customTabBar'
import './index.scss'

export default function MemberPage() {
  const auth = useAuth()

  useDidShow(() => {
    syncCustomTabBar(1)
  })

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
      <View className='member-section-heading'>
        <Text className='member-section-heading__title'>会员服务</Text>
        <View className='member-section-heading__line' />
      </View>
      <View className='member-service-list'>
        <View
          className='member-service-card'
          hoverClass='member-service-card--pressed'
          onClick={openBenefits}
        >
          <Text className='member-service-card__number'>01</Text>
          <View className='member-service-card__content'>
            <Text className='member-service-card__title'>会员福利</Text>
            <Text className='member-service-card__description'>查看会员专属福利产品</Text>
          </View>
          <Text className='member-service-card__arrow'>›</Text>
        </View>
        <View
          className='member-service-card member-service-card--muted'
          hoverClass='member-service-card--pressed'
          onClick={showComingSoon}
        >
          <Text className='member-service-card__number'>02</Text>
          <View className='member-service-card__content'>
            <Text className='member-service-card__title'>会员空间</Text>
            <Text className='member-service-card__description'>更多会员服务正在准备中</Text>
          </View>
          <Text className='member-service-card__badge'>敬请期待</Text>
        </View>
      </View>
    </View>
  )
}
