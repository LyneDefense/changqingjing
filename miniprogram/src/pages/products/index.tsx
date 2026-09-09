import { Button, Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { getProductCategories, getProducts } from '../../services/content'
import type { ProductCategory, ProductSummary } from '../../services/content'
import { ApiRequestError } from '../../services/request'
import './index.scss'

const pageSize = 12

export default function ProductListPage() {
  const auth = useAuth()
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const redirecting = useRef(false)

  const loadProducts = useCallback(async (
    targetPage = 1,
    targetKeyword = keyword,
    targetCategoryId = categoryId
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
        keyword: targetKeyword,
        categoryId: targetCategoryId
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
  }, [auth.status, categoryId, keyword])

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
    void getProductCategories().then(setCategories).catch(() => setCategories([]))
  }, [auth.status])

  useEffect(() => {
    if (auth.status === 'authenticated') void loadProducts(1)
  }, [auth.status, loadProducts])

  usePullDownRefresh(() => {
    if (auth.status !== 'authenticated') {
      Taro.stopPullDownRefresh()
      return
    }
    void Promise.all([
      getProductCategories().then(setCategories).catch(() => setCategories([])),
      loadProducts(1)
    ])
  })

  useReachBottom(() => {
    if (hasMore && !loadingMore) void loadProducts(page + 1)
  })

  function submitSearch() {
    const nextKeyword = searchInput.trim()
    setKeyword(nextKeyword)
    if (nextKeyword === keyword) void loadProducts(1, nextKeyword, categoryId)
  }

  function chooseCategory(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
    if (nextCategoryId === categoryId) void loadProducts(1, keyword, nextCategoryId)
  }

  if (auth.status !== 'authenticated') {
    return <View className='page product-list-state'><Text>正在进入会员登录…</Text></View>
  }

  return (
    <View className='page product-list-page'>
      <View className='product-list-hero'>
        <Text className='product-list-hero__eyebrow'>MEMBER BENEFITS</Text>
        <Text className='product-list-hero__title'>会员福利</Text>
        <Text className='product-list-hero__description'>发现常清净精选的文旅与康养好物</Text>
      </View>

      <View className='product-search'>
        <Input
          className='product-search__input'
          confirmType='search'
          maxlength={100}
          onConfirm={submitSearch}
          onInput={(event) => setSearchInput(event.detail.value)}
          placeholder='搜索福利产品'
          value={searchInput}
        />
        <Button className='product-search__button' onClick={submitSearch}>搜索</Button>
      </View>

      {categories.length > 0 && (
        <ScrollView className='product-categories' enhanced scrollX showScrollbar={false}>
          <View className='product-categories__inner'>
            <Text className={`product-category ${categoryId ? '' : 'product-category--active'}`} onClick={() => chooseCategory('')}>全部</Text>
            {categories.map((category) => (
              <Text
                className={`product-category ${categoryId === category.id ? 'product-category--active' : ''}`}
                key={category.id}
                onClick={() => chooseCategory(category.id)}
              >{category.name}</Text>
            ))}
          </View>
        </ScrollView>
      )}

      {loading && products.length === 0 && <View className='product-list-state'><Text>正在加载福利产品…</Text></View>}
      {error && (
        <View className='product-list-state product-list-state--error'>
          <Text>{error}</Text>
          <Button className='primary-button' onClick={() => void loadProducts(1)}>重新加载</Button>
        </View>
      )}
      {!loading && !error && products.length === 0 && (
        <View className='product-list-state'>
          <Text>{keyword || categoryId ? '没有找到符合条件的产品' : '福利产品正在准备中'}</Text>
          {(keyword || categoryId) && <Text className='product-list-state__tip'>换个关键词或分类试试</Text>}
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
              {product.categoryName && <Text className='product-card__category'>{product.categoryName}</Text>}
              <Text className='product-card__name'>{product.name}</Text>
              <Text className='product-card__summary'>{product.summary}</Text>
              <Text className='product-card__link'>查看详情</Text>
            </View>
          </View>
        ))}
      </View>
      {loadingMore && <Text className='product-list-footer'>正在加载更多…</Text>}
      {!hasMore && products.length > 0 && <Text className='product-list-footer'>已经到底了</Text>}
    </View>
  )
}
