import { Button, Form, Image, Input, Text, View } from '@tarojs/components'
import type { BaseEventOrig } from '@tarojs/components'
import Taro, { getCurrentInstance } from '@tarojs/taro'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  saveCurrentProfile,
  skipCurrentProfileSetup,
  uploadCurrentAvatar
} from '../../services/auth'
import { AuthApiError } from '../../services/auth-api'
import './index.scss'

interface ChooseAvatarDetail {
  avatarUrl?: string
}

interface ProfileFormDetail {
  value?: Record<string, string>
}

type LoginTarget = 'member' | 'profile' | 'products' | 'product'

function initialNickname(displayName?: string) {
  return displayName && !/^微信用户[0-9A-F]{6}$/.test(displayName)
    ? displayName
    : ''
}

export default function ProfileSetupPage() {
  const auth = useAuth()
  const params = getCurrentInstance().router?.params
  const requestedTarget = params?.target
  const target: LoginTarget = requestedTarget === 'profile'
    || requestedTarget === 'products'
    || requestedTarget === 'product'
    ? requestedTarget
    : 'member'
  const productId = params?.productId ?? ''
  const [avatarPath, setAvatarPath] = useState('')
  const [nickname, setNickname] = useState(() => initialNickname(auth.user?.displayName))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const displayedAvatar = avatarPath || auth.user?.avatarUrl || ''

  function chooseAvatar(event: BaseEventOrig<ChooseAvatarDetail>) {
    if (event.detail.avatarUrl) {
      setAvatarPath(event.detail.avatarUrl)
      setError('')
    }
  }

  async function continueToTarget() {
    if (Taro.getCurrentPages().length > 1) {
      try {
        await Taro.navigateBack({ delta: 1 })
        return
      } catch {
        // Continue with a deterministic fallback when this page was opened directly.
      }
    }
    if (target === 'product' && productId) {
      await Taro.redirectTo({
        url: `/pages/product-detail/index?id=${encodeURIComponent(productId)}`
      })
      return
    }
    if (target === 'products') {
      await Taro.redirectTo({ url: '/pages/products/index' })
      return
    }
    await Taro.switchTab({
      url: target === 'profile' ? '/pages/profile/index' : '/pages/member/index'
    })
  }

  async function save(event: BaseEventOrig<ProfileFormDetail>) {
    const submittedNickname = String(event.detail.value?.displayName ?? nickname).trim()
    if (!avatarPath && !submittedNickname && !auth.user?.avatarUrl) {
      setError('请选择头像或填写昵称，也可以暂时跳过')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      if (avatarPath) await uploadCurrentAvatar(avatarPath)
      await saveCurrentProfile(submittedNickname || undefined)
      void Taro.showToast({ title: '资料已保存', icon: 'success' })
      await continueToTarget()
    } catch (saveError) {
      setError(saveError instanceof AuthApiError
        ? saveError.message
        : '资料保存失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  async function skip() {
    setSubmitting(true)
    setError('')
    try {
      await skipCurrentProfileSetup()
      await continueToTarget()
    } catch (skipError) {
      setError(skipError instanceof AuthApiError
        ? skipError.message
        : '暂时无法继续，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className='profile-setup-page'>
      <View className='profile-setup-heading'>
        <Text className='profile-setup-heading__eyebrow'>PERSONAL PROFILE</Text>
        <Text className='profile-setup-heading__title'>完善个人资料</Text>
        <Text className='profile-setup-heading__description'>选择头像和昵称，保存后将在个人中心沿用</Text>
      </View>

      <Form className='profile-setup-form' onSubmit={(event) => void save(event)}>
        <View className='profile-setup-avatar-area'>
          <Button
            className='profile-setup-avatar'
            disabled={submitting}
            hoverClass='profile-setup-avatar--pressed'
            onChooseAvatar={chooseAvatar}
            openType='chooseAvatar'
          >
            {displayedAvatar
              ? <Image className='profile-setup-avatar__image' mode='aspectFill' src={displayedAvatar} />
              : <Text className='profile-setup-avatar__fallback'>常</Text>}
            <View className='profile-setup-avatar__badge'>+</View>
          </Button>
          <Text className='profile-setup-avatar-area__hint'>点击选择微信头像</Text>
        </View>

        <View className='profile-setup-field'>
          <Text className='profile-setup-field__label'>昵称</Text>
          <Input
            className='profile-setup-field__input'
            disabled={submitting}
            maxlength={30}
            name='displayName'
            onInput={(event) => setNickname(event.detail.value)}
            placeholder='点击使用微信昵称或自行填写'
            placeholderClass='profile-setup-field__placeholder'
            type='nickname'
            value={nickname}
          />
        </View>

        {error && <Text className='profile-setup-error'>{error}</Text>}

        <Button
          className='profile-setup-save'
          disabled={submitting}
          formType='submit'
          hoverClass='profile-setup-save--pressed'
        >{submitting ? '正在保存…' : '保存并进入'}</Button>
      </Form>

      <Button
        className='profile-setup-skip'
        disabled={submitting}
        hoverClass='profile-setup-skip--pressed'
        onClick={() => void skip()}
      >暂不设置</Button>

      <View className='profile-setup-landscape' />
    </View>
  )
}
