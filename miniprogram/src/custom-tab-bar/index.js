Component({
  data: {
    selected: 0,
    tabs: [
      {
        pagePath: '/pages/index/index',
        text: '首页'
      },
      {
        pagePath: '/pages/member/index',
        text: '会员专区'
      },
      {
        pagePath: '/pages/cooperation/index',
        text: '合作权益'
      },
      {
        pagePath: '/pages/profile/index',
        text: '个人中心'
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
