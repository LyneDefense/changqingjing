import { defineConfig, type UserConfigExport } from '@tarojs/cli'

import devConfig from './dev'
import prodConfig from './prod'

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'vite'>(async (merge) => {
  const configuredApiBaseUrl = process.env.TARO_APP_API_BASE_URL?.trim()
  const releaseBuild = process.env.TARO_APP_REQUIRE_PRODUCTION_API === 'true'
  const apiBaseUrl = (configuredApiBaseUrl || 'http://127.0.0.1:8080/api/v1/app').replace(/\/$/, '')

  if (releaseBuild) {
    if (!configuredApiBaseUrl) {
      throw new Error('正式发布构建缺少 TARO_APP_API_BASE_URL')
    }
    const parsedApiUrl = new URL(apiBaseUrl)
    if (parsedApiUrl.protocol !== 'https:'
      || parsedApiUrl.username
      || parsedApiUrl.password
      || parsedApiUrl.port
      || parsedApiUrl.hostname === 'localhost'
      || parsedApiUrl.hostname.endsWith('.local')
      || /^\d+\.\d+\.\d+\.\d+$/.test(parsedApiUrl.hostname)
      || parsedApiUrl.pathname !== '/api/v1/app') {
      throw new Error('正式 TARO_APP_API_BASE_URL 必须是无账号、无自定义端口的 HTTPS 域名，并以 /api/v1/app 结尾')
    }
  }
  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'miniprogram',
    date: '2026-9-8',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl)
    },
    copy: {
      patterns: [
        {
          from: 'src/custom-tab-bar',
          to: 'dist/custom-tab-bar'
        }
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: 'vite',
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {

          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',

      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }


  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
