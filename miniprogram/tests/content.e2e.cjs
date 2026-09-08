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
          company: {
            title: '自动化公司介绍',
            summary: '首页公开摘要',
          },
          scenics: [],
        },
      },
    })
    await miniProgram.callWxMethod('reLaunch', { url: '/pages/index/index' })
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    const home = await miniProgram.currentPage()
    assert(home, '首页应成功打开')
    await home.waitFor(500)
    const cardTitle = await home.$('.company-card__title')
    assert(cardTitle, '已发布公司卡片应显示')
    assert.equal(await cardTitle.text(), '自动化公司介绍')

    await miniProgram.restoreWxMethod('request')
    await miniProgram.mockWxMethod('request', {
      statusCode: 200,
      data: {
        data: {
          title: '自动化公司介绍',
          summary: '首页公开摘要',
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
  } finally {
    await miniProgram.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
