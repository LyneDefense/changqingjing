import type { AppLoginResult, AppUser } from './auth-types'
import type {
  CompanyContent,
  CompanyContentBlock,
  CompanySummary,
  CooperationContent,
  CooperationRevenueSection,
  CooperationValueSection,
  HomeContent,
  HomeHero,
  HomeScenicSummary,
  HomeVideo,
  PageResponse,
  ProductCategory,
  ProductContent,
  ProductContentBlock,
  ProductSummary,
  ScenicContent,
  ScenicSummary,
} from './content'
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

// Compiled by `tsc`; a changed DTO field, union, or route fails the mini-program build.
export type MiniProgramApiContractAssertions = [
  Assert<Compatible<AppUser, Schema<'AppUserResponse'>>>,
  Assert<Compatible<AppLoginResult, Schema<'AppLoginResponse'>>>,
  Assert<Compatible<CompanyContentBlock, Schema<'AppCompanyBlockResponse'>>>,
  Assert<Compatible<CompanySummary, Schema<'HomeCompanySummaryResponse'>>>,
  Assert<Compatible<CompanyContent, Schema<'AppCompanyResponse'>>>,
  Assert<Compatible<HomeHero, Schema<'HomeHeroResponse'>>>,
  Assert<Compatible<HomeVideo, Schema<'HomeVideoResponse'>>>,
  Assert<Compatible<HomeScenicSummary, Schema<'HomeScenicSummaryResponse'>>>,
  Assert<Compatible<ScenicSummary, Schema<'AppScenicSummaryResponse'>>>,
  Assert<Compatible<ScenicContent, Schema<'AppScenicResponse'>>>,
  Assert<Compatible<ProductCategory, Schema<'AppProductCategoryResponse'>>>,
  Assert<Compatible<ProductSummary, Schema<'AppProductSummaryResponse'>>>,
  Assert<Compatible<ProductContentBlock, Schema<'AppProductBlockResponse'>>>,
  Assert<Compatible<ProductContent, Schema<'AppProductResponse'>>>,
  Assert<Compatible<CooperationRevenueSection, Schema<'AppCooperationRevenueResponse'>>>,
  Assert<Compatible<CooperationValueSection, Schema<'AppCooperationValueResponse'>>>,
  Assert<Compatible<CooperationContent, Schema<'AppCooperationResponse'>>>,
  Assert<Compatible<HomeContent, Schema<'AppHomeResponse'>>>,
  Assert<Compatible<PageResponse<ScenicSummary>, Schema<'PageResponseAppScenicSummaryResponse'>>>,
  Assert<Compatible<PageResponse<ProductSummary>, Schema<'PageResponseAppProductSummaryResponse'>>>,
  HasRoute<'/api/v1/app/home'>,
  HasRoute<'/api/v1/app/company'>,
  HasRoute<'/api/v1/app/scenics'>,
  HasRoute<'/api/v1/app/scenics/{entryId}'>,
  HasRoute<'/api/v1/app/product-categories'>,
  HasRoute<'/api/v1/app/products'>,
  HasRoute<'/api/v1/app/products/{productId}'>,
  HasRoute<'/api/v1/app/cooperation'>,
  HasRoute<'/api/v1/app/auth/wechat/session'>,
  HasRoute<'/api/v1/app/auth/wechat/register-login'>,
  HasRoute<'/api/v1/app/me'>,
]
