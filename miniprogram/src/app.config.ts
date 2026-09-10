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
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/member/index',
        text: '会员专区',
        iconPath: 'assets/tabbar/member.png',
        selectedIconPath: 'assets/tabbar/member-selected.png'
      },
      {
        pagePath: 'pages/cooperation/index',
        text: '合作权益',
        iconPath: 'assets/tabbar/cooperation.png',
        selectedIconPath: 'assets/tabbar/cooperation-selected.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '个人中心',
        iconPath: 'assets/tabbar/profile.png',
        selectedIconPath: 'assets/tabbar/profile-selected.png'
      }
    ]
  }
})
