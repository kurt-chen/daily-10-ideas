import type { GenerateRequest, Idea, Persona } from './types.js';

export const PERSONAS: Persona[] = ['疯狂参谋', '混沌艺术家', '残酷商业脑', '无禁区发散'];

export const DEFAULT_REQUEST: Required<Omit<GenerateRequest, 'question'>> = {
  count: 10,
  wildness: 92,
  persona: '疯狂参谋',
  constraints: '',
  history: [],
};

export const ideaSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      minItems: 10,
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'title',
          'angle',
          'whyItMightWork',
          'bestFirstStep',
          'verificationSignal',
          'riskNote',
        ],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          angle: { type: 'string' },
          whyItMightWork: { type: 'string' },
          bestFirstStep: { type: 'string' },
          verificationSignal: { type: 'string' },
          riskNote: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

export function normalizeRequest(body: unknown): Required<GenerateRequest> {
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const question = typeof input.question === 'string' ? input.question.trim() : '';

  if (!question) {
    throw new Error('请输入一个问题。');
  }

  const requestedCount = typeof input.count === 'number' ? input.count : DEFAULT_REQUEST.count;
  const count = [10, 20, 50].includes(requestedCount) ? requestedCount : DEFAULT_REQUEST.count;
  const requestedWildness = typeof input.wildness === 'number' ? input.wildness : DEFAULT_REQUEST.wildness;
  const wildness = Math.max(0, Math.min(100, Math.round(requestedWildness)));
  const persona = PERSONAS.includes(input.persona as Persona)
    ? (input.persona as Persona)
    : DEFAULT_REQUEST.persona;

  return {
    question,
    count,
    wildness,
    persona,
    constraints: typeof input.constraints === 'string' ? input.constraints.trim() : '',
    history: Array.isArray(input.history)
      ? input.history.filter((item): item is string => typeof item === 'string').slice(0, 8)
      : [],
  };
}

export function buildInstructions(request: Required<GenerateRequest>) {
  return [
    '你是“每日10想”的 AI 疯狂参谋。',
    '目标：对用户的问题生成至少十个高度发散、反常识、天马行空的方案。',
    '默认姿态：不讨好、不端水、不输出平庸常识；优先给出让人眼睛一亮的角度。',
    `当前人格：${request.persona}。发散强度：${request.wildness}/100。`,
    '每个方案必须包含一个“最佳第一步”：可在 30 分钟、一天内、或一个小型公开测试中验证。',
    '保持中文输出。标题短而有冲击力，解释要具体，避免空泛鸡汤。',
    '“无禁区”意味着思维上不自我审查，但不能给出直接伤害他人、违法执行、仇恨骚扰、隐私侵犯、武器化操作或自残指导。',
    '遇到高风险请求时，保留创意冲击力，把执行细节转译成安全的思想实验、讽刺作品、制度设计、模拟推演或无害替代实验。',
    '严格返回符合 JSON schema 的对象，不要添加 Markdown 或额外解释。',
  ].join('\n');
}

export function buildUserInput(request: Required<GenerateRequest>) {
  return JSON.stringify({
    question: request.question,
    requestedIdeaCount: request.count,
    constraints: request.constraints,
    recentHistory: request.history,
    outputRules: [
      `生成恰好 ${request.count} 个想法。`,
      '每条 idea.id 使用 01、02、03 这样的编号。',
      'bestFirstStep 必须是一个动作，不是建议或原则。',
      'verificationSignal 必须说明如何判断第一步是否有效。',
      'riskNote 无特殊风险时为 null；需要安全转译时写一句简短说明。',
    ],
  });
}

export function buildJsonExample() {
  return JSON.stringify(
    {
      ideas: [
        {
          id: '01',
          title: '把问题变成一场可下注的赌局',
          angle: '不要让人表达意见，让人用一个小承诺暴露真实偏好。',
          whyItMightWork: '人们会礼貌地赞同很多事，但只会为真正有吸引力的东西下注。',
          bestFirstStep: '今天写出一个 24 小时赌约版本，发给 3 个目标用户，请他们选择愿不愿意下注。',
          verificationSignal: '至少 1 人愿意押时间、钱、公开承诺或介绍资源。',
          riskNote: null,
        },
      ],
    },
    null,
    2,
  );
}

export function buildDeepSeekSystemPrompt(request: Required<GenerateRequest>) {
  return [
    buildInstructions(request),
    '你必须输出严格 JSON 对象，不能输出 Markdown、代码块或解释文字。',
    'JSON 根对象必须只有 ideas 字段；ideas 是数组。',
    '每个 idea 必须包含 id、title、angle、whyItMightWork、bestFirstStep、verificationSignal、riskNote。',
    '示例 JSON 结构如下：',
    buildJsonExample(),
  ].join('\n');
}

export function validateIdeas(payload: unknown, minimumCount: number): Idea[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { ideas?: unknown }).ideas)) {
    throw new Error('模型返回格式无法解析。');
  }

  const ideas = (payload as { ideas: unknown[] }).ideas;
  if (ideas.length < minimumCount) {
    throw new Error(`模型只返回了 ${ideas.length} 个想法，少于要求的 ${minimumCount} 个。`);
  }

  return ideas.map((item, index) => {
    const idea = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const required = ['title', 'angle', 'whyItMightWork', 'bestFirstStep', 'verificationSignal'];
    for (const field of required) {
      if (typeof idea[field] !== 'string' || !idea[field]) {
        throw new Error(`第 ${index + 1} 个想法缺少 ${field}。`);
      }
    }

    return {
      id: typeof idea.id === 'string' && idea.id ? idea.id : String(index + 1).padStart(2, '0'),
      title: idea.title as string,
      angle: idea.angle as string,
      whyItMightWork: idea.whyItMightWork as string,
      bestFirstStep: idea.bestFirstStep as string,
      verificationSignal: idea.verificationSignal as string,
      riskNote: typeof idea.riskNote === 'string' ? idea.riskNote : null,
    };
  });
}
