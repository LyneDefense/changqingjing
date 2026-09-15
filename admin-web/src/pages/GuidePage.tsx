import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/authContextValue'
import { AdminIcon } from '../components/AdminIcon'
import { PageIntro } from '../components/PageIntro'
import { adminModules } from '../config/adminModules'
import { guideTopics, matchesGuideQuestion, searchGuideTopics } from '../content/userGuide'
import './GuidePage.css'

const groups = ['开始使用', '内容维护', '账号与帮助'] as const

export function GuidePage() {
  const auth = useAuth()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(guideTopics[0].id)
  const topics = searchGuideTopics(query)
  const selected = topics.find((topic) => topic.id === selectedId) ?? topics[0]
  const module = adminModules.find((item) => item.to === selected?.modulePath)
  const canVisitModule = module && (!module.permission || auth.hasPermission(module.permission))
  const questions = selected?.questions.filter((question) => selected.id !== 'faq'
    || !query.trim()
    || selected.title.includes(query.trim())
    || matchesGuideQuestion(question, query)) ?? []

  return (
    <div className="guide-page">
      <div className="guide-page__heading">
        <PageIntro title="后台使用指南" description="日常操作、发布流程与常见问题，在这里随时查阅。" />
        <span className="guide-edition"><AdminIcon name="guide" />管理人员手册</span>
      </div>

      <div className="guide-search-bar">
        <label className="guide-search">
          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></svg>
          <input aria-label="搜索使用指南" maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder="搜索操作或问题，例如：封面、地图、发布" type="search" value={query} />
        </label>
        {query && <button className="text-button" onClick={() => setQuery('')} type="button">清空搜索</button>}
        <span className="guide-search-bar__hint" role="status">{query.trim() ? `找到 ${topics.length} 个相关主题` : '按目录阅读，或搜索关键词'}</span>
      </div>

      <div className="guide-layout">
        <nav className="guide-directory" aria-label="指南目录">
          <div className="guide-directory__heading"><strong>阅读目录</strong><span>{topics.length} 个主题</span></div>
          {groups.map((group) => {
            const items = topics.filter((topic) => topic.group === group)
            if (!items.length) return null
            return <div className="guide-directory__group" key={group}>
              <p>{group}</p>
              {items.map((topic) => <button aria-current={selected?.id === topic.id ? 'page' : undefined} className={selected?.id === topic.id ? 'active' : ''} key={topic.id} onClick={() => setSelectedId(topic.id)} type="button">
                <AdminIcon name={topic.icon} /><span>{topic.title}</span><i aria-hidden="true">›</i>
              </button>)}
            </div>
          })}
          <p className="guide-directory__note">操作前先核对，修改后记得保存与发布。</p>
        </nav>

        {selected ? <article aria-labelledby="guide-topic-title" className="guide-article" key={selected.id}>
          <header className="guide-article__heading">
            <div className="guide-article__title"><span><AdminIcon name={selected.icon} /></span><div><small>{selected.group}</small><h3 id="guide-topic-title">{selected.title}</h3></div></div>
            {canVisitModule && <Link className="secondary-button button-link guide-module-link" to={module.to}>进入{module.workspaceLabel ?? module.label}<span aria-hidden="true">›</span></Link>}
          </header>
          <p className="guide-article__introduction">{selected.introduction}</p>
          {selected.note && <div className="guide-note"><span aria-hidden="true">i</span><p>{selected.note}</p></div>}

          {selected.steps.length > 0 && <section className="guide-section" aria-labelledby="guide-steps-title">
            <h4 id="guide-steps-title">{selected.id === 'getting-started' ? '三步完成内容发布' : '操作步骤'}</h4>
            <ol className="guide-steps">{selected.steps.map((step, index) => <li key={step.title}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></li>)}</ol>
          </section>}

          {selected.tips.length > 0 && <section className="guide-section guide-tips" aria-labelledby="guide-tips-title">
            <h4 id="guide-tips-title">{selected.id === 'getting-started' ? '记住这几个区别' : selected.id === 'faq' ? '需要帮助时' : '注意事项'}</h4>
            <ul>{selected.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          </section>}

          {questions.length > 0 && <section className="guide-section" aria-labelledby="guide-questions-title">
            <div className="guide-questions-heading"><h4 id="guide-questions-title">常见问题</h4><span>点击问题查看解答</span></div>
            <div className="guide-questions">{questions.map((question) => <details key={question.question}>
              <summary><span className="guide-question-mark" aria-hidden="true">Q</span><strong>{question.question}</strong><span className="guide-question-chevron" aria-hidden="true" /></summary>
              <p>{question.answer}</p>
            </details>)}</div>
          </section>}
          <footer className="guide-article__footer"><AdminIcon name="guide" /><span>本指南按当前已开放功能编写；页面中的必填提示与发布条件请同时核对。</span></footer>
        </article> : <section className="guide-empty" aria-label="指南搜索结果">
          <AdminIcon name="guide" /><h3>没有找到相关主题</h3><p>试试“图片”“草稿”或“登录”，也可以清空搜索查看全部指南。</p><button className="secondary-button" onClick={() => setQuery('')} type="button">查看全部指南</button>
        </section>}
      </div>
    </div>
  )
}
