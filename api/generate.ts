import { createConfiguredGenerator } from '../server/openai.js';
import { normalizeRequest } from '../server/prompt.js';

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

const generateIdeas = createConfiguredGenerator();

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const request = normalizeRequest(req.body);
    res.status(200).json(await generateIdeas(request));
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败，请稍后再试。';
    const status =
      message.includes('OPENAI_API_KEY') || message.includes('DEEPSEEK_API_KEY') || message.includes('请输入')
        ? 400
        : 502;
    res.status(status).json({ error: message });
  }
}
