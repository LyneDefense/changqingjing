import { Button, Image, Input, Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getProducts } from '../../services/content'
import type { ProductSummary } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

const pageSize = 12

export default function ProductListPage() {
  const auth = useAuth()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const redirecting = useRef(false)

  const loadProducts = useCallback(async (
    targetPage = 1,
    targetKeyword = keyword
  ) => {
    if (auth.status !== 'authenticated') return
    const firstPage = targetPage === 1
    if (firstPage) setLoading(true)
    else setLoadingMore(true)
    setError('')
    try {
      const result = await getProducts({
        page: targetPage,
        pageSize,
        keyword: targetKeyword
      })
      setProducts((current) => firstPage ? result.items : [...current, ...result.items])
      setPage(targetPage)
      setHasMore(targetPage * result.pageSize < result.total)
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError
        ? requestError.message
        : '福利产品暂时无法加载')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      Taro.stopPullDownRefresh()
    }
  }, [auth.status, keyword])

  useEffect(() => {
    if (auth.status === 'initializing') return
    if (auth.status === 'guest') {
      if (!redirecting.current) {
        redirecting.current = true
        void Taro.navigateTo({ url: '/pages/login/index?target=products' })
      }
      return
    }
    redirecting.current = false
  }, [auth.status])

  useEffect(() => {
    if (auth.status === 'authenticated') void loadProducts(1)
  }, [auth.status, loadProducts])

  usePullDownRefresh(() => {
    if (auth.status !== 'authenticated') {
      Taro.stopPullDownRefresh()
      return
    }
    void loadProducts(1)
  })

  useReachBottom(() => {
    if (hasMore && !loadingMore) void loadProducts(page + 1)
  })

  function submitSearch() {
    const nextKeyword = searchInput.trim()
    setKeyword(nextKeyword)
    if (nextKeyword === keyword) void loadProducts(1, nextKeyword)
  }

  if (auth.status !== 'authenticated') {
    return <View className='page product-list-state'><Text>正在进入会员登录…</Text></View>
  }

  return (
    <View className='page product-list-page'>
      <View className='product-search'>
        <View className='product-search__icon' />
        <Input
          className='product-search__input'
          confirmType='search'
          maxlength={100}
          onConfirm={submitSearch}
          onInput={(event) => setSearchInput(event.detail.value)}
          placeholder='搜索福利产品'
          placeholderClass='product-search__placeholder'
          value={searchInput}
        />
        <Button className='product-search__button' onClick={submitSearch}>搜索</Button>
      </View>

      {loading && products.length === 0 && <View className='product-list-state'><Text>正在加载福利产品…</Text></View>}
      {error && (
        <View className='product-list-state product-list-state--error'>
          <Text>{error}</Text>
          <Button className='primary-button' onClick={() => void loadProducts(1)}>重新加载</Button>
        </View>
      )}
      {!loading && !error && products.length === 0 && (
        <View className='product-list-state'>
          <Text>{keyword ? '没有找到符合条件的产品' : '福利产品正在准备中'}</Text>
          {keyword && <Text className='product-list-state__tip'>换个关键词试试</Text>}
        </View>
      )}

      <View className='product-grid'>
        {products.map((product) => (
          <View
            className='product-card'
            hoverClass='product-card--pressed'
            key={product.id}
            onClick={() => void Taro.navigateTo({ url: `/pages/product-detail/index?id=${product.id}` })}
          >
            <Image className='product-card__cover' mode='aspectFill' src={product.coverUrl} />
            <View className='product-card__body'>
              <Text className='product-card__name'>{product.name}</Text>
              <Text className='product-card__summary'>{product.summary}</Text>
              <View className='product-card__footer'>
                <Text className='product-card__link'>查看详情</Text>
                <Text className='product-card__arrow'>›</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
      {loadingMore && <Text className='product-list-footer'>正在加载更多…</Text>}
    </View>
  )
}
