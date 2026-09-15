import { describe, expect, it } from 'vitest'
import { adminModules } from '../config/adminModules'
import { guideTopics, matchesGuideQuestion, searchGuideTopics } from './userGuide'

describe('operator guide content', () => {
  it('has unique chapters with valid module entry points', () => {
    expect(new Set(guideTopics.map((topic) => topic.id)).size).toBe(guideTopics.length)
    for (const topic of guideTopics) {
      expect(topic.title).not.toBe('')
      expect(topic.introduction).not.toBe('')
      if (topic.modulePath) expect(adminModules.some((module) => module.to === topic.modulePath)).toBe(true)
    }
  })

  it('searches body text and answers, ignoring whitespace and Latin letter case', () => {
    expect(searchGuideTopics('  ')).toEqual(guideTopics)
    expect(searchGuideTopics('  地图  ').map((topic) => topic.id)).toEqual(['scenics', 'faq'])
    expect(searchGuideTopics('qa').map((topic) => topic.id)).toEqual(['faq'])
    expect(searchGuideTopics('不需要单独填写标题').map((topic) => topic.id)).toEqual(['home-hero'])
    expect(matchesGuideQuestion({ question: '上传什么格式？', answer: 'JPEG、PNG、WebP' }, ' webp ')).toBe(true)
    expect(searchGuideTopics('不存在的内容')).toEqual([])
  })
})
