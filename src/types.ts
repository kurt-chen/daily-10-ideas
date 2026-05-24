export type Persona = '疯狂参谋' | '混沌艺术家' | '残酷商业脑' | '无禁区发散';

export type Idea = {
  id: string;
  title: string;
  angle: string;
  whyItMightWork: string;
  bestFirstStep: string;
  verificationSignal: string;
  riskNote: string | null;
};

export type GeneratePayload = {
  question: string;
  count: number;
  wildness: number;
  persona: Persona;
  constraints: string;
  history: string[];
};

export type SyncState = {
  version: 1;
  updatedAt: string;
  question: string;
  constraints: string;
  persona: Persona;
  wildness: number;
  count: number;
  history: string[];
  favoriteIds: string[];
  ideas: Idea[];
};
