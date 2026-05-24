import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.js';

const generatedIdeas = Array.from({ length: 10 }, (_, index) => ({
  id: String(index + 1).padStart(2, '0'),
  title: `生成标题 ${index + 1}`,
  angle: '一个不走寻常路的角度。',
  whyItMightWork: '因为它能快速制造反馈。',
  bestFirstStep: '今天把它发给一个真实用户。',
  verificationSignal: '用户愿意回复并提出具体问题。',
  riskNote: null,
}));

function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/sync' && (!init || init.method !== 'PUT')) {
      return {
        ok: true,
        json: async () => ({
          version: 1,
          updatedAt: new Date().toISOString(),
          question: '如何开始做自媒体？',
          constraints: '',
          persona: '疯狂参谋',
          wildness: 92,
          count: 10,
          history: [],
          favoriteIds: [],
          ideas: [],
        }),
      } as Response;
    }
    if (url === '/api/sync' && init?.method === 'PUT') {
      return { ok: true, json: async () => ({}) } as Response;
    }
    if (url === '/api/generate') {
      return { ok: true, json: async () => ({ ideas: generatedIdeas }) } as Response;
    }
    return { ok: false, json: async () => ({ error: 'not found' }) } as Response;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the core workflow controls', async () => {
    mockFetch();
    render(<App />);

    expect(await screen.findByText('今天想炸开什么问题？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成10个想法' })).toBeInTheDocument();
    expect(screen.getByText('疯狂参谋')).toBeInTheDocument();
    expect(screen.getByText('无禁区发散')).toBeInTheDocument();
    expect(screen.getByText('已同步')).toBeInTheDocument();
  });

  it('generates ideas through the API and schedules sync', async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '生成10个想法' }));

    await waitFor(() => expect(screen.getByText('生成标题 1')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/generate', expect.objectContaining({ method: 'POST' }));
  });

  it('shows API errors without clearing the current ideas', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/sync') {
        return {
          ok: true,
          json: async () => ({
            version: 1,
            updatedAt: new Date().toISOString(),
            question: '如何开始做自媒体？',
            constraints: '',
            persona: '疯狂参谋',
            wildness: 92,
            count: 10,
            history: [],
            favoriteIds: [],
            ideas: [],
          }),
        } as Response;
      }
      if (url === '/api/generate' && init?.method === 'POST') {
        return {
          ok: false,
          json: async () => ({ error: '缺少 DEEPSEEK_API_KEY。请在 .env 中配置后重试。' }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '生成10个想法' }));

    await waitFor(() => expect(screen.getByText(/DEEPSEEK_API_KEY/)).toBeInTheDocument());
    expect(screen.getByText('把问题反过来卖')).toBeInTheDocument();
  });
});
