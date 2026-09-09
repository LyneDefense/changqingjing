import { request } from './request'

export type CompanyBlockType = 'HEADING' | 'PARAGRAPH' | 'IMAGE'

export interface CompanyContentBlock {
  type: CompanyBlockType
  text?: string
  imageUrl?: string
  altText?: string
}

export interface CompanySummary {
  title: string
  summary: string
  coverUrl?: string
}

export interface CompanyContent extends CompanySummary {
  blocks: CompanyContentBlock[]
  firstPublishedAt: string
}

export interface HomeVideo {
  title: string
  coverUrl: string
  playbackUrl: string
}

export interface HomeScenicSummary {
  id: string
  title: string
  summary: string
  coverUrl: string
  displayOrder: number
}

export type ScenicOpenStatus = 'OPEN' | 'PAUSED'

export interface ScenicSummary extends HomeScenicSummary {
  openStatus: ScenicOpenStatus
}

export interface ScenicContent {
  id: string
  title: string
  summary: string
  coverUrl: string
  blocks: CompanyContentBlock[]
  openStatus: ScenicOpenStatus
  displayName: string
  address: string
  longitude: number
  latitude: number
  coordinateSystem: 'GCJ02'
  firstPublishedAt: string
  viewCount: number
}

export interface PageResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface ProductCategory {
  id: string
  name: string
}

export interface ProductSummary {
  id: string
  name: string
  summary: string
  coverUrl: string
  categoryId?: string
  categoryName?: string
}

export interface ProductContentBlock {
  type: CompanyBlockType
  text?: string
  imageUrl?: string
  altText?: string
}

export interface ProductContent extends ProductSummary {
  blocks: ProductContentBlock[]
  specification?: string
}

export interface CooperationRevenueSection {
  title: string
  description: string
  icon: string
}

export interface CooperationValueSection {
  title: string
  description: string
  imageUrl?: string
  imageAltText?: string
}

export interface CooperationContent {
  title: string
  summary: string
  revenueSections: CooperationRevenueSection[]
  valueSections: CooperationValueSection[]
}

export interface HomeContent {
  video?: HomeVideo
  company?: CompanySummary
  scenics: HomeScenicSummary[]
}

export function getHomeContent() {
  return request<HomeContent>({ path: '/home' })
}

export function getCompanyContent() {
  return request<CompanyContent>({ path: '/company' })
}

export function getScenics(page = 1, pageSize = 20) {
  return request<PageResponse<ScenicSummary>>({
    path: `/scenics?page=${page}&pageSize=${pageSize}`
  })
}

export function getScenicContent(scenicId: string) {
  return request<ScenicContent>({ path: `/scenics/${encodeURIComponent(scenicId)}` })
}

export function recordScenicView(scenicId: string, viewId: string) {
  return request<{ viewCount: number }, { viewId: string }>({
    path: `/scenics/${encodeURIComponent(scenicId)}/views`,
    method: 'POST',
    data: { viewId }
  })
}

export function getProductCategories() {
  return request<ProductCategory[]>({ path: '/product-categories' })
}

export function getProducts(options: {
  page?: number
  pageSize?: number
  keyword?: string
  categoryId?: string
}) {
  const query = [
    `page=${options.page ?? 1}`,
    `pageSize=${options.pageSize ?? 12}`
  ]
  if (options.keyword) query.push(`keyword=${encodeURIComponent(options.keyword)}`)
  if (options.categoryId) query.push(`categoryId=${encodeURIComponent(options.categoryId)}`)
  return request<PageResponse<ProductSummary>>({ path: `/products?${query.join('&')}` })
}

export function getProductContent(productId: string) {
  return request<ProductContent>({ path: `/products/${encodeURIComponent(productId)}` })
}

export function getCooperationContent() {
  return request<CooperationContent>({ path: '/cooperation' })
}
