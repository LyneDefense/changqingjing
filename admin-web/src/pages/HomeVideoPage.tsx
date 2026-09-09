import { useEffect, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'
import { HomeVideoEditor } from '../components/HomeVideoEditor'
import { PageIntro } from '../components/PageIntro'

export function HomeVideoPage() {
  const [dirty, setDirty] = useState(false)
  const blocker = useBlocker(dirty)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('宣传视频还有修改没有保存，确定离开吗？')) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker])

  useBeforeUnload((event) => {
    if (dirty) event.preventDefault()
  })

  return (
    <>
      <PageIntro
        title="首页宣传视频管理"
        description="维护小程序首页展示的宣传视频和封面。保存草稿后，可先核对内容再发布。"
      />
      <HomeVideoEditor onDirtyChange={setDirty} />
    </>
  )
}
