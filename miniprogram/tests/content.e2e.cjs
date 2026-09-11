const assert = require('node:assert/strict')
const path = require('node:path')
const automator = require('miniprogram-automator')

const cliPath = process.env.WECHAT_DEVTOOLS_CLI_PATH
  || '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
const projectPath = path.resolve(__dirname, '..')

async function main() {
  const miniProgram = await automator.launch({
    cliPath,
    projectPath,
    trustProject: true,
    timeout: 60_000,
    projectConfig: { setting: { urlCheck: false } },
  })
  try {
    await miniProgram.mockWxMethod('request', {
      statusCode: 200,
      data: {
        data: {
          hero: {
            title: '循文化之脉，见山水之美',
            subtitle: '发现值得抵达的风景与故事',
            coverUrl: 'https://media.example/hero.jpg?signature=short',
            focusX: 42,
            focusY: 61,
          },
          company: {
            title: '自动化公司介绍',
            summary: '首页公开摘要',
            coverUrl: 'https://media.example/company-cover.jpg?signature=short',
          },
          video: {
            title: '自动化宣传片',
            coverUrl: 'https://media.example/video-cover.jpg?signature=short',
            playbackUrl: 'https://media.example/video.mp4?signature=short',
          },
          scenics: [{
            id: 'ecb15542-f99c-49ff-8708-5b3aa0188761',
            title: '仙岛湖旅游风景区',
            summary: '山水相依，群岛相望。',
            coverUrl: 'https://media.example/xiandao-lake.jpg?signature=short',
            displayOrder: 1,
          }],
        },
      },
    })
    await miniProgram.callWxMethod('reLaunch', { url: '/pages/index/index' })
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    const home = await miniProgram.currentPage()
    assert(home, '首页应成功打开')
    await home.waitFor(500)
    const heroImage = await home.$('.home-hero__image')
    const heroTitle = await home.$('.home-hero__title')
    assert(heroImage && heroTitle, '已发布首页头图应显示')
    assert.match(await heroImage.attribute('src'), /hero\.jpg/)
    assert.equal(await heroTitle.text(), '循文化之脉，见山水之美')
    const cardTitle = await home.$('.company-card__title')
    assert(cardTitle, '已发布公司卡片应显示')
    assert.equal(await cardTitle.text(), '自动化公司介绍')
    const companyCover = await home.$('.company-card__cover')
    assert(companyCover, '首页公司封面应显示')
    assert.match(await companyCover.attribute('src'), /company-cover\.jpg/)
    const videoTitle = await home.$('.home-video-section .home-section-title')
    assert(videoTitle, '已发布宣传视频应显示')
    assert.equal(await videoTitle.text(), '视频介绍')
    const scenicTitle = await home.$('.home-scenic-card__title')
    assert(scenicTitle, '已发布景区应以单个大卡片显示')
    assert.equal(await scenicTitle.text(), '仙岛湖旅游风景区')
    assert.equal((await home.$$('.home-scenic-card')).length, 1)

    await miniProgram.navigateTo('/pages/login/index?target=profile')
    const login = await miniProgram.currentPage()
    assert(login, '通用登录页应成功打开')
    assert.equal(login.path, 'pages/login/index')
    assert.equal(await (await login.$('.login-flow__brand-name')).text(), '常清净文旅投')
    assert.equal(await (await login.$('.login-flow__title')).text(), '登录常清净')
    assert.equal(await (await login.$('.login-flow__description')).text(), '山水有意，生活亦可清净')
    assert.equal(await (await login.$('.login-flow__primary')).text(), '微信手机号一键登录')
    assert.equal(await (await login.$('.login-flow__cancel')).text(), '暂不登录')
    assert.equal(
      await (await login.$('.login-flow__agreement-text')).text(),
      '登录即表示已阅读并同意《用户协议》和《隐私政策》'
    )
    const loginText = await (await login.$('.login-flow')).text()
    assert.doesNotMatch(loginText, /首次登录|登录后查看会员福利/)
    await miniProgram.navigateBack()

    await miniProgram.restoreWxMethod('request')
    await miniProgram.mockWxMethod('request', {
      statusCode: 200,
      data: {
        data: {
          title: '自动化公司介绍',
          summary: '首页公开摘要',
          coverUrl: 'https://media.example/company-cover.jpg?signature=short',
          galleryUrls: [
            'https://media.example/company-detail-1.jpg?signature=short',
            'https://media.example/company-detail-2.jpg?signature=short',
          ],
          blocks: [
            { type: 'HEADING', text: '我们的使命' },
            { type: 'PARAGRAPH', text: '连接文化与旅行。' },
          ],
          firstPublishedAt: '2026-09-08T08:00:00Z',
        },
      },
    })
    const card = await home.$('.company-card')
    assert(card, '公司卡片应可点击')
    await card.tap()
    await new Promise((resolve) => setTimeout(resolve, 3_000))

    const company = await miniProgram.currentPage()
    assert(company, '公司介绍页应成功打开')
    assert.equal(company.path, 'pages/company/index')
    const heading = await company.$('.company-content-heading')
    const paragraph = await company.$('.company-content-paragraph')
    assert(heading && paragraph, '结构化内容块应显示')
    assert.equal(await heading.text(), '我们的使命')
    assert.equal(await paragraph.text(), '连接文化与旅行。')
    assert.equal(await company.$('.company-page__header'), null)
    const galleryImages = await company.$$('.company-gallery__image')
    assert.equal(galleryImages.length, 2, '公司详情图片应在轮播中展示')
    assert.match(await galleryImages[0].attribute('src'), /company-detail-1\.jpg/)

    await miniProgram.restoreWxMethod('request')
    await miniProgram.mockWxMethod('request', {
      statusCode: 200,
      data: {
        data: {
          title: '自动化合作权益',
          summary: '共同连接文化与旅行资源',
          revenueSections: [
            { title: '招商收益', description: '分公司合作', icon: 'cooperate' },
            { title: '供应链', description: '产品流转收益', icon: 'product' },
          ],
          valueSections: [
            { title: '资源整合', description: '连接长期合作资源' },
          ],
        },
      },
    })
    await miniProgram.callWxMethod('reLaunch', { url: '/pages/cooperation/index' })
    await new Promise((resolve) => setTimeout(resolve, 2_000))
    const cooperation = await miniProgram.currentPage()
    assert(cooperation, '合作权益页应成功打开')
    assert.equal(cooperation.path, 'pages/cooperation/index')
    const revenueTitle = await cooperation.$('.revenue-card__title')
    const valueTitle = await cooperation.$('.cooperation-value-card__title')
    assert(revenueTitle && valueTitle, '收益分类和合作价值应显示')
    assert.equal(await revenueTitle.text(), '招商收益')
    assert.equal(await valueTitle.text(), '资源整合')
    assert(await cooperation.$('.revenue-card__icon--cooperate'), '收益分类应展示系统图标')

    const cooperationTabs = await cooperation.$$('.cooperation-tab')
    assert.equal(cooperationTabs.length, 3, '合作权益页应显示三个内容入口')
    await cooperationTabs[1].tap()
    await new Promise((resolve) => setTimeout(resolve, 300))
    const comingSoon = await cooperation.$('.cooperation-coming-soon__title')
    const hiddenRevenueTitle = await cooperation.$('.revenue-card__title')
    const retainedValueTitle = await cooperation.$('.cooperation-value-card__title')
    assert(comingSoon, '分公司方案应在原收益区域显示敬请期待')
    assert.equal(await comingSoon.text(), '敬请期待')
    assert.equal(hiddenRevenueTitle, null, '分公司方案不应继续展示核心收益条目')
    assert(retainedValueTitle, '分公司方案仍应展示合作价值总结')
    assert.equal(await retainedValueTitle.text(), '资源整合')

    await miniProgram.callWxMethod('switchTab', { url: '/pages/profile/index' })
    await new Promise((resolve) => setTimeout(resolve, 500))
    const profile = await miniProgram.currentPage()
    assert(profile, '个人中心应成功打开')
    assert.equal(profile.path, 'pages/profile/index')
    assert.equal((await profile.$$('.profile-service-row')).length, 5, '个人中心应保留五个服务入口')
    assert.equal(await (await profile.$('.profile-account__heading')).text(), '账户信息')
    assert.doesNotMatch(await (await profile.$('.profile-services')).text(), /敬请期待/)
  } finally {
    await miniProgram.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
