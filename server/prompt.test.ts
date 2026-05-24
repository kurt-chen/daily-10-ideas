import { describe, expect, it } from 'vitest';
import { buildDeepSeekSystemPrompt, buildInstructions, normalizeRequest, validateIdeas } from './prompt.js';

function makeIdea(index: number) {
  const id = String(index + 1).padStart(2, '0');
  return {
    id,
    title: `想法 ${id}`,
    angle: '反常识角度',
    whyItMightWork: '因为它绕开了显性竞争。',
    bestFirstStep: '今天发给一个真实用户验证。',
    verificationSignal: '用户愿意继续讨论。',
    riskNote: null,
  };
}

describe('prompt helpers', () => {
  it('normalizes request defaults and allowed counts', () => {
    const request = normalizeRequest({
      question: '  如何让内容传播？ ',
      count: 13,
      wildness: 140,
      persona: '混沌艺术家',
      history: ['a', 1, 'b'],
    });

    expect(request.question).toBe('如何让内容传播？');
    expect(request.count).toBe(10);
    expect(request.wildness).toBe(100);
    expect(request.persona).toBe('混沌艺术家');
    expect(request.history).toEqual(['a', 'b']);
  });

  it('keeps the no-limits posture while requiring safety translation', () => {
    const instructions = buildInstructions(
      normalizeRequest({ question: '如何突破常识？', persona: '无禁区发散' }),
    );

    expect(instructions).toContain('无禁区');
    expect(instructions).toContain('安全的思想实验');
    expect(instructions).toContain('最佳第一步');
  });

  it('adds explicit JSON instructions for DeepSeek json_object mode', () => {
    const prompt = buildDeepSeekSystemPrompt(normalizeRequest({ question: '如何做更疯的点子？' }));

    expect(prompt).toContain('严格 JSON 对象');
    expect(prompt).toContain('示例 JSON 结构');
    expect(prompt).toContain('whyItMightWork');
  });

  it('validates at least ten structured ideas', () => {
    const ideas = validateIdeas({ ideas: Array.from({ length: 10 }, (_, index) => makeIdea(index)) }, 10);
    expect(ideas).toHaveLength(10);
    expect(ideas[0]).toMatchObject({ id: '01', title: '想法 01' });
  });

  it('rejects undersized idea lists', () => {
    expect(() => validateIdeas({ ideas: Array.from({ length: 9 }, (_, index) => makeIdea(index)) }, 10)).toThrow(
      '少于要求',
    );
  });
});
