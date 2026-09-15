const ADMIN_API_BASE = '/api/v1/admin'

interface ApiResponse<T> {
  data: T
}

interface ApiErrorBody {
  code?: string
  message?: string
  traceId?: string
}

interface CsrfToken {
  headerName: string
  parameterName: string
  token: string
}

export interface AdminUser {
  id: string
  loginName: string
  displayName: string
  role: 'ADMIN' | 'OPERATOR'
  permissions: string[]
}

export type AdminRole = 'ADMIN' | 'OPERATOR'
export type AdminStatus = 'ACTIVE' | 'DISABLED'

export interface AdminStaff {
  id: string
  loginName: string
  displayName: string
  role: AdminRole
  status: AdminStatus
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
  version: number
}

export type AppUserStatus = 'ACTIVE' | 'DISABLED'

export interface RegisteredAppUser {
  id: string
  displayName: string
  maskedPhone?: string
  phoneBound: boolean
  wechatBound: boolean
  status: AppUserStatus
  registeredAt: string
  lastLoginAt?: string
  version: number
}

export interface PageResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface AuditEvent {
  id: string
  actorId?: string
  actorLoginName?: string
  actorDisplayName?: string
  action: string
  actionLabel: string
  module: string
  moduleLabel: string
  targetType: string
  targetId?: string
  targetName?: string
  result: 'SUCCESS' | 'FAILURE'
  affectsOnline?: boolean
  clientIp?: string
  clientSummary: string
  userAgent?: string
  loginBatchId?: string
  traceId: string
  changeSummary: string[]
  failureCode?: string
  createdAt: string
  historical: boolean
}

export interface AuditFilters {
  from?: string
  to?: string
  actor?: string
  keyword?: string
  module?: string
  action?: string
  result?: string
}

export function searchAuditEvents(input: AuditFilters & { page?: number; pageSize?: number }) {
  const query = new URLSearchParams()
  Object.entries(input).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)) })
  return request<PageResponse<AuditEvent>>(`/audit-events?${query}`)
}

export function getAuditEvent(id: string) {
  return request<AuditEvent>(`/audit-events/${encodeURIComponent(id)}`)
}

export interface DashboardStatistics {
  totalRegistrations: number
  todayRegistrations: number
  last7DaysRegistrations: number
  frozenUsers: number
}
export interface DailyRegistration { date: string; count: number }
export interface RecentRegisteredUser {
  id: string
  displayName?: string
  maskedPhone?: string
  avatarUrl?: string
  status: AppUserStatus
  registeredAt: string
}
export interface AdminDashboard {
  userMetricsVisible: boolean
  statistics?: DashboardStatistics
  registrationTrend: DailyRegistration[]
  recentUsers: RecentRegisteredUser[]
  recentOperations: AuditEvent[]
  trendDays: number
  generatedAt: string
  timezone: string
}
export function getAdminDashboard(days: 7 | 30 = 7) {
  return request<AdminDashboard>(`/dashboard?days=${days}`)
}

export interface CreateAdminStaffInput {
  loginName: string
  displayName: string
  role: AdminRole
  initialPassword: string
}

export interface UpdateAdminStaffInput {
  displayName: string
  role: AdminRole
  status: AdminStatus
  expectedVersion: number
}

export type CompanyBlockType = 'HEADING' | 'PARAGRAPH' | 'IMAGE'

export interface CompanyContentBlock {
  type: CompanyBlockType
  text?: string
  mediaId?: string
  altText?: string
}

export interface AdminCompanyRevision {
  id: string
  revisionNumber: number
  title: string
  summary: string
  coverMediaId?: string
  galleryMediaIds?: string[]
  blocks: CompanyContentBlock[]
  createdBy: string
  createdAt: string
}

export interface AdminCompanyContent {
  id?: string
  version: number
  visibility: 'HIDDEN' | 'PUBLISHED'
  firstPublishedAt?: string
  updatedAt?: string
  draft?: AdminCompanyRevision
  published?: AdminCompanyRevision
}

