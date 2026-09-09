import { Button, Text, View } from '@tarojs/components'
import type { BaseEventOrig } from '@tarojs/components'
import Taro, { getCurrentInstance, useUnload } from '@tarojs/taro'
import { useRef, useState } from 'react'
import { registerWithPhoneCode } from '../../services/auth'
import { AuthApiError } from '../../services/auth-api'
import './index.scss'

interface PhoneEventDetail {
  code?: string
  errMsg?: string
}

export default function LoginPage() {
  const target = getCurrentInstance().router?.params.target === 'profile' ? 'profile' : 'member'
  const completed = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useUnload(() => {
    if (!completed.current) {
      void Taro.switchTab({ url: '/pages/index/index' })
    }
  })

  function cancel() {
    completed.current = true
    void Taro.switchTab({ url: '/pages/index/index' })
  }

  async function handlePhoneNumber(event: BaseEventOrig<PhoneEventDetail>) {
    const phoneCode = event.detail.code
    if (!phoneCode) {
      const reason = event.detail.errMsg || ''
      if (reason.includes('deny') || reason.includes('cancel')) {
        cancel()
      } else {
        setError('手机号授权没有完成，请稍后重试')
      }
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await registerWithPhoneCode(phoneCode)
      completed.current = true
      await Taro.navigateBack({ delta: 1 }).catch(() => (
        Taro.switchTab({
          url: target === 'profile' ? '/pages/profile/index' : '/pages/member/index'
        })
      ))
    } catch (loginError) {
      setError(loginError instanceof AuthApiError
        ? loginError.message
        : '登录没有完成，请检查网络后重试')
    } finally {
      setSubmitting(false)
    }
  }

  function showPrivacy() {
    void Taro.showModal({
      title: '用户协议与隐私说明',
      content: '登录时仅使用微信提供的身份凭证和手机号授权凭证建立账号；手机号由服务端加密保存，界面仅显示脱敏号码。',
      showCancel: false,
      confirmText: '我知道了'
    })
  }

  return (
    <View className='login-flow'>
      <View className='login-flow__mark'>常</View>
      <Text className='login-flow__title'>
        登录后查看{target === 'profile' ? '个人中心' : '会员福利'}
      </Text>
      <Text className='login-flow__description'>
        首次登录需要你主动授权微信绑定的手机号，以后会优先恢复已有账号，不会反复要求授权。
      </Text>

      {error && (
        <View className='login-flow__error'>
          <Text>{error}</Text>
          <Text>请重新点击下方按钮重试。</Text>
        </View>
      )}

      <Button
        className='login-flow__primary'
        disabled={submitting}
        onGetPhoneNumber={(event) => void handlePhoneNumber(event)}
        openType='getPhoneNumber'
      >
        {submitting ? '正在登录…' : '微信手机号一键登录'}
      </Button>
      <Button className='login-flow__cancel' disabled={submitting} onClick={cancel}>
        取消并返回首页
      </Button>
      <Text className='login-flow__agreement' onClick={showPrivacy}>
        登录前请阅读《用户协议与隐私说明》
      </Text>
    </View>
  )
}
