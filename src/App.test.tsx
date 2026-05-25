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

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === '/api/sync' && (!init || init.method !== 'PUT')) {
      return jsonResponse({
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
        });
    }
    if (url === '/api/sync' && init?.method === 'PUT') {
      return jsonResponse({});
    }
    if (url === '/api/generate') {
      return jsonResponse({ ideas: generatedIdeas });
    }
    return jsonResponse({ error: 'not found' }, false);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders the core workflow controls', async () => {
    mockFetch();
    render(<App />);

    expect(await screen.findByText('今天想炸开什么问题？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成10个想法' })).toBeInTheDocument();
    expect(screen.getAllByText('疯狂参谋').length).toBeGreaterThan(0);
    expect(screen.getAllByText('无禁区发散').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('手机快速设置')).toBeInTheDocument();
    expect(screen.getByText('已同步')).toBeInTheDocument();
  });

  it('generates ideas through the API and schedules sync', async () => {
    const fetchMock = mockFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '生成10个想法' }));

    await waitFor(() => expect(screen.getByText('生成标题 1')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/generate', expect.objectContaining({ method: 'POST' }));
  });

  it('exports the current ideas as Markdown', async () => {
    mockFetch();
    const createObjectURL = vi.fn(() => 'blob:daily-10-ideas');
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /Markdown/ }));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/markdown;charset=utf-8');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('copies all ideas as Markdown for notebook apps', async () => {
    mockFetch();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /复制到笔记/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('# 每日10想');
    expect(writeText.mock.calls[0][0]).toContain('**01. 把问题反过来卖**');
    expect(writeText.mock.calls[0][0]).toContain('- **角度：**');
    expect(writeText.mock.calls[0][0]).toContain('- **最佳第一步：**');
  });

  it('shows a PNG export action', async () => {
    mockFetch();
    render(<App />);

    expect(await screen.findByRole('button', { name: /PNG/ })).toBeInTheDocument();
  });

  it('shows API errors without clearing the current ideas', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/sync') {
        return jsonResponse({
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
          });
      }
      if (url === '/api/generate' && init?.method === 'POST') {
        return jsonResponse({ error: '缺少 DEEPSEEK_API_KEY。请在 .env 中配置后重试。' }, false);
      }
      return jsonResponse({}, false);
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '生成10个想法' }));

    await waitFor(() => expect(screen.getByText(/DEEPSEEK_API_KEY/)).toBeInTheDocument());
    expect(screen.getByText('把问题反过来卖')).toBeInTheDocument();
  });
});
