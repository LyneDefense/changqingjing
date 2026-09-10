Component({
  data: {
    selected: 0,
    tabs: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '../assets/tabbar/home.png',
        selectedIconPath: '../assets/tabbar/home-selected.png'
      },
      {
        pagePath: '/pages/member/index',
        text: '会员专区',
        iconPath: '../assets/tabbar/member.png',
        selectedIconPath: '../assets/tabbar/member-selected.png'
      },
      {
        pagePath: '/pages/cooperation/index',
        text: '合作权益',
        iconPath: '../assets/tabbar/cooperation.png',
        selectedIconPath: '../assets/tabbar/cooperation-selected.png'
      },
      {
        pagePath: '/pages/profile/index',
        text: '个人中心',
        iconPath: '../assets/tabbar/profile.png',
        selectedIconPath: '../assets/tabbar/profile-selected.png'
      }
    ]
  },
  methods: {
    switchTab(event) {
      const selected = Number(event.currentTarget.dataset.index)
      const pagePath = event.currentTarget.dataset.path
      this.setData({ selected })
      wx.switchTab({ url: pagePath })
    }
  }
})
