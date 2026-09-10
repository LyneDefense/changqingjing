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
    assert.equal(await videoTitle.text(), '自动化宣传片')
    const scenicTitle = await home.$('.home-scenic-card__title')
    assert(scenicTitle, '已发布景区应以单个大卡片显示')
    assert.equal(await scenicTitle.text(), '仙岛湖旅游风景区')
    assert.equal((await home.$$('.home-scenic-card')).length, 1)

    await miniProgram.restoreWxMethod('request')
    await miniProgram.mockWxMethod('request', {
      statusCode: 200,
      data: {
        data: {
          title: '自动化公司介绍',
          summary: '首页公开摘要',
          coverUrl: 'https://media.example/company-cover.jpg?signature=short',
          blocks: [
            { type: 'HEADING', text: '我们的使命' },
            {
              type: 'IMAGE',
              imageUrl: 'https://media.example/company-body.jpg?signature=short',
              altText: '山水与文化',
            },
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
    const bodyImage = await company.$('.company-content-image')
    assert(bodyImage, '公司介绍正文图片应显示')
    assert.match(await bodyImage.attribute('src'), /company-body\.jpg/)

    await miniProgram.restoreWxMethod('request')
    await miniProgram.mockWxMethod('request', {
      statusCode: 200,
      data: {
        data: {
          title: '自动化合作权益',
          summary: '共同连接文化与旅行资源',
          revenueSections: [
            { title: '招商收益', description: '分公司合作', icon: '商' },
            { title: '供应链', description: '产品流转收益', icon: '链' },
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
  } finally {
    await miniProgram.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
