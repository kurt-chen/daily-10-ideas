import OpenAI from 'openai';
import { jsonrepair } from 'jsonrepair';
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
  const jsonText = extractJsonObjectText(withoutFence);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    const repaired = removeTrailingCommasOutsideStrings(escapeControlCharactersInJsonStrings(jsonText));
    try {
      return JSON.parse(repaired);
    } catch {
      return JSON.parse(jsonrepair(repaired));
    }
  }
}

function extractJsonObjectText(text: string) {
  const start = text.indexOf('{');
  if (start < 0) {
    return text;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return text.slice(start);
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

function removeTrailingCommasOutsideStrings(json: string) {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < json.length; index += 1) {
    const char = json[index];

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

    if (!inString && char === ',') {
      const nextNonWhitespace = json.slice(index + 1).match(/\S/)?.[0];
      if (nextNonWhitespace === '}' || nextNonWhitespace === ']') {
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
      thinking: { type: 'disabled' },
      temperature: Math.min(0.8, Math.max(0.2, request.wildness / 125)),
      max_tokens: request.count >= 50 ? 12000 : request.count >= 20 ? 7000 : 4500,
      stream: false,
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
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
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
