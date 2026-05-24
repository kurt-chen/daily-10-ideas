import {
  CheckCircle2,
  Copy,
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

async function generateIdeas(payload: GeneratePayload) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '生成失败，请稍后再试。');
  }

  return data.ideas as Idea[];
}

async function loadSyncState() {
  const response = await fetch('/api/sync');
  if (!response.ok) {
    throw new Error('同步数据读取失败。');
  }
  return (await response.json()) as SyncState;
}

async function saveSyncState(state: Omit<SyncState, 'version' | 'updatedAt'>) {
  const response = await fetch('/api/sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), ...state }),
  });

  if (!response.ok) {
    throw new Error('同步数据保存失败。');
  }

  return (await response.json()) as SyncState;
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
          <button className="subtle-button" type="button" onClick={() => handleGenerate(true)} disabled={isLoading}>
            <RefreshCcw size={16} />
            换一批
          </button>
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

        <section className="control-section">
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

        <section className="control-section">
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
