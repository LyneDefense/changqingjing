import { Link } from 'react-router-dom'
import { PageIntro } from '../components/PageIntro'

interface ComingSoonPageProps {
  title: string
}

export function ComingSoonPage({ title }: ComingSoonPageProps) {
  return (
    <>
      <PageIntro title={title} description="该业务不在第一版开放范围内。" />
      <div className="coming-soon-card">
        <span>敬请期待</span>
        <h3>{title}暂未开放</h3>
        <p>当前没有编辑表单或启用开关，避免误发布尚未建设的业务。</p>
        <Link className="secondary-button button-link" to="/cooperation">返回收益板块管理</Link>
      </div>
    </>
  )
}
