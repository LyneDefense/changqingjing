import { useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAuth } from '../../hooks/useAuth'
import { logoutCurrentUser } from '../../services/auth'
import { syncCustomTabBar } from '../../utils/customTabBar'
import './index.scss'

type ServiceIcon = 'member' | 'order' | 'recharge' | 'address' | 'recommend'

const services: Array<{ icon: ServiceIcon, label: string }> = [
  { icon: 'member', label: '成为会员' },
  { icon: 'order', label: '我的订单' },
  { icon: 'recharge', label: '充值记录' },
  { icon: 'address', label: '地址管理' },
  { icon: 'recommend', label: '我的推荐' },
]

export default function ProfilePage() {
  const auth = useAuth()
  const user = auth.user
  const [loggingOut, setLoggingOut] = useState(false)

  useDidShow(() => {
    syncCustomTabBar(3)
  })

  function showComingSoon(serviceName: string) {
    void Taro.showModal({
      title: '敬请期待',
      content: `${serviceName}功能正在准备中`,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#17463f',
    })
  }

  async function logout() {
    const result = await Taro.showModal({
      title: '退出登录',
      content: '退出后将返回未登录状态，确认退出吗？',
      confirmText: '退出',
      confirmColor: '#a24d40',
    })
    if (!result.confirm) return

    setLoggingOut(true)
    try {
      await logoutCurrentUser()
      void Taro.showToast({ title: '已退出登录', icon: 'success' })
    } catch {
      void Taro.showToast({ title: '已退出当前设备', icon: 'none' })
    } finally {
      setLoggingOut(false)
    }
  }

  const accountDescription = auth.status === 'authenticated'
    ? `用户编号：${user?.id}`
    : '尚未登录，暂无账号资料'

  return (
    <View className='page profile-page'>
      <View className={`profile-card profile-card--${auth.status}`}>
        <View className='profile-card__identity'>
          <View className='profile-avatar'>常</View>
          <View className='profile-card__copy'>
            <Text className='profile-card__name'>
              {auth.status === 'authenticated' ? user?.displayName : '未登录用户'}
            </Text>
            <Text className='profile-card__phone'>
              {auth.status === 'authenticated'
                ? user?.maskedPhone || '手机号未绑定'
                : '登录后完善个人资料'}
            </Text>
          </View>
        </View>
        {auth.status === 'initializing' && (
          <Text className='profile-restoring'>正在恢复登录状态…</Text>
        )}
        {auth.status === 'guest' && (
          <Button
            className='profile-login-button'
            hoverClass='profile-login-button--pressed'
            onClick={() => void Taro.navigateTo({ url: '/pages/login/index?target=profile' })}
          >
            <View className='profile-login-button__wechat' aria-hidden='true'>
              <View className='profile-login-button__bubble profile-login-button__bubble--large' />
              <View className='profile-login-button__bubble profile-login-button__bubble--small' />
            </View>
            <Text>微信手机号一键登录</Text>
            <Text className='profile-login-button__arrow'>›</Text>
          </Button>
        )}
      </View>

      <View className='profile-account'>
        <View className='profile-account__header'>
          <View className='profile-account__copy'>
            <Text className='profile-account__heading'>账户信息</Text>
            <Text className='profile-account__description'>{accountDescription}</Text>
          </View>
          {auth.status === 'authenticated' && (
            <Button
              className='profile-logout-button'
              disabled={loggingOut}
              hoverClass='profile-logout-button--pressed'
              onClick={() => void logout()}
            >{loggingOut ? '退出中…' : '退出登录'}</Button>
          )}
        </View>
        <View className='profile-metrics'>
          {['会员等级', '余额', '功德', '会员号'].map((label) => (
            <View className='profile-metric' key={label}>
              <Text className='profile-metric__value'>—</Text>
              <Text className='profile-metric__label'>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='profile-services'>
        <Text className='profile-services__heading'>更多服务</Text>
        {services.map(({ icon, label }) => (
          <View className='profile-service-row' hoverClass='profile-service-row--pressed' key={label} onClick={() => showComingSoon(label)}>
            <View className='profile-service-row__icon-wrap'>
              <View className={`profile-service-row__icon profile-service-row__icon--${icon}`} />
            </View>
            <Text className='profile-service-row__label'>{label}</Text>
            <Text className='profile-service-row__arrow'>›</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
