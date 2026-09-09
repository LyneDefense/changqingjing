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
}

export interface PageResponse<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
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

export type MediaType = 'IMAGE' | 'VIDEO'
export type MediaStatus = 'UPLOADING' | 'VERIFYING' | 'READY' | 'FAILED' | 'PENDING_DELETE' | 'DELETED'
export type MediaPurpose =
  | 'COMPANY_IMAGE'
  | 'COMPANY_COVER'
  | 'HOME_VIDEO'
  | 'HOME_VIDEO_COVER'
  | 'SCENIC_IMAGE'

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

export function saveAdminCompanyDraft(input: {
  title: string
  summary: string
  coverMediaId?: string
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

export const adminApi = {
  request,
  writeRequest,
}

export function resetAdminApiForTests() {
  csrfToken = undefined
}
