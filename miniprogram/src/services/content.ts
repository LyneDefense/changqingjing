import { request } from './request'

export type CompanyBlockType = 'HEADING' | 'PARAGRAPH'

export interface CompanyContentBlock {
  type: CompanyBlockType
  text: string
}

export interface CompanySummary {
  title: string
  summary: string
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

export interface HomeContent {
  video?: HomeVideo
  company?: CompanySummary
  scenics: HomeScenicSummary[]
}

export function getHomeContent() {
  return request<HomeContent>({ path: '/api/v1/app/home' })
}

export function getCompanyContent() {
  return request<CompanyContent>({ path: '/api/v1/app/company' })
}
