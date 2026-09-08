import { PageIntro } from '../components/PageIntro'

const modules = [
  ['注册用户', '查看微信登录后自动创建的用户'],
  ['首页内容', '维护宣传视频、公司介绍和景区功能'],
  ['会员福利', '维护福利产品及多图详情'],
]

export function DashboardPage() {
  return (
    <>
      <PageIntro title="工作台" description="从这里进入用户与内容管理功能。" />
      <div className="module-grid">
        {modules.map(([title, description]) => (
          <article className="module-card" key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </>
  )
}
