import Taro from '@tarojs/taro'

export function syncCustomTabBar(selected: number) {
  const page = Taro.getCurrentInstance().page
  if (!page) {
    return
  }
  page.getTabBar?.()?.setData?.({ selected })
}
