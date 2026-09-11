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
  const params = getCurrentInstance().router?.params
  const requestedTarget = params?.target
  const target = requestedTarget === 'profile'
    || requestedTarget === 'products'
    || requestedTarget === 'product'
    ? requestedTarget
    : 'member'
  const productId = params?.productId ?? ''
  const completed = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useUnload(() => {
    if (!completed.current && target !== 'profile') {
      void Taro.switchTab({ url: '/pages/member/index' })
    }
  })

  function cancel() {
    completed.current = true
    if (target === 'profile' && Taro.getCurrentPages().length > 1) {
      void Taro.navigateBack({ delta: 1 })
      return
    }
    void Taro.switchTab({ url: target === 'profile' ? '/pages/profile/index' : '/pages/member/index' })
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
      try {
        await Taro.navigateBack({ delta: 1 })
      } catch {
        if (target === 'product' && productId) {
          await Taro.redirectTo({ url: `/pages/product-detail/index?id=${encodeURIComponent(productId)}` })
        } else if (target === 'products') {
          await Taro.redirectTo({ url: '/pages/products/index' })
        } else {
          await Taro.switchTab({
            url: target === 'profile' ? '/pages/profile/index' : '/pages/member/index'
          })
        }
      }
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
      <View className='login-flow__brand'>
        <View className='login-flow__brand-line'>
          <Text className='login-flow__brand-name'>常清净文旅投</Text>
          <Text className='login-flow__seal'>净</Text>
        </View>
        <View className='login-flow__ornament'>
          <View className='login-flow__ornament-line' />
          <View className='login-flow__ornament-accent' />
          <View className='login-flow__ornament-line' />
        </View>
      </View>

      <View className='login-flow__landscape' />

      <View className='login-flow__heading'>
        <Text className='login-flow__title'>登录常清净</Text>
        <Text className='login-flow__description'>山水有意，生活亦可清净</Text>
      </View>

      {error && (
        <View className='login-flow__error'>
          <Text>{error}</Text>
          <Text>请重新点击下方按钮重试。</Text>
        </View>
      )}

      <View className='login-flow__actions'>
        <Button
          className='login-flow__primary'
          disabled={submitting}
          hoverClass='login-flow__primary--pressed'
          onGetPhoneNumber={(event) => void handlePhoneNumber(event)}
          openType='getPhoneNumber'
        >
          {submitting ? '正在登录…' : '微信手机号一键登录'}
        </Button>
        <Button
          className='login-flow__cancel'
          disabled={submitting}
          hoverClass='login-flow__cancel--pressed'
          onClick={cancel}
        >
          暂不登录
        </Button>
      </View>

      <View className='login-flow__agreement' onClick={showPrivacy}>
        <View className='login-flow__agreement-line' />
        <Text className='login-flow__agreement-text'>
          登录即表示已阅读并同意《用户协议》和《隐私政策》
        </Text>
        <View className='login-flow__agreement-line' />
      </View>
    </View>
  )
}
