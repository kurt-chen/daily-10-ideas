import OpenAI from 'openai';
import {
  buildDeepSeekSystemPrompt,
  buildInstructions,
  buildUserInput,
  ideaSchema,
  validateIdeas,
} from './prompt.js';
import type { GenerateIdeas } from './types.js';

type ResponsesClient = Pick<OpenAI['responses'], 'create'>;
type ChatCompletionsClient = Pick<OpenAI['chat']['completions'], 'create'>;

function parseJsonObject(rawText: string) {
  const trimmed = rawText.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    return JSON.parse(escapeControlCharactersInJsonStrings(withoutFence));
  }
}

function escapeControlCharactersInJsonStrings(json: string) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (const char of json) {
    if (escaped) {
      output += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      output += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      output += char;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (char === '\n') {
        output += '\\n';
        continue;
      }
      if (char === '\r') {
        output += '\\r';
        continue;
      }
      if (char === '\t') {
        output += '\\t';
        continue;
      }
    }

    output += char;
  }

  return output;
}

export function createOpenAIGenerator(client?: ResponsesClient): GenerateIdeas {
  return async (request) => {
    if (!process.env.OPENAI_API_KEY && !client) {
      throw new Error('缺少 OPENAI_API_KEY。请在 .env 中配置后重试。');
    }

    const responses = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses;
    const model = process.env.OPENAI_MODEL || 'gpt-5.5';

    const response = await responses.create({
      model,
      instructions: buildInstructions(request),
      input: buildUserInput(request),
      text: {
        format: {
          type: 'json_schema',
          name: 'daily_10_ideas',
          strict: true,
          schema: ideaSchema,
        },
      },
    });

    const rawText = response.output_text;
    if (!rawText) {
      throw new Error('模型没有返回文本内容。');
    }

    const parsed = parseJsonObject(rawText);
    return { ideas: validateIdeas(parsed, request.count) };
  };
}

export function createDeepSeekGenerator(client?: ChatCompletionsClient): GenerateIdeas {
  return async (request) => {
    if (!process.env.DEEPSEEK_API_KEY && !client) {
      throw new Error('缺少 DEEPSEEK_API_KEY。请在 .env 中配置后重试。');
    }

    const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    const payload = {
      model,
      messages: [
        { role: 'system', content: buildDeepSeekSystemPrompt(request) },
        { role: 'user', content: buildUserInput(request) },
      ],
      response_format: { type: 'json_object' },
      temperature: Math.min(2, Math.max(0.2, request.wildness / 55)),
      max_tokens: request.count >= 50 ? 12000 : request.count >= 20 ? 7000 : 4500,
      stream: false,
      extra_body: { thinking: { type: 'disabled' } },
    };

    const completion = client
      ? ((await client.create(payload as Parameters<ChatCompletionsClient['create']>[0])) as {
          choices: Array<{ message?: { content?: string | null } }>;
        })
      : await fetchDeepSeekCompletion(payload);

    const rawText = completion.choices[0]?.message?.content;
    if (!rawText) {
      throw new Error('DeepSeek 没有返回文本内容。');
    }

    const parsed = parseJsonObject(rawText);
    return { ideas: validateIdeas(parsed, request.count) };
  };
}

async function fetchDeepSeekCompletion(payload: Record<string, unknown>) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`DeepSeek API ${response.status}: ${text.slice(0, 300)}`);
  }

  return JSON.parse(text) as {
    choices: Array<{ message?: { content?: string | null } }>;
  };
}

export function createConfiguredGenerator(): GenerateIdeas {
  const provider = (process.env.LLM_PROVIDER || 'deepseek').toLowerCase();

  if (provider === 'deepseek') {
    return createDeepSeekGenerator();
  }

  if (provider === 'openai') {
    return createOpenAIGenerator();
  }

  throw new Error(`不支持的 LLM_PROVIDER：${process.env.LLM_PROVIDER}`);
}
