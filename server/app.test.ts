import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { createDeepSeekGenerator, createOpenAIGenerator } from './openai.js';
import type { Idea } from './types.js';

function ideas(count = 10): Idea[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1).padStart(2, '0'),
    title: `标题 ${index + 1}`,
    angle: '一个足够怪的角度。',
    whyItMightWork: '它会让真实用户暴露偏好。',
    bestFirstStep: '今天找一个人做 10 分钟访谈。',
    verificationSignal: '对方愿意主动追问。',
    riskNote: null,
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.SYNC_PROVIDER;
  delete process.env.GITHUB_SYNC_TOKEN;
  delete process.env.GITHUB_SYNC_GIST_ID;
  delete process.env.GITHUB_SYNC_FILENAME;
  delete process.env.SYNC_STATE_FILE;
});

describe('api app', () => {
  it('returns generated ideas from an injected generator', async () => {
    const generate = vi.fn().mockResolvedValue({ ideas: ideas(10) });
    const app = createApp(generate);

    const response = await request(app)
      .post('/api/generate')
      .send({ question: '如何做一个新产品？', count: 10 });

    expect(response.status).toBe(200);
    expect(response.body.ideas).toHaveLength(10);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ question: '如何做一个新产品？', count: 10 }));
  });

  it('rejects missing questions', async () => {
    const app = createApp(vi.fn());
    const response = await request(app).post('/api/generate').send({ question: ' ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('请输入');
  });

  it('reads and writes synced app state', async () => {
    const originalSyncFile = process.env.SYNC_STATE_FILE;
    const syncFile = path.resolve('node_modules/.tmp/test-sync-state.json');
    process.env.SYNC_STATE_FILE = syncFile;
    await fs.rm(syncFile, { force: true });

    const app = createApp(vi.fn());

    const saved = await request(app).put('/api/sync').send({
      question: '同步测试问题',
      constraints: '同步约束',
      persona: '疯狂参谋',
      wildness: 88,
      count: 10,
      history: ['同步测试问题'],
      favoriteIds: ['01'],
      ideas: ideas(10),
    });
    const loaded = await request(app).get('/api/sync');

    expect(saved.status).toBe(200);
    expect(loaded.status).toBe(200);
    expect(loaded.body.question).toBe('同步测试问题');
    expect(loaded.body.favoriteIds).toEqual(['01']);

    await fs.rm(syncFile, { force: true });
    if (originalSyncFile) {
      process.env.SYNC_STATE_FILE = originalSyncFile;
    } else {
      delete process.env.SYNC_STATE_FILE;
    }
  });

  it('can sync state through GitHub Gist when configured', async () => {
    process.env.SYNC_PROVIDER = 'github_gist';
    process.env.GITHUB_SYNC_TOKEN = 'test-token';
    process.env.GITHUB_SYNC_GIST_ID = 'gist-123';
    process.env.GITHUB_SYNC_FILENAME = 'daily-10-ideas-sync.json';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const method = init?.method || 'GET';
      if (method === 'GET') {
        return {
          ok: true,
          json: async () => ({
            files: {
              'daily-10-ideas-sync.json': {
                content: JSON.stringify({
                  question: '来自 GitHub 的问题',
                  constraints: '',
                  persona: '疯狂参谋',
                  wildness: 92,
                  count: 10,
                  history: [],
                  favoriteIds: [],
                  ideas: [],
                }),
              },
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    const app = createApp(vi.fn());
    const loaded = await request(app).get('/api/sync');
    const saved = await request(app).put('/api/sync').send({
      question: '写回 GitHub 的问题',
      constraints: '',
      persona: '疯狂参谋',
      wildness: 92,
      count: 10,
      history: [],
      favoriteIds: [],
      ideas: [],
    });

    expect(loaded.status).toBe(200);
    expect(loaded.body.question).toBe('来自 GitHub 的问题');
    expect(saved.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/gists/gist-123',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('surfaces malformed model JSON', async () => {
    const generator = createOpenAIGenerator({
      create: vi.fn().mockResolvedValue({ output_text: '{not-json' }),
    });
    const app = createApp(generator);

    const response = await request(app).post('/api/generate').send({ question: '如何破局？' });

    expect(response.status).toBe(502);
    expect(response.body.error).toBeTruthy();
  });

  it('can generate through DeepSeek chat completions', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ ideas: ideas(10) }) } }],
    });
    const generator = createDeepSeekGenerator({ create });
    const app = createApp(generator);

    const response = await request(app).post('/api/generate').send({ question: '如何发散？', count: 10 });

    expect(response.status).toBe(200);
    expect(response.body.ideas).toHaveLength(10);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.any(String),
        response_format: { type: 'json_object' },
        messages: expect.arrayContaining([expect.objectContaining({ role: 'system' })]),
      }),
    );
  });

  it('repairs DeepSeek JSON with literal newlines inside string values', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ ideas: ideas(10) }).replace('它会让真实用户暴露偏好。', '它会让真实用户\n暴露偏好。'),
          },
        },
      ],
    });
    const generator = createDeepSeekGenerator({ create });
    const app = createApp(generator);

    const response = await request(app).post('/api/generate').send({ question: '如何发散？', count: 10 });

    expect(response.status).toBe(200);
    expect(response.body.ideas[0].whyItMightWork).toContain('真实用户');
  });

  it('returns a clear error when the api key is missing', async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const app = createApp(createOpenAIGenerator());

    const response = await request(app).post('/api/generate').send({ question: '如何破局？' });

    process.env.OPENAI_API_KEY = original;
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('OPENAI_API_KEY');
  });

  it('returns a clear DeepSeek error when its api key is missing', async () => {
    const original = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const app = createApp(createDeepSeekGenerator());

    const response = await request(app).post('/api/generate').send({ question: '如何破局？' });

    process.env.DEEPSEEK_API_KEY = original;
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('DEEPSEEK_API_KEY');
  });
});
