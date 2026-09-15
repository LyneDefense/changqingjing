const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { prepareProject, productionApiUrl, releaseProjectConfig } = require('./miniprogram-release.cjs')

const apiUrl = 'https://release.example.com/api/v1/app'
const appId = 'wx0123456789abcdef'

test('正式配置开启域名校验和压缩，不修改本地调试配置', () => {
  const original = { appid: appId, projectname: 'mini', setting: { urlCheck: false, es6: true } }
  const release = releaseProjectConfig(original)
  assert.equal(release.setting.urlCheck, true)
  assert.equal(release.setting.minified, true)
  assert.equal(release.setting.uploadWithSourceMap, false)
  assert.equal(release.setting.es6, true)
  assert.equal(original.setting.urlCheck, false)
  assert.equal(original.setting.minified, undefined)
  assert.throws(() => releaseProjectConfig({ appid: 'touristappid' }), /AppID/)
})

test('正式接口拒绝调试地址、端口、账户、查询参数和占位符', () => {
  assert.equal(productionApiUrl(apiUrl), apiUrl)
  for (const url of [
    'http://release.example.com/api/v1/app',
    'https://127.0.0.1/api/v1/app',
    'https://[::1]/api/v1/app',
    'https://localhost/api/v1/app',
    'https://app.local/api/v1/app',
    'https://app.test/api/v1/app',
    'https://CHANGE_ME.example.com/api/v1/app',
    'https://release.example.com:8080/api/v1/app',
    'https://user:password@release.example.com/api/v1/app',
    `${apiUrl}?debug=true`,
    `${apiUrl}#debug`,
    'https://release.example.com/api/v1/admin',
  ]) assert.throws(() => productionApiUrl(url), /正式接口/)
})

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cqj-mini-release-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const source = path.join(directory, 'source')
  const target = path.join(directory, 'release')
  fs.mkdirSync(path.join(source, 'dist'), { recursive: true })
  fs.writeFileSync(path.join(source, 'project.config.json'), JSON.stringify({
    appid: appId, setting: { urlCheck: false },
  }))
  fs.writeFileSync(path.join(source, 'dist/app.json'), JSON.stringify({ pages: ['pages/index/index'] }))
  fs.writeFileSync(path.join(source, 'dist/app.js'), `const api = ${JSON.stringify(apiUrl)};`)
  return { source, target }
}

test('发布目录隔离本地设置，排除源码映射和个人配置', (t) => {
  const { source, target } = fixture(t)
  fs.writeFileSync(path.join(source, 'dist/app.js.map'), '{}')
  fs.writeFileSync(path.join(source, 'dist/project.private.config.json'), '{}')
  fs.writeFileSync(path.join(source, 'dist/project.config.json'), '{}')
  const result = prepareProject(source, target, apiUrl)
  assert(result.packageBytes > 0)
  assert.equal(fs.existsSync(path.join(target, 'dist/app.js.map')), false)
  assert.equal(fs.existsSync(path.join(target, 'dist/project.private.config.json')), false)
  const releaseConfig = JSON.parse(fs.readFileSync(path.join(target, 'project.config.json'), 'utf8'))
  assert.equal(releaseConfig.appid, appId)
  assert.equal(releaseConfig.setting.urlCheck, true)
  assert.equal(releaseConfig.miniprogramRoot, 'dist/')
  const distConfig = JSON.parse(fs.readFileSync(path.join(target, 'dist/project.config.json'), 'utf8'))
  assert.equal(distConfig.setting.urlCheck, true)
  assert.equal(distConfig.miniprogramRoot, './')
  const localConfig = JSON.parse(fs.readFileSync(path.join(source, 'project.config.json'), 'utf8'))
  assert.equal(localConfig.setting.urlCheck, false)
  assert.throws(() => prepareProject(source, target, apiUrl), /已存在/)
})

test('本地接口或 debug 产物不能生成上传目录', (t) => {
  const { source, target } = fixture(t)
  fs.writeFileSync(path.join(source, 'dist/app.js'), `const api = ${JSON.stringify(apiUrl)}; const local = 'http://127.0.0.1:8080';`)
  assert.throws(() => prepareProject(source, target, apiUrl), /本地接口/)
  assert.equal(fs.existsSync(target), false)
  fs.writeFileSync(path.join(source, 'dist/app.js'), `const api = ${JSON.stringify(apiUrl)};`)
  fs.writeFileSync(path.join(source, 'dist/app.json'), '{"debug":true}')
  assert.throws(() => prepareProject(source, target, apiUrl), /debug/)
  assert.equal(fs.existsSync(target), false)
})

test('缺少正式接口地址的产物不能生成上传目录', (t) => {
  const { source, target } = fixture(t)
  fs.writeFileSync(path.join(source, 'dist/app.js'), 'const api = "https://wrong.example.com";')
  assert.throws(() => prepareProject(source, target, apiUrl), /未找到/)
  assert.equal(fs.existsSync(target), false)
})
