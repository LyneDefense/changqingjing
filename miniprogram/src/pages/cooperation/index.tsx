import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { getCooperationContent } from '../../services/content'
import type { CooperationContent } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import { syncCustomTabBar } from '../../utils/customTabBar'
import './index.scss'

type CooperationTab = 'revenue' | 'branch' | 'membership'
type CooperationIconKey = 'cooperate' | 'people' | 'lodging' | 'product' | 'nature'
  | 'service' | 'blessing' | 'scenic' | 'tea' | 'general'

const cooperationTabs: Array<{ id: CooperationTab, label: string }> = [
  { id: 'revenue', label: '收益板块' },
  { id: 'branch', label: '分公司方案' },
  { id: 'membership', label: '会员体系' },
]

const cooperationIconKeys = new Set<string>([
  'cooperate', 'people', 'lodging', 'product', 'nature',
  'service', 'blessing', 'scenic', 'tea', 'general',
])

const cooperationTitleIconRules: Array<[string, CooperationIconKey]> = [
  ['招商', 'cooperate'],
  ['合作', 'cooperate'],
  ['招募', 'people'],
  ['会员', 'people'],
  ['民宿', 'lodging'],
  ['住宿', 'lodging'],
  ['基础业务', 'lodging'],
  ['供应链', 'product'],
  ['产品', 'product'],
  ['衍生', 'nature'],
  ['文旅', 'nature'],
  ['特色服务', 'service'],
  ['服务', 'service'],
  ['祈福', 'blessing'],
  ['增项', 'blessing'],
  ['景区', 'scenic'],
  ['山水', 'scenic'],
  ['茶', 'tea'],
]

function resolveCooperationIcon(icon: string | undefined, title: string): CooperationIconKey {
  if (icon && cooperationIconKeys.has(icon)) return icon as CooperationIconKey
  return cooperationTitleIconRules.find(([keyword]) => title.includes(keyword))?.[1] ?? 'general'
}

function RevenueIcon({ icon, title }: { icon?: string, title: string }) {
  const resolved = resolveCooperationIcon(icon, title)
  return <View className={'revenue-card__icon revenue-card__icon--' + resolved} />
}

function CooperationTabIcon({ tab }: { tab: CooperationTab }) {
  if (tab === 'revenue') {
    return (
      <View className='cooperation-tab-icon cooperation-tab-icon--revenue'>
        <View className='cooperation-tab-icon__layer' />
        <View className='cooperation-tab-icon__layer' />
        <View className='cooperation-tab-icon__layer' />
      </View>
    )
  }

  if (tab === 'branch') {
    return (
      <View className='cooperation-tab-icon cooperation-tab-icon--branch'>
        <View className='cooperation-tab-icon__document-line' />
        <View className='cooperation-tab-icon__document-line' />
        <View className='cooperation-tab-icon__document-line' />
      </View>
    )
  }

  return (
    <View className='cooperation-tab-icon cooperation-tab-icon--membership'>
      <View className='cooperation-tab-icon__head' />
      <View className='cooperation-tab-icon__shoulders' />
    </View>
  )
}

function CooperationValueIcon({ index }: { index: number }) {
  const kind = index % 3
  if (kind === 0) {
    return (
      <View className='cooperation-value-icon cooperation-value-icon--growth'>
        <View className='cooperation-value-icon__bar cooperation-value-icon__bar--short' />
        <View className='cooperation-value-icon__bar cooperation-value-icon__bar--medium' />
        <View className='cooperation-value-icon__bar cooperation-value-icon__bar--tall' />
      </View>
    )
  }

  if (kind === 1) {
    return (
      <View className='cooperation-value-icon cooperation-value-icon--link'>
        <View className='cooperation-value-icon__link cooperation-value-icon__link--first' />
        <View className='cooperation-value-icon__link cooperation-value-icon__link--second' />
      </View>
    )
  }

  return <View className='cooperation-value-icon cooperation-value-icon--diamond' />
}

export default function CooperationPage() {
  const [content, setContent] = useState<CooperationContent>()
  const [activeTab, setActiveTab] = useState<CooperationTab>('revenue')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setContent(await getCooperationContent())
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError
        ? requestError.message
        : '合作权益暂时无法加载')
    } finally {
      setLoading(false)
      Taro.stopPullDownRefresh()
    }
  }, [])

  useDidShow(() => {
    syncCustomTabBar(2)
    void load()
  })

  usePullDownRefresh(() => {
    void load()
  })

  return (
    <View className='cooperation-page'>
      <View className='cooperation-hero'>
        <View className='cooperation-hero__copy'>
          <View className='cooperation-hero__brand-row'>
            <Text className='cooperation-hero__title'>常清静文旅投</Text>
            <Text className='cooperation-hero__seal'>净</Text>
          </View>
          <Text className='cooperation-hero__summary'>业务架构与合作权利</Text>
        </View>
      </View>

      <View className='cooperation-tabs'>
        {cooperationTabs.map((tab) => (
          <View
            className={`cooperation-tab${activeTab === tab.id ? ' cooperation-tab--active' : ''}`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            <CooperationTabIcon tab={tab.id} />
            <Text className='cooperation-tab__label'>{tab.label}</Text>
            <View className='cooperation-tab__marker' />
          </View>
        ))}
      </View>

      {loading && !content && <View className='cooperation-state'><Text>正在加载合作权益…</Text></View>}
      {error && (
        <View className='cooperation-state cooperation-state--error'>
          <Text>{error}</Text>
          <Button className='primary-button' onClick={() => void load()}>重新加载</Button>
        </View>
      )}

      {content && (
        <>
          {activeTab === 'revenue' ? (
            <View className='cooperation-revenue-section'>
              <View className='cooperation-section-heading'>
                <Text className='cooperation-section-heading__title'>核心收益来源</Text>
                <Text className='cooperation-section-heading__caption'>七大板块</Text>
              </View>
              <View className='revenue-grid'>
                {content.revenueSections.map((item, index) => (
                  <View className='revenue-card' key={index}>
                    <View className='revenue-card__icon-wrap'>
                      <RevenueIcon icon={item.icon} title={item.title} />
                    </View>
                    <View className='revenue-card__copy'>
                      <Text className='revenue-card__title'>{item.title}</Text>
                      <Text className='revenue-card__description'>{item.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View className='cooperation-coming-soon'>
              <View className='cooperation-coming-soon__landscape' />
              <View className='cooperation-coming-soon__copy'>
                <Text className='cooperation-coming-soon__title'>敬请期待</Text>
                <Text className='cooperation-coming-soon__seal'>净</Text>
              </View>
            </View>
          )}

          <View className='cooperation-value-section'>
            <Text className='cooperation-value-section__heading'>合作价值总结</Text>
            <View className='cooperation-value-list'>
              {content.valueSections.map((item, index) => (
                <View className='cooperation-value-card' key={index}>
                  <View className='cooperation-value-card__icon-wrap'>
                    <CooperationValueIcon index={index} />
                  </View>
                  <Text className='cooperation-value-card__title'>{item.title}</Text>
                  <Text className='cooperation-value-card__description'>{item.description}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  )
}
