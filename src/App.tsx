import {
  CheckCircle2,
  Copy,
  Download,
  Flame,
  History,
  Loader2,
  RefreshCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { sampleIdeas } from './sampleIdeas.js';
import type { GeneratePayload, Idea, Persona, SyncState } from './types.js';

const personas: Array<{ value: Persona; hint: string }> = [
  { value: '疯狂参谋', hint: '锋利、反常识、仍然可验证' },
  { value: '无禁区发散', hint: '最大脑洞，自动安全转译' },
  { value: '混沌艺术家', hint: '诗性、荒诞、象征优先' },
  { value: '残酷商业脑', hint: '机会主义、增长、交易感' },
];

const counts = [10, 20, 50];

function ideaToText(idea: Idea) {
  return `${idea.id}. ${idea.title}\n角度：${idea.angle}\n为什么可能有效：${idea.whyItMightWork}\n最佳第一步：${idea.bestFirstStep}\n验证信号：${idea.verificationSignal}`;
}

function ideaToMarkdown(idea: Idea, isFavorite: boolean) {
  return [
    `## ${idea.id}. ${idea.title}${isFavorite ? ' ★' : ''}`,
    '',
    `**角度**：${idea.angle}`,
    '',
    `**为什么可能有效**：${idea.whyItMightWork}`,
    '',
    `**最佳第一步**：${idea.bestFirstStep}`,
    '',
    `**验证信号**：${idea.verificationSignal}`,
    '',
    idea.riskNote ? `**安全转译**：${idea.riskNote}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildMarkdownExport(state: {
  question: string;
  constraints: string;
  persona: Persona;
  wildness: number;
  count: number;
  ideas: Idea[];
  favorites: Set<string>;
}) {
  return [
    `# 每日10想：${state.question || '未命名问题'}`,
    '',
    `- 导出时间：${new Date().toLocaleString()}`,
    `- 人格模式：${state.persona}`,
    `- 发散强度：${state.wildness}%`,
    `- 输出数量：${state.count}`,
    state.constraints ? `- 约束：${state.constraints}` : '',
    '',
    ...state.ideas.map((idea) => ideaToMarkdown(idea, state.favorites.has(idea.id))),
    '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function buildJsonExport(state: {
  question: string;
  constraints: string;
  persona: Persona;
  wildness: number;
  count: number;
  ideas: Idea[];
  favorites: Set<string>;
}) {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      question: state.question,
      constraints: state.constraints,
      persona: state.persona,
      wildness: state.wildness,
      count: state.count,
      favoriteIds: Array.from(state.favorites),
      ideas: state.ideas,
    },
    null,
    2,
  );
}

