export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/company/index',
    'pages/scenics/index',
    'pages/scenic-detail/index',
    'pages/login/index',
    'pages/profile-setup/index',
    'pages/member/index',
    'pages/products/index',
    'pages/product-detail/index',
    'pages/cooperation/index',
    'pages/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f6f3ec',
    navigationBarTitleText: '常清净文旅投',
    navigationBarTextStyle: 'black'
  },
  usingComponents: {},
  tabBar: {
    custom: true,
    color: '#737873',
    selectedColor: '#17463f',
    backgroundColor: '#f6f3ec',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/member/index',
        text: '会员专区'
      },
      {
        pagePath: 'pages/cooperation/index',
        text: '合作权益'
      },
      {
        pagePath: 'pages/profile/index',
        text: '个人中心'
      }
    ]
  }
})
