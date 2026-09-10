import { Link } from 'react-router-dom'
import { PageIntro } from '../components/PageIntro'

const modules = [
  ['/home-hero', '首页头图', '上传首页头图并设置可选标题与图片焦点'],
  ['/home-videos', '首页宣传视频', '上传、核对并发布首页宣传视频'],
  ['/company', '公司介绍', '维护公司简介和可排序的详细内容'],
  ['/scenics', '景区管理', '维护景区图文、开放状态和可选导航位置'],
  ['/products', '会员福利管理', '维护分类、产品图文和上架状态'],
  ['/cooperation', '合作权益', '维护核心收益来源和合作价值'],
  ['/users', '注册用户', '查看微信登录后自动创建的用户'],
]

export function DashboardPage() {
  return (
    <>
      <PageIntro title="工作台" description="从这里进入用户与内容管理功能。" />
      <div className="module-grid">
        {modules.map(([to, title, description]) => (
          <Link className="module-card" key={title} to={to}>
            <h3>{title}</h3>
            <p>{description}</p>
            <span>进入管理 →</span>
          </Link>
        ))}
      </div>
    </>
  )
}