function buildNotebookCopy(state: {
  question: string;
  constraints: string;
  persona: Persona;
  wildness: number;
  ideas: Idea[];
}) {
  return [
    `# 每日10想：${state.question || '未命名问题'}`,
    '',
    `- 人格模式：${state.persona}`,
    `- 发散强度：${state.wildness}%`,
    state.constraints ? `- 约束：${state.constraints}` : '',
    '',
    ...state.ideas.map((idea) =>
      [
        `**${idea.id}. ${idea.title}**`,
        '',
        `- **角度：** ${idea.angle}`,
        `- **为什么可能有效：** ${idea.whyItMightWork}`,
        `- **最佳第一步：** ${idea.bestFirstStep}`,
        `- **验证信号：** ${idea.verificationSignal}`,
        idea.riskNote ? `- **安全转译：** ${idea.riskNote}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ]
    .filter((line) => line !== '')
    .join('\n\n');
}

function safeFilename(input: string) {
  const normalized = input.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-');
  return (normalized || 'daily-10-ideas').slice(0, 48);
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlobFile(filename, blob);
}

function downloadBlobFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const source = text || '';
  const lines: string[] = [];
  let current = '';

  for (const char of source) {
    const next = current + char;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [''];
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const lines = wrapCanvasText(ctx, text, maxWidth);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const size = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.arcTo(x + width, y, x + width, y + height, size);
  ctx.arcTo(x + width, y + height, x, y + height, size);
  ctx.arcTo(x, y + height, x, y, size);
  ctx.arcTo(x, y, x + width, y, size);
  ctx.closePath();
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('图片导出失败，请稍后重试。'));
      }
    }, 'image/png');
  });
}

async function buildPngExport(state: {
  question: string;
  constraints: string;
  persona: Persona;
  wildness: number;
  count: number;
  ideas: Idea[];
  favorites: Set<string>;
}) {
  const width = 1200;
  const padding = 70;
  const contentWidth = width - padding * 2;
  const cardInset = 34;
  const cardTextWidth = contentWidth - cardInset * 2;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('当前浏览器不支持图片导出。');
  }

  measureCtx.font = '800 48px "Microsoft YaHei", "PingFang SC", sans-serif';
  let height = 310 + wrapCanvasText(measureCtx, state.question || '未命名问题', contentWidth - 60).length * 60;
  measureCtx.font = '400 24px "Microsoft YaHei", "PingFang SC", sans-serif';
  if (state.constraints) {
    height += wrapCanvasText(measureCtx, `约束：${state.constraints}`, contentWidth - 60).length * 34 + 26;
  }
  height += 34;

  for (const idea of state.ideas) {
    measureCtx.font = '800 32px "Microsoft YaHei", "PingFang SC", sans-serif';
    height += wrapCanvasText(measureCtx, idea.title, cardTextWidth - 86).length * 42 + 54;
    measureCtx.font = '400 23px "Microsoft YaHei", "PingFang SC", sans-serif';
    height += wrapCanvasText(measureCtx, idea.angle, cardTextWidth).length * 34 + 18;
    height += wrapCanvasText(measureCtx, idea.whyItMightWork, cardTextWidth).length * 34 + 18;
    height += wrapCanvasText(measureCtx, idea.bestFirstStep, cardTextWidth - 40).length * 34 + 34;
    height += wrapCanvasText(measureCtx, idea.verificationSignal, cardTextWidth).length * 34 + 18;
    if (idea.riskNote) {
      height += wrapCanvasText(measureCtx, idea.riskNote, cardTextWidth).length * 34 + 18;
    }
    height += 54;
  }
  height += 92;

  const scale = Math.min(2, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = Math.ceil(height) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('当前浏览器不支持图片导出。');
  }
  ctx.scale(scale, scale);

  ctx.fillStyle = '#f7f8f2';
  ctx.fillRect(0, 0, width, height);

  const topGradient = ctx.createLinearGradient(0, 0, width, 260);
  topGradient.addColorStop(0, '#efffbd');
  topGradient.addColorStop(0.52, '#ffffff');
  topGradient.addColorStop(1, '#f7f8f2');
  ctx.fillStyle = topGradient;
  ctx.fillRect(0, 0, width, 300);

  ctx.fillStyle = 'rgba(183, 255, 0, 0.7)';
  roundedRect(ctx, width - 330, 42, 210, 210, 105);
  ctx.fill();
  ctx.fillStyle = 'rgba(21, 21, 21, 0.05)';
  roundedRect(ctx, width - 160, 88, 66, 66, 33);
  ctx.fill();

  ctx.fillStyle = '#151515';
  roundedRect(ctx, padding, padding, 48, 48, 14);
  ctx.fill();
  ctx.fillStyle = '#b7ff00';
  ctx.font = '900 30px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('10', padding + 9, padding + 34);

  ctx.fillStyle = '#151515';
  ctx.font = '900 25px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('每日10想', padding + 62, padding + 32);

  ctx.fillStyle = '#eef9d5';
  roundedRect(ctx, padding + 190, padding + 7, 150, 34, 17);
  ctx.fill();
  ctx.fillStyle = '#527800';
  ctx.font = '800 17px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('AI 发散参谋', padding + 209, padding + 30);

  let y = padding + 116;
  ctx.fillStyle = '#151515';
  ctx.font = '900 48px "Microsoft YaHei", "PingFang SC", sans-serif';
  y = drawWrappedText(ctx, state.question || '未命名问题', padding, y, contentWidth - 60, 60);

  y += 18;
  const metaItems = [`${state.persona}`, `发散强度 ${state.wildness}%`, `${state.ideas.length} 条想法`];
  let metaX = padding;
  ctx.font = '800 20px "Microsoft YaHei", "PingFang SC", sans-serif';
  for (const item of metaItems) {
    const itemWidth = ctx.measureText(item).width + 34;
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, metaX, y - 26, itemWidth, 40, 20);
    ctx.fill();
    ctx.strokeStyle = '#d8ed9a';
    ctx.stroke();
    ctx.fillStyle = '#43463e';
    ctx.fillText(item, metaX + 17, y);
    metaX += itemWidth + 12;
  }
  y += 44;

  ctx.fillStyle = '#666a61';
  ctx.font = '400 22px "Microsoft YaHei", "PingFang SC", sans-serif';
  y = drawWrappedText(ctx, `导出时间：${new Date().toLocaleString()}`, padding, y, contentWidth - 60, 34);
  if (state.constraints) {
    ctx.fillStyle = '#3f403b';
    ctx.font = '600 23px "Microsoft YaHei", "PingFang SC", sans-serif';
    y = drawWrappedText(ctx, `约束：${state.constraints}`, padding, y + 12, contentWidth - 60, 34);
  }
  y += 34;

  for (const idea of state.ideas) {
    const cardTop = y;
    measureCtx.font = '800 32px "Microsoft YaHei", "PingFang SC", sans-serif';
    let cardHeight = wrapCanvasText(measureCtx, idea.title, cardTextWidth - 86).length * 42 + 76;
    measureCtx.font = '400 23px "Microsoft YaHei", "PingFang SC", sans-serif';
    cardHeight += wrapCanvasText(measureCtx, idea.angle, cardTextWidth).length * 34 + 20;
    cardHeight += wrapCanvasText(measureCtx, idea.whyItMightWork, cardTextWidth).length * 34 + 20;
    cardHeight += wrapCanvasText(measureCtx, idea.bestFirstStep, cardTextWidth - 40).length * 34 + 52;
    cardHeight += wrapCanvasText(measureCtx, idea.verificationSignal, cardTextWidth).length * 34 + 20;
    if (idea.riskNote) {
      cardHeight += wrapCanvasText(measureCtx, idea.riskNote, cardTextWidth).length * 34 + 20;
    }
    cardHeight += 38;

    ctx.save();
    ctx.shadowColor = 'rgba(35, 35, 20, 0.10)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, padding, cardTop, contentWidth, cardHeight, 16);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#e2e5d8';
    ctx.stroke();

    ctx.fillStyle = idea.id === '01' ? '#b7ff00' : '#f1f2eb';
    roundedRect(ctx, padding + cardInset, cardTop + 28, 62, 42, 21);
    ctx.fill();
    ctx.fillStyle = '#151515';
    ctx.font = '900 22px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(idea.id, padding + cardInset + 16, cardTop + 56);

    y += 58;
    ctx.fillStyle = '#151515';
    ctx.font = '900 32px "Microsoft YaHei", "PingFang SC", sans-serif';
    y = drawWrappedText(
      ctx,
      `${idea.title}${state.favorites.has(idea.id) ? ' ★' : ''}`,
      padding + cardInset + 82,
      y,
      cardTextWidth - 86,
      42,
    );

    ctx.fillStyle = '#3f403b';
    ctx.font = '400 23px "Microsoft YaHei", "PingFang SC", sans-serif';
    y += 18;
    ctx.fillStyle = '#82c800';
    ctx.font = '900 19px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText('角度', padding + cardInset, y);
    ctx.fillStyle = '#3f403b';
    ctx.font = '400 23px "Microsoft YaHei", "PingFang SC", sans-serif';
    y = drawWrappedText(ctx, idea.angle, padding + cardInset, y + 34, cardTextWidth, 34);

    ctx.fillStyle = '#82c800';
    ctx.font = '900 19px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText('为什么可能有效', padding + cardInset, y + 8);
    ctx.fillStyle = '#3f403b';
    ctx.font = '400 23px "Microsoft YaHei", "PingFang SC", sans-serif';
    y = drawWrappedText(ctx, idea.whyItMightWork, padding + cardInset, y + 42, cardTextWidth, 34);

    ctx.fillStyle = '#f8ffe8';
    roundedRect(ctx, padding + cardInset, y + 10, cardTextWidth, 86, 12);
    ctx.fill();
    ctx.strokeStyle = '#d8ed9a';
    ctx.stroke();
    ctx.fillStyle = '#527800';
    ctx.font = '900 19px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText('最佳第一步', padding + cardInset + 20, y + 42);
    ctx.fillStyle = '#222';
    ctx.font = '700 23px "Microsoft YaHei", "PingFang SC", sans-serif';
    y = drawWrappedText(ctx, idea.bestFirstStep, padding + cardInset + 20, y + 76, cardTextWidth - 40, 34);

    y += 22;
    ctx.fillStyle = '#666a61';
    ctx.font = '400 22px "Microsoft YaHei", "PingFang SC", sans-serif';
    y = drawWrappedText(ctx, `验证信号：${idea.verificationSignal}`, padding + cardInset, y, cardTextWidth, 34);
    if (idea.riskNote) {
      ctx.fillStyle = '#6f4c00';
      y = drawWrappedText(ctx, `安全转译：${idea.riskNote}`, padding + cardInset, y + 6, cardTextWidth, 34);
    }
    y = cardTop + cardHeight + 26;
  }

  ctx.fillStyle = '#8a8d84';
  ctx.font = '500 20px "Microsoft YaHei", "PingFang SC", sans-serif';
  ctx.fillText('由 每日10想 生成 · 保存你的疯狂参谋输出', padding, height - 46);

  return canvasToBlob(canvas);
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function readApiError(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string') {
    return (data as { error: string }).error;
  }
  return fallback;
}

async function generateIdeas(payload: GeneratePayload) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? safeParseJson(text) : null;
  if (!response.ok) {
    throw new Error(readApiError(data, '生成失败，请确认本地 API 服务正在运行。'));
  }

  if (!data || !Array.isArray((data as { ideas?: unknown }).ideas)) {
    throw new Error('生成结果格式异常，请稍后重试。');
  }

  return data.ideas as Idea[];
}

async function loadSyncState() {
  const response = await fetch('/api/sync');
  const text = await response.text();
  const data = text ? safeParseJson(text) : null;
  if (!response.ok) {
    throw new Error('同步数据读取失败。');
  }
  if (!data) {
    throw new Error('同步数据为空。');
  }
  return data as SyncState;
}

async function saveSyncState(state: Omit<SyncState, 'version' | 'updatedAt'>) {
  const response = await fetch('/api/sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), ...state }),
  });

  const text = await response.text();
  const data = text ? safeParseJson(text) : null;
  if (!response.ok) {
    throw new Error('同步数据保存失败。');
  }

  return (data || {}) as SyncState;
}

export default function App() {
  const [question, setQuestion] = useState('如何开始做自媒体？');
  const [constraints, setConstraints] = useState('');
  const [persona, setPersona] = useState<Persona>('疯狂参谋');
  const [wildness, setWildness] = useState(92);
  const [count, setCount] = useState(10);
  const [ideas, setIdeas] = useState<Idea[]>(sampleIdeas);
  const [history, setHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [copiedNotebook, setCopiedNotebook] = useState(false);
  const [exportedFormat, setExportedFormat] = useState<'markdown' | 'json' | 'png' | ''>('');
  const [syncStatus, setSyncStatus] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const skipNextSave = useRef(true);

  const activePersona = useMemo(
    () => personas.find((item) => item.value === persona) ?? personas[0],
    [persona],
  );

  const syncPayload = useMemo(
    () => ({
      question,
      constraints,
      persona,
      wildness,
      count,
      history,
      favoriteIds: Array.from(favorites),
      ideas,
    }),
    [question, constraints, persona, wildness, count, history, favorites, ideas],
  );

  useEffect(() => {
    let cancelled = false;

    loadSyncState()
      .then((state) => {
        if (cancelled) return;
        setQuestion(state.question);
        setConstraints(state.constraints);
        setPersona(state.persona);
        setWildness(state.wildness);
        setCount(state.count);
        setHistory(state.history);
        setFavorites(new Set(state.favoriteIds));
        if (state.ideas.length) {
          setIdeas(state.ideas);
        }
        skipNextSave.current = true;
        setSyncStatus('saved');
      })
      .catch(() => {
        if (cancelled) return;
        setSyncStatus('error');
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    setSyncStatus('saving');
    const timeout = window.setTimeout(() => {
      saveSyncState(syncPayload)
        .then(() => setSyncStatus('saved'))
        .catch(() => setSyncStatus('error'));
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [isHydrated, syncPayload]);

  async function handleGenerate(regenerate = false) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError('先丢一个问题进来。');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const nextHistory = [trimmedQuestion, ...history.filter((item) => item !== trimmedQuestion)].slice(0, 20);
      const nextIdeas = await generateIdeas({
        question: trimmedQuestion,
        count,
        wildness,
        persona,
        constraints,
        history: nextHistory.slice(0, 8),
      });
      setIdeas(nextIdeas);
      setHistory(nextHistory);
      if (!regenerate) {
        setFavorites(new Set());
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '生成失败，请稍后再试。');
    } finally {
      setIsLoading(false);
    }
  }

  async function copyIdea(idea: Idea) {
    await navigator.clipboard.writeText(ideaToText(idea));
    setCopiedId(idea.id);
    window.setTimeout(() => setCopiedId(''), 1200);
  }

  async function copyAllToNotebook() {
    try {
      await navigator.clipboard.writeText(buildNotebookCopy({ question, constraints, persona, wildness, ideas }));
      setCopiedNotebook(true);
      window.setTimeout(() => setCopiedNotebook(false), 1400);
    } catch {
      setError('复制失败，请检查浏览器剪贴板权限。');
    }
  }

  async function handleExport(format: 'markdown' | 'json' | 'png') {
    const baseName = `${safeFilename(question)}-${new Date().toISOString().slice(0, 10)}`;
    const exportState = { question, constraints, persona, wildness, count, ideas, favorites };
    if (format === 'markdown') {
      downloadTextFile(`${baseName}.md`, buildMarkdownExport(exportState), 'text/markdown;charset=utf-8');
    } else if (format === 'json') {
      downloadTextFile(`${baseName}.json`, buildJsonExport(exportState), 'application/json;charset=utf-8');
    } else {
      downloadBlobFile(`${baseName}.png`, await buildPngExport(exportState));
    }
    setExportedFormat(format);
    window.setTimeout(() => setExportedFormat(''), 1400);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Zap size={24} />
          </span>
          <span>每日10想</span>
        </div>

        <button className="new-button" type="button" onClick={() => setQuestion('')}>
          <Sparkles size={18} />
          新建想法
        </button>

        <nav className="nav-list" aria-label="主导航">
          <a className="nav-item active" href="#ideas">
            <Zap size={17} />
            今日10想
          </a>
          <a className="nav-item" href="#history">
            <History size={17} />
            历史记录
          </a>
          <a className="nav-item" href="#favorites">
            <Star size={17} />
            我的收藏
          </a>
          <a className="nav-item" href="#safety">
            <ShieldAlert size={17} />
            安全转译
          </a>
        </nav>

        <div className="sidebar-section">
          <div className="section-title">项目空间</div>
          {['个人问题', '内容创作', '产品探索', '商业点子', '写作计划'].map((item) => (
            <button className="folder-button" key={item} type="button">
              {item}
            </button>
          ))}
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="microcopy">疯狂参谋已上线</p>
            <h1>今天想炸开什么问题？</h1>
          </div>
          <div className="top-actions">
            <SyncIndicator status={syncStatus} />
            <button className="icon-button" type="button" aria-label="重新生成" onClick={() => handleGenerate(true)}>
              <RefreshCcw size={18} />
            </button>
            <button className="profile-button" type="button" aria-label="当前用户">
              你
            </button>
          </div>
        </header>

        <section className="mobile-tuning-panel" aria-label="手机快速设置">
          <div className="mobile-control-row">
            <h2>人格模式</h2>
            <div className="mobile-mode-scroll">
              {personas.map((item) => (
                <button
                  className={item.value === persona ? 'mode-card selected' : 'mode-card'}
                  key={item.value}
                  type="button"
                  onClick={() => setPersona(item.value)}
                >
                  <span>{item.value}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="mobile-control-row">
            <h2>输出数量</h2>
            <div className="segmented">
              {counts.map((item) => (
                <button className={count === item ? 'selected' : ''} key={item} type="button" onClick={() => setCount(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="prompt-panel" aria-label="问题输入">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={500}
            placeholder="输入一个你想撕开的难题，比如：如何让我的产品像地下传说一样传播？"
          />
          <div className="prompt-footer">
            <input
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              placeholder="可选约束：预算、行业、人群、不能碰的现实边界"
            />
            <span>{question.length}/500</span>
            <button className="generate-button" type="button" onClick={() => handleGenerate()} disabled={isLoading}>
              {isLoading ? <Loader2 className="spin" size={18} /> : <Flame size={18} />}
              生成{count}个想法
            </button>
          </div>
          {error ? <div className="error-banner">{error}</div> : null}
        </section>

        <section className="results-header" id="ideas">
          <div>
            <h2>为你生成的 {ideas.length} 个想法</h2>
            <p>
              {activePersona.value}：{activePersona.hint}
            </p>
          </div>
          <div className="results-actions">
            <div className="export-actions" aria-label="导出想法">
              <button className="subtle-button primary-copy" type="button" onClick={copyAllToNotebook} disabled={!ideas.length}>
                <Copy size={16} />
                复制到笔记
              </button>
              <button className="subtle-button" type="button" onClick={() => handleExport('markdown')} disabled={!ideas.length}>
                <Download size={16} />
                导出 Markdown
              </button>
              <button className="subtle-button" type="button" onClick={() => handleExport('json')} disabled={!ideas.length}>
                <Download size={16} />
                导出 JSON
              </button>
              <button className="subtle-button" type="button" onClick={() => handleExport('png')} disabled={!ideas.length}>
                <Download size={16} />
                导出 PNG
              </button>
              {exportedFormat ? <span className="exported">已导出</span> : null}
              {copiedNotebook ? <span className="exported">已复制</span> : null}
            </div>
            <button className="subtle-button" type="button" onClick={() => handleGenerate(true)} disabled={isLoading}>
            <RefreshCcw size={16} />
            换一批
            </button>
          </div>
        </section>

        <section className="idea-list" aria-label="生成结果">
          {ideas.map((idea) => (
            <article className="idea-row" key={idea.id}>
              <div className="idea-number">{idea.id}</div>
              <div className="idea-content">
                <h3>{idea.title}</h3>
                <p className="angle">{idea.angle}</p>
                <p>{idea.whyItMightWork}</p>
                <div className="first-step">
                  <strong>最佳第一步</strong>
                  <span>{idea.bestFirstStep}</span>
                </div>
                <div className="signal">验证信号：{idea.verificationSignal}</div>
                {idea.riskNote ? <div className="risk-note">安全转译：{idea.riskNote}</div> : null}
              </div>
              <div className="idea-actions">
                <button
                  className={favorites.has(idea.id) ? 'icon-button active' : 'icon-button'}
                  type="button"
                  aria-label="收藏"
                  onClick={() => toggleFavorite(idea.id)}
                >
                  <Star size={17} />
                </button>
                <button className="icon-button" type="button" aria-label="复制" onClick={() => copyIdea(idea)}>
                  <Copy size={17} />
                </button>
                {copiedId === idea.id ? <span className="copied">已复制</span> : null}
              </div>
            </article>
          ))}
        </section>
      </main>

      <aside className="control-panel">
        <section className="control-section">
          <h2>想法风格调节</h2>
          <label className="range-label" htmlFor="wildness">
            <span>发散强度</span>
            <strong>{wildness}%</strong>
          </label>
          <input
            id="wildness"
            type="range"
            min="0"
            max="100"
            value={wildness}
            onChange={(event) => setWildness(Number(event.target.value))}
          />
          <div className="range-scale">
            <span>克制</span>
            <span>无禁区</span>
          </div>
        </section>

        <section className="control-section desktop-persona-section">
          <h2>人格模式</h2>
          <div className="mode-list">
            {personas.map((item) => (
              <button
                className={item.value === persona ? 'mode-card selected' : 'mode-card'}
                key={item.value}
                type="button"
                onClick={() => setPersona(item.value)}
              >
                <span>{item.value}</span>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="control-section desktop-count-section">
          <h2>输出数量</h2>
          <div className="segmented">
            {counts.map((item) => (
              <button className={count === item ? 'selected' : ''} key={item} type="button" onClick={() => setCount(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="control-section" id="history">
          <div className="history-title">
            <h2>历史记录</h2>
            <Send size={15} />
          </div>
          <div className="history-list">
            {(history.length ? history : ['如何开始做自媒体？', '如何把 AI 工具做成差异化产品？']).map((item) => (
              <button className="history-item" key={item} type="button" onClick={() => setQuestion(item)}>
                {item}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function SyncIndicator({ status }: { status: 'loading' | 'saving' | 'saved' | 'error' }) {
  const label = {
    loading: '同步中',
    saving: '保存中',
    saved: '已同步',
    error: '同步失败',
  }[status];

  return (
    <span className={`sync-indicator ${status}`} title="手机和电脑会同步到同一个服务端数据文件">
      {status === 'saved' ? <CheckCircle2 size={15} /> : <Loader2 className={status === 'error' ? '' : 'spin'} size={15} />}
      {label}
    </span>
  );
}
