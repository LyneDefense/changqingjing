export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/company/index',
    'pages/scenics/index',
    'pages/scenic-detail/index',
    'pages/login/index',
    'pages/member/index',
    'pages/products/index',
    'pages/product-detail/index',
    'pages/cooperation/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '常清净文旅投',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#66736e',
    selectedColor: '#1d6a50',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/member/index', text: '会员专区' },
      { pagePath: 'pages/cooperation/index', text: '合作权益' },
      { pagePath: 'pages/profile/index', text: '个人中心' }
    ]
  }
})
