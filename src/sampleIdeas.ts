import type { Idea } from './types.js';

export const sampleIdeas: Idea[] = [
  {
    id: '01',
    title: '把问题反过来卖',
    angle: '不问“怎么解决”，先问“谁会为这个麻烦付钱”。把痛点包装成一张悬赏单。',
    whyItMightWork: '多数人急着找答案，少有人先确认这个问题是否真的有交易价值。',
    bestFirstStep: '写下 3 个愿意为此付费的人群，并给其中 1 个发一句验证消息。',
    verificationSignal: '对方愿意继续聊、给出价格区间，或主动补充场景。',
    riskNote: null,
  },
  {
    id: '02',
    title: '制造一个小型异端仪式',
    angle: '把常规流程改成反直觉的公开挑战，让参与者用行为投票。',
    whyItMightWork: '荒诞的形式会迫使人跳出礼貌答案，暴露真实偏好。',
    bestFirstStep: '发起一个 24 小时挑战帖，只允许参与者提交最离谱的解决法。',
    verificationSignal: '收到至少 5 个非模板化回应，且有人转发或二次创作。',
    riskNote: null,
  },
  {
    id: '03',
    title: '先做一个不可规模化的怪东西',
    angle: '不要先自动化，先用手工方式做一个像魔术一样的体验。',
    whyItMightWork: '手工版本能最快发现用户到底对哪一秒感到兴奋。',
    bestFirstStep: '选 1 个目标用户，用人工方式为他交付一次过度定制结果。',
    verificationSignal: '用户问“这个能不能再来一次”或愿意把朋友拉进来。',
    riskNote: null,
  },
];