export interface AdminHomeHeroRevision {
  id: string
  revisionNumber: number
  coverMediaId: string
  createdBy: string
  createdAt: string
}

export interface AdminHomeHeroContent {
  id?: string
  version: number
  visibility: 'HIDDEN' | 'PUBLISHED'
  firstPublishedAt?: string
  updatedAt?: string
  draft?: AdminHomeHeroRevision
  published?: AdminHomeHeroRevision
}

export type MediaType = 'IMAGE' | 'VIDEO'
export type MediaStatus = 'UPLOADING' | 'VERIFYING' | 'READY' | 'FAILED' | 'PENDING_DELETE' | 'DELETED'
export type MediaPurpose =
  | 'COMPANY_IMAGE'
  | 'COMPANY_COVER'
  | 'HOME_HERO'
  | 'HOME_VIDEO'
  | 'HOME_VIDEO_COVER'
  | 'SCENIC_IMAGE'
  | 'PRODUCT_IMAGE'
  | 'COOPERATION_IMAGE'

export interface AdminMedia {
  id: string
  originalFilename: string
  mediaType: MediaType
  contentType: string
  sizeBytes: number
  status: MediaStatus
  purpose: MediaPurpose
  failureCode?: string
  verificationAttempts: number
  createdAt: string
  verifiedAt?: string
  previewUrl?: string
  previewExpiresAt?: string
}

export interface MediaUploadAuthorization {
  bucket: string
  region: string
  objectKey: string
  expiresAt: string
  credentials: {
    secretId: string
    secretKey: string
    sessionToken: string
    startTime: number
    expiredTime: number
  }
}

export interface CreateMediaUploadResponse {
  media: AdminMedia
  upload: MediaUploadAuthorization
}

export interface AdminHomeVideoRevision {
  id: string
  revisionNumber: number
  title: string
  videoMediaId: string
  coverMediaId: string
  displayEnabled: boolean
  createdBy: string
  createdAt: string
}

export interface AdminHomeVideoContent {
  id?: string
  version: number
  visibility: 'HIDDEN' | 'PUBLISHED'
  firstPublishedAt?: string
  updatedAt?: string
  draft?: AdminHomeVideoRevision
  published?: AdminHomeVideoRevision
}

export type HomeVideoStatus = 'DRAFT' | 'ONLINE' | 'OFFLINE'

export interface AdminHomeVideoListItem {
  id: string
  version: number
  title: string
  coverMediaId: string
  status: HomeVideoStatus
  hasUnpublishedChanges: boolean
  firstPublishedAt?: string
  updatedAt: string
}

export type ScenicPublicationStatus = 'DRAFT' | 'ONLINE' | 'OFFLINE'
export type ScenicOpenStatus = 'OPEN' | 'PAUSED'

export interface ScenicContentBlock {
  type: CompanyBlockType
  text?: string
  mediaId?: string
  altText?: string
}

export interface ScenicLocation {
  providerName: string
  providerAddress: string
  displayName: string
  nameCustomized: boolean
  longitude: number
  latitude: number
  coordinateSystem: 'GCJ02'
}

export interface MapSelection {
  id: string
  providerName: string
  providerAddress: string
  longitude: number
  latitude: number
  coordinateSystem: 'GCJ02'
  expiresAt: string
}

export type ProductPublicationStatus = 'DRAFT' | 'ONLINE' | 'OFFLINE'

export interface AdminProductCategory {
  id: string
  name: string
  displayOrder: number
  status: ProductPublicationStatus
  hasUnpublishedChanges: boolean
  version: number
  updatedAt: string
}

export interface ProductContentBlock {
  type: CompanyBlockType
  text?: string
  mediaId?: string
  altText?: string
}

export interface AdminProductRevision {
  id: string
  revisionNumber: number
  name: string
  summary: string
  categoryId?: string
  coverMediaId?: string
  listImageMediaIds: string[]
  blocks: ProductContentBlock[]
  specification?: string
  displayOrder: number
  createdBy: string
  createdAt: string
}

