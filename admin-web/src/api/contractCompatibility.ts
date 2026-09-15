import type {
  AdminCompanyContent,
  AdminCompanyRevision,
  AdminCooperationContent,
  AdminCooperationRevision,
  AdminHomeHeroContent,
  AdminHomeHeroRevision,
  AdminHomeVideoContent,
  AdminHomeVideoListItem,
  AdminHomeVideoRevision,
  AdminMedia,
  AdminProductCategory,
  AdminProductContent,
  AdminProductListItem,
  AdminProductRevision,
  AdminScenicContent,
  AdminScenicListItem,
  AdminScenicRevision,
  AdminStaff,
  AdminUser,
  CompanyContentBlock,
  CooperationRevenueSection,
  CooperationValueSection,
  CreateMediaUploadResponse,
  MapSelection,
  ProductContentBlock,
  RegisteredAppUser,
  ScenicContentBlock,
  ScenicLocation,
} from './admin'
import type { components, paths } from './openapi.generated'

type Schema<Name extends keyof components['schemas']> = components['schemas'][Name]

type Compatible<Frontend, Backend> =
  Exclude<keyof Frontend, keyof Backend> extends never
    ? {
        [Key in keyof Frontend]-?: Key extends keyof Backend
          ? Exclude<Frontend[Key], undefined> extends Exclude<Backend[Key], undefined>
            ? never
            : Key
          : Key
      }[keyof Frontend] extends never
      ? true
      : false
    : false

type Assert<Value extends true> = Value
type HasRoute<Route extends keyof paths> = Route

// Compiled by `tsc`; a changed DTO field, union, or route fails the frontend build.
export type AdminApiContractAssertions = [
  Assert<Compatible<AdminUser, Schema<'AdminMeResponse'>>>,
  Assert<Compatible<AdminStaff, Schema<'AdminStaffResponse'>>>,
  Assert<Compatible<RegisteredAppUser, Schema<'AdminAppUserResponse'>>>,
  Assert<Compatible<CompanyContentBlock, Schema<'CompanyContentBlock'>>>,
  Assert<Compatible<AdminCompanyRevision, Schema<'AdminCompanyRevisionResponse'>>>,
  Assert<Compatible<AdminCompanyContent, Schema<'AdminCompanyContentResponse'>>>,
  Assert<Compatible<AdminMedia, Schema<'AdminMediaResponse'>>>,
  Assert<Compatible<CreateMediaUploadResponse, Schema<'CreateMediaUploadResponse'>>>,
  Assert<Compatible<AdminHomeHeroRevision, Schema<'AdminHomeHeroRevisionResponse'>>>,
  Assert<Compatible<AdminHomeHeroContent, Schema<'AdminHomeHeroContentResponse'>>>,
  Assert<Compatible<AdminHomeVideoRevision, Schema<'AdminHomeVideoRevisionResponse'>>>,
  Assert<Compatible<AdminHomeVideoContent, Schema<'AdminHomeVideoContentResponse'>>>,
  Assert<Compatible<AdminHomeVideoListItem, Schema<'AdminHomeVideoListItemResponse'>>>,
  Assert<Compatible<ScenicContentBlock, Schema<'ScenicContentBlock'>>>,
  Assert<Compatible<ScenicLocation, Schema<'ScenicLocation'>>>,
  Assert<Compatible<MapSelection, Schema<'MapSelectionResponse'>>>,
  Assert<Compatible<AdminScenicRevision, Schema<'AdminScenicRevisionResponse'>>>,
  Assert<Compatible<AdminScenicContent, Schema<'AdminScenicContentResponse'>>>,
  Assert<Compatible<AdminScenicListItem, Schema<'AdminScenicListItemResponse'>>>,
  Assert<Compatible<AdminProductCategory, Schema<'AdminProductCategoryResponse'>>>,
  Assert<Compatible<ProductContentBlock, Schema<'CompanyContentBlock'>>>,
  Assert<Compatible<AdminProductRevision, Schema<'AdminProductRevisionResponse'>>>,
  Assert<Compatible<AdminProductContent, Schema<'AdminProductContentResponse'>>>,
  Assert<Compatible<AdminProductListItem, Schema<'AdminProductListItemResponse'>>>,
  Assert<Compatible<CooperationRevenueSection, Schema<'CooperationRevenueSection'>>>,
  Assert<Compatible<CooperationValueSection, Schema<'CooperationValueSection'>>>,
  Assert<Compatible<AdminCooperationRevision, Schema<'AdminCooperationRevisionResponse'>>>,
  Assert<Compatible<AdminCooperationContent, Schema<'AdminCooperationContentResponse'>>>,
  HasRoute<'/api/v1/admin/auth/login'>,
  HasRoute<'/api/v1/admin/contents/home-hero'>,
  HasRoute<'/api/v1/admin/contents/home-videos'>,
  HasRoute<'/api/v1/admin/contents/company'>,
  HasRoute<'/api/v1/admin/scenics'>,
  HasRoute<'/api/v1/admin/products'>,
  HasRoute<'/api/v1/admin/contents/cooperation'>,
  HasRoute<'/api/v1/admin/users'>,
  HasRoute<'/api/v1/admin/users/{userId}/status'>,
  HasRoute<'/api/v1/admin/staff'>,
]
