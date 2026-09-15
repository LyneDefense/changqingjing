const fs = require('node:fs')
const path = require('node:path')

function releaseProjectConfig(config) {
  if (!/^wx[0-9A-Za-z]{16}$/.test(config.appid || '')) {
    throw new Error('正式小程序 AppID 无效')
  }
  return {
    ...config,
    miniprogramRoot: 'dist/',
    compileType: 'miniprogram',
    setting: {
      ...config.setting,
      urlCheck: true,
      minified: true,
      minifyWXSS: true,
      minifyWXML: true,
      uploadWithSourceMap: false,
      compileHotReLoad: false,
    },
  }
}

function productionApiUrl(value) {
  const apiUrl = new URL(value)
  if (apiUrl.protocol !== 'https:'
    || apiUrl.username || apiUrl.password || apiUrl.port
    || apiUrl.search || apiUrl.hash
    || apiUrl.pathname !== '/api/v1/app'
    || apiUrl.hostname === 'localhost'
    || /\.(local|test|invalid|example)$/.test(apiUrl.hostname)
    || apiUrl.hostname.includes(':')
    || /^\d+\.\d+\.\d+\.\d+$/.test(apiUrl.hostname)
    || value.includes('CHANGE_ME')) {
    throw new Error('正式接口必须是无账号、端口、查询参数的 HTTPS 域名，并以 /api/v1/app 结尾')
  }
  return apiUrl.href
}

function prepareProject(sourceDirectory, targetDirectory, apiBaseUrl) {
  const apiUrl = productionApiUrl(apiBaseUrl)
  const config = releaseProjectConfig(JSON.parse(
    fs.readFileSync(path.join(sourceDirectory, 'project.config.json'), 'utf8')
  ))
  const sourceDist = path.join(sourceDirectory, 'dist')
  const appConfig = JSON.parse(fs.readFileSync(path.join(sourceDist, 'app.json'), 'utf8'))
  if (appConfig.debug) throw new Error('正式产物不能启用 app.json debug')
  let apiFound = false
  let totalBytes = 0
  function checkFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        checkFiles(file)
      } else if (!entry.name.endsWith('.map') && entry.name !== 'project.config.json') {
        const data = fs.readFileSync(file)
        totalBytes += data.length
        if (/\.(js|json|wxml|wxss)$/.test(entry.name)) {
          const text = data.toString('utf8')
          if (/http:\/\/(localhost|127\.0\.0\.1)/.test(text)) {
            throw new Error(`产物含本地接口地址：${path.relative(sourceDist, file)}`)
          }
          if (text.includes(apiUrl)) apiFound = true
        }
      }
    }
  }
  checkFiles(sourceDist)
  if (!apiFound) throw new Error('产物中未找到正式 API 地址')
  if (fs.existsSync(targetDirectory)) throw new Error('正式上传目录已存在，请使用新的版本号')
  fs.mkdirSync(targetDirectory, { recursive: true })
  fs.cpSync(sourceDist, path.join(targetDirectory, 'dist'), {
    recursive: true,
    filter: (file) => !file.endsWith('.map')
      && path.basename(file) !== 'project.private.config.json',
  })
  fs.writeFileSync(path.join(targetDirectory, 'project.config.json'), `${JSON.stringify(config, null, 2)}\n`)
  const distConfigPath = path.join(targetDirectory, 'dist/project.config.json')
  if (fs.existsSync(distConfigPath)) {
    fs.writeFileSync(distConfigPath, `${JSON.stringify({ ...config, miniprogramRoot: './' }, null, 2)}\n`)
  }
  return { apiBaseUrl: apiUrl, packageBytes: totalBytes }
}

module.exports = { productionApiUrl, releaseProjectConfig, prepareProject }

if (require.main === module) {
  try {
    const [sourceDirectory, targetDirectory, apiBaseUrl] = process.argv.slice(2)
    const result = prepareProject(sourceDirectory, targetDirectory, apiBaseUrl)
    process.stdout.write(`正式上传目录已生成；代码和资源 ${result.packageBytes} 字节。\n`)
  } catch (error) {
    process.stderr.write(`Release preparation failed: ${error.message}\n`)
    process.exitCode = 1
  }
}