export interface AdminProductContent {
  id: string
  version: number
  visibility: 'HIDDEN' | 'PUBLISHED'
  firstPublishedAt?: string
  updatedAt: string
  draft?: AdminProductRevision
  published?: AdminProductRevision
}

export interface AdminProductListItem {
  id: string
  name: string
  coverMediaId?: string
  categoryId?: string
  categoryName?: string
  status: ProductPublicationStatus
  displayOrder: number
  hasUnpublishedChanges: boolean
  version: number
  updatedAt: string
}

export interface CooperationRevenueSection {
  title: string
  description: string
  icon: string
  displayOrder: number
}

export interface CooperationValueSection {
  title: string
  description: string
  imageMediaId?: string
  imageAltText?: string
  displayOrder: number
}

export interface AdminCooperationRevision {
  id: string
  revisionNumber: number
  title: string
  summary: string
  revenueSections: CooperationRevenueSection[]
  valueSections: CooperationValueSection[]
  createdBy: string
  createdAt: string
}

export interface AdminCooperationContent {
  id?: string
  version: number
  visibility: 'HIDDEN' | 'PUBLISHED'
  firstPublishedAt?: string
  updatedAt?: string
  draft?: AdminCooperationRevision
  published?: AdminCooperationRevision
}

export interface AdminScenicRevision {
  id: string
  revisionNumber: number
  title: string
  summary: string
  coverMediaId?: string
  blocks: ScenicContentBlock[]
  openStatus: ScenicOpenStatus
  displayOrder: number
  location?: ScenicLocation
  createdBy: string
  createdAt: string
}

export interface AdminScenicContent {
  id: string
  version: number
  visibility: 'HIDDEN' | 'PUBLISHED'
  firstPublishedAt?: string
  updatedAt: string
  draft?: AdminScenicRevision
  published?: AdminScenicRevision
}

export interface AdminScenicListItem {
  id: string
  version: number
  title: string
  coverMediaId?: string
  status: ScenicPublicationStatus
  openStatus: ScenicOpenStatus
  displayOrder: number
  hasUnpublishedChanges: boolean
  viewCount: number
  updatedAt: string
}

export interface MapSelection {
  id: string
  providerName: string
  providerAddress: string
  longitude: number
  latitude: number
  coordinateSystem: 'GCJ02'
  expiresAt: string
}

export class AdminApiError extends Error {
  readonly status: number
  readonly code: string
  readonly traceId?: string

  constructor(
    status: number,
    code: string,
    message: string,
    traceId?: string,
  ) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
    this.traceId = traceId
  }
}

let csrfToken: CsrfToken | undefined

function emitSessionExpired() {
  window.dispatchEvent(new Event('admin-session-expired'))
}

async function parseError(response: Response) {
  let body: ApiErrorBody = {}
  try {
    body = (await response.json()) as ApiErrorBody
  } catch {
    // Non-JSON gateway failures still become a consistent client error.
  }
  return new AdminApiError(
    response.status,
    body.code ?? 'REQUEST_FAILED',
    body.message ?? '请求失败，请稍后重试',
    body.traceId,
  )
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  notifyUnauthorized = true,
): Promise<T> {
  const response = await fetch(`${ADMIN_API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const error = await parseError(response)
    if (response.status === 401 && notifyUnauthorized) {
      csrfToken = undefined
      emitSessionExpired()
    }
    throw error
  }
  const responseBody = (await response.json()) as ApiResponse<T>
  return responseBody.data
}

export async function refreshCsrfToken() {
  csrfToken = await request<CsrfToken>('/auth/csrf', {}, false)
  return csrfToken
}

async function writeRequest<T>(path: string, init: RequestInit, notifyUnauthorized = true) {
  const currentToken = csrfToken ?? (await refreshCsrfToken())
  return request<T>(
    path,
    {
      ...init,
      headers: {
        ...init.headers,
        [currentToken.headerName]: currentToken.token,
      },
    },
    notifyUnauthorized,
  )
}

export function getCurrentAdmin() {
  return request<AdminUser>('/auth/me', {}, false)
}

export function loginAdmin(loginName: string, password: string) {
  return writeRequest<AdminUser>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ loginName, password }),
    },
    false,
  )
}

export async function logoutAdmin() {
  try {
    await writeRequest<string>('/auth/logout', { method: 'POST' })
  } finally {
    csrfToken = undefined
  }
}

export function searchAdminStaff(options: {
  keyword: string
  status: '' | AdminStatus
  page: number
  pageSize?: number
}) {
  const query = new URLSearchParams({
    keyword: options.keyword,
    page: String(options.page),
    pageSize: String(options.pageSize ?? 20),
  })
  if (options.status) {
    query.set('status', options.status)
  }
  return request<PageResponse<AdminStaff>>(`/staff?${query}`)
}

export function searchRegisteredUsers(options: {
  keyword: string
  status: '' | AppUserStatus
  phoneBound: '' | 'true' | 'false'
  page: number
  pageSize?: number
}) {
  const query = new URLSearchParams({
    keyword: options.keyword,
    page: String(options.page),
    pageSize: String(options.pageSize ?? 20),
  })
  if (options.status) query.set('status', options.status)
  if (options.phoneBound) query.set('phoneBound', options.phoneBound)
  return request<PageResponse<RegisteredAppUser>>(`/users?${query}`)
}

export function getRegisteredUser(userId: string) {
  return request<RegisteredAppUser>(`/users/${encodeURIComponent(userId)}`)
}

export function updateRegisteredUserStatus(user: RegisteredAppUser, status: AppUserStatus) {
  return writeRequest<RegisteredAppUser>(`/users/${encodeURIComponent(user.id)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, expectedVersion: user.version }),
  })
}

export function deleteRegisteredUser(user: RegisteredAppUser) {
  return writeRequest<string>(`/users/${encodeURIComponent(user.id)}?expectedVersion=${user.version}`, {
    method: 'DELETE',
  })
}

export function createAdminStaff(input: CreateAdminStaffInput) {
  return writeRequest<AdminStaff>('/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAdminStaff(accountId: string, input: UpdateAdminStaffInput) {
  return writeRequest<AdminStaff>(`/staff/${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function resetAdminStaffPassword(
  accountId: string,
  newPassword: string,
  expectedVersion: number,
) {
  return writeRequest<AdminStaff>(
    `/staff/${encodeURIComponent(accountId)}/reset-password`,
    {
      method: 'POST',
      body: JSON.stringify({ newPassword, expectedVersion }),
    },
  )
}

export function getAdminCompanyContent() {
  return request<AdminCompanyContent>('/contents/company')
}

export function getAdminHomeHeroContent() {
  return request<AdminHomeHeroContent>('/contents/home-hero')
}

export function saveAdminHomeHeroDraft(input: {
  coverMediaId: string
  expectedVersion: number
}) {
  return writeRequest<AdminHomeHeroContent>('/contents/home-hero/draft', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function publishAdminHomeHero(expectedVersion: number) {
  return writeRequest<AdminHomeHeroContent>('/contents/home-hero/publish', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function unpublishAdminHomeHero(expectedVersion: number) {
  return writeRequest<AdminHomeHeroContent>('/contents/home-hero/unpublish', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function saveAdminCompanyDraft(input: {
  title: string
  summary: string
  coverMediaId?: string
  galleryMediaIds: string[]
  blocks: CompanyContentBlock[]
  expectedVersion: number
}) {
  return writeRequest<AdminCompanyContent>('/contents/company/draft', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function previewAdminCompanyDraft() {
  return request<AdminCompanyRevision>('/contents/company/preview')
}

export function publishAdminCompany(expectedVersion: number) {
  return writeRequest<AdminCompanyContent>('/contents/company/publish', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function unpublishAdminCompany(expectedVersion: number) {
  return writeRequest<AdminCompanyContent>('/contents/company/unpublish', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function createMediaUpload(input: {
  originalFilename: string
  mediaType: MediaType
  contentType: string
  sizeBytes: number
  purpose: MediaPurpose
}) {
  return writeRequest<CreateMediaUploadResponse>('/media/uploads', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function completeMediaUpload(mediaId: string) {
  return writeRequest<AdminMedia>(
    `/media/uploads/${encodeURIComponent(mediaId)}/complete`,
    { method: 'POST' },
  )
}

export function getAdminMedia(mediaId: string) {
  return request<AdminMedia>(`/media/${encodeURIComponent(mediaId)}`)
}

export function searchAdminHomeVideos(input: {
  keyword?: string
  status?: HomeVideoStatus | ''
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (input.keyword) query.set('keyword', input.keyword)
  if (input.status) query.set('status', input.status)
  query.set('page', String(input.page ?? 1))
  query.set('pageSize', String(input.pageSize ?? 20))
  return request<PageResponse<AdminHomeVideoListItem>>(`/contents/home-videos?${query}`)
}

export function getAdminHomeVideoContent(videoId: string) {
  return request<AdminHomeVideoContent>(`/contents/home-videos/${encodeURIComponent(videoId)}`)
}

export interface SaveHomeVideoInput {
  title: string
  videoMediaId: string
  coverMediaId: string
  expectedVersion: number
}

export function createAdminHomeVideo(input: SaveHomeVideoInput) {
  return writeRequest<AdminHomeVideoContent>('/contents/home-videos', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function saveAdminHomeVideoDraft(videoId: string, input: SaveHomeVideoInput) {
  return writeRequest<AdminHomeVideoContent>(`/contents/home-videos/${encodeURIComponent(videoId)}/draft`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function previewAdminHomeVideoDraft(videoId: string) {
  return request<AdminHomeVideoRevision>(`/contents/home-videos/${encodeURIComponent(videoId)}/preview`)
}

export function publishAdminHomeVideo(videoId: string, expectedVersion: number) {
  return writeRequest<AdminHomeVideoContent>(`/contents/home-videos/${encodeURIComponent(videoId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function unpublishAdminHomeVideo(videoId: string, expectedVersion: number) {
  return writeRequest<AdminHomeVideoContent>(`/contents/home-videos/${encodeURIComponent(videoId)}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function deleteAdminHomeVideo(videoId: string, expectedVersion: number) {
  return writeRequest<{ deleted: boolean }>(`/contents/home-videos/${encodeURIComponent(videoId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function searchAdminScenics(input: {
  keyword?: string
  status?: ScenicPublicationStatus | ''
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (input.keyword) query.set('keyword', input.keyword)
  if (input.status) query.set('status', input.status)
  query.set('page', String(input.page ?? 1))
  query.set('pageSize', String(input.pageSize ?? 20))
  return request<PageResponse<AdminScenicListItem>>(`/scenics?${query}`)
}

export function getAdminScenic(scenicId: string) {
  return request<AdminScenicContent>(`/scenics/${encodeURIComponent(scenicId)}`)
}

export interface SaveScenicInput {
  title: string
  summary: string
  coverMediaId?: string
  blocks: ScenicContentBlock[]
  openStatus: ScenicOpenStatus
  displayOrder: number
  displayName?: string
  locationSelectionId?: string
  expectedVersion: number
}

export function createAdminScenic(input: SaveScenicInput) {
  return writeRequest<AdminScenicContent>('/scenics', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function saveAdminScenicDraft(scenicId: string, input: SaveScenicInput) {
  return writeRequest<AdminScenicContent>(`/scenics/${encodeURIComponent(scenicId)}/draft`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function previewAdminScenic(scenicId: string) {
  return request<AdminScenicRevision>(`/scenics/${encodeURIComponent(scenicId)}/preview`)
}

export function publishAdminScenic(scenicId: string, expectedVersion: number) {
  return writeRequest<AdminScenicContent>(`/scenics/${encodeURIComponent(scenicId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function unpublishAdminScenic(scenicId: string, expectedVersion: number) {
  return writeRequest<AdminScenicContent>(`/scenics/${encodeURIComponent(scenicId)}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function deleteAdminScenic(scenicId: string, expectedVersion: number) {
  return writeRequest<{ deleted: boolean }>(`/scenics/${encodeURIComponent(scenicId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function confirmMapSelection(input: {
  providerName: string
  providerAddress: string
  longitude: number
  latitude: number
}) {
  return writeRequest<MapSelection>('/map-selections', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getAdminProductCategories() {
  return request<AdminProductCategory[]>('/product-categories')
}

export interface SaveProductCategoryInput {
  name: string
  displayOrder: number
  expectedVersion: number
}

export function createAdminProductCategory(input: SaveProductCategoryInput) {
  return writeRequest<AdminProductCategory>('/product-categories', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function saveAdminProductCategory(categoryId: string, input: SaveProductCategoryInput) {
  return writeRequest<AdminProductCategory>(`/product-categories/${encodeURIComponent(categoryId)}/draft`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function publishAdminProductCategory(categoryId: string, expectedVersion: number) {
  return writeRequest<AdminProductCategory>(`/product-categories/${encodeURIComponent(categoryId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function unpublishAdminProductCategory(categoryId: string, expectedVersion: number) {
  return writeRequest<AdminProductCategory>(`/product-categories/${encodeURIComponent(categoryId)}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function searchAdminProducts(input: {
  keyword?: string
  status?: ProductPublicationStatus | ''
  categoryId?: string
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (input.keyword) query.set('keyword', input.keyword)
  if (input.status) query.set('status', input.status)
  if (input.categoryId) query.set('categoryId', input.categoryId)
  query.set('page', String(input.page ?? 1))
  query.set('pageSize', String(input.pageSize ?? 20))
  return request<PageResponse<AdminProductListItem>>(`/products?${query}`)
}

export function getAdminProduct(productId: string) {
  return request<AdminProductContent>(`/products/${encodeURIComponent(productId)}`)
}

export interface SaveProductInput {
  name: string
  summary: string
  categoryId?: string
  coverMediaId?: string
  listImageMediaIds: string[]
  blocks: ProductContentBlock[]
  specification?: string
  displayOrder: number
  expectedVersion: number
}

export function createAdminProduct(input: SaveProductInput) {
  return writeRequest<AdminProductContent>('/products', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function saveAdminProductDraft(productId: string, input: SaveProductInput) {
  return writeRequest<AdminProductContent>(`/products/${encodeURIComponent(productId)}/draft`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function previewAdminProduct(productId: string) {
  return request<AdminProductRevision>(`/products/${encodeURIComponent(productId)}/preview`)
}

export function publishAdminProduct(productId: string, expectedVersion: number) {
  return writeRequest<AdminProductContent>(`/products/${encodeURIComponent(productId)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function unpublishAdminProduct(productId: string, expectedVersion: number) {
  return writeRequest<AdminProductContent>(`/products/${encodeURIComponent(productId)}/unpublish`, {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function deleteAdminProduct(productId: string, expectedVersion: number) {
  return writeRequest<{ deleted: boolean }>(`/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function getAdminCooperationContent() {
  return request<AdminCooperationContent>('/contents/cooperation')
}

export interface SaveCooperationInput {
  title: string
  summary: string
  revenueSections: CooperationRevenueSection[]
  valueSections: CooperationValueSection[]
  expectedVersion: number
}

export function saveAdminCooperationDraft(input: SaveCooperationInput) {
  return writeRequest<AdminCooperationContent>('/contents/cooperation/draft', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function previewAdminCooperation() {
  return request<AdminCooperationRevision>('/contents/cooperation/preview')
}

export function publishAdminCooperation(expectedVersion: number) {
  return writeRequest<AdminCooperationContent>('/contents/cooperation/publish', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export function unpublishAdminCooperation(expectedVersion: number) {
  return writeRequest<AdminCooperationContent>('/contents/cooperation/unpublish', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion }),
  })
}

export const adminApi = {
  request,
  writeRequest,
}

export function resetAdminApiForTests() {
  csrfToken = undefined
}
