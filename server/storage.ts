import fs from 'node:fs/promises';
import path from 'node:path';
import { PERSONAS } from './prompt.js';
import type { Idea, Persona, SyncState } from './types.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DEFAULT_FIRESTORE_SYNC_DOC = 'daily10ideas/sync-state';

function getSyncFile() {
  return process.env.SYNC_STATE_FILE || path.join(DATA_DIR, 'sync-state.json');
}

export const defaultSyncState: SyncState = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  question: '如何开始做自媒体？',
  constraints: '',
  persona: '疯狂参谋',
  wildness: 92,
  count: 10,
  history: [],
  favoriteIds: [],
  ideas: [],
};

export async function readSyncState(): Promise<SyncState> {
  if (shouldUseFirestore()) {
    return readFirestoreSyncState();
  }

  if (shouldUseGitHubGist()) {
    return readGitHubGistSyncState();
  }

  try {
    const raw = await fs.readFile(getSyncFile(), 'utf8');
    return normalizeSyncState(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultSyncState;
    }
    throw error;
  }
}

export async function writeSyncState(input: unknown): Promise<SyncState> {
  const nextState: SyncState = {
    ...normalizeSyncState(input),
    updatedAt: new Date().toISOString(),
  };

  if (shouldUseFirestore()) {
    return writeFirestoreSyncState(nextState);
  }

  if (shouldUseGitHubGist()) {
    return writeGitHubGistSyncState(nextState);
  }

  const syncFile = getSyncFile();
  await fs.mkdir(path.dirname(syncFile), { recursive: true });
  await fs.writeFile(syncFile, `${JSON.stringify(nextState, null, 2)}\n`, 'utf8');
  return nextState;
}

export function normalizeSyncState(input: unknown): SyncState {
  const source = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const persona = PERSONAS.includes(source.persona as Persona) ? (source.persona as Persona) : defaultSyncState.persona;
  const requestedCount = typeof source.count === 'number' ? source.count : defaultSyncState.count;
  const count = [10, 20, 50].includes(requestedCount) ? requestedCount : defaultSyncState.count;
  const requestedWildness = typeof source.wildness === 'number' ? source.wildness : defaultSyncState.wildness;

  return {
    version: 1,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : defaultSyncState.updatedAt,
    question: typeof source.question === 'string' ? source.question.slice(0, 500) : defaultSyncState.question,
    constraints: typeof source.constraints === 'string' ? source.constraints.slice(0, 500) : '',
    persona,
    wildness: Math.max(0, Math.min(100, Math.round(requestedWildness))),
    count,
    history: normalizeStringList(source.history, 20, 500),
    favoriteIds: normalizeStringList(source.favoriteIds, 100, 20),
    ideas: normalizeIdeas(source.ideas),
  };
}

function normalizeStringList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeIdeas(value: unknown): Idea[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 50).flatMap((item, index) => {
    const idea = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const required = ['title', 'angle', 'whyItMightWork', 'bestFirstStep', 'verificationSignal'];
    if (required.some((field) => typeof idea[field] !== 'string' || !(idea[field] as string).trim())) {
      return [];
    }

    return [
      {
        id: typeof idea.id === 'string' && idea.id ? idea.id.slice(0, 20) : String(index + 1).padStart(2, '0'),
        title: (idea.title as string).slice(0, 240),
        angle: (idea.angle as string).slice(0, 800),
        whyItMightWork: (idea.whyItMightWork as string).slice(0, 800),
        bestFirstStep: (idea.bestFirstStep as string).slice(0, 800),
        verificationSignal: (idea.verificationSignal as string).slice(0, 800),
        riskNote: typeof idea.riskNote === 'string' ? idea.riskNote.slice(0, 400) : null,
      },
    ];
  });
}

async function readFirestoreSyncState() {
  const db = await getFirestore();
  const snapshot = await db.doc(getFirestoreSyncDoc()).get();
  if (!snapshot.exists) {
    return defaultSyncState;
  }

  return normalizeSyncState(snapshot.data());
}

async function writeFirestoreSyncState(state: SyncState) {
  const db = await getFirestore();
  await db.doc(getFirestoreSyncDoc()).set(state, { merge: false });
  return state;
}

async function getFirestore() {
  const admin = await import('firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
}

function getFirestoreSyncDoc() {
  return process.env.FIRESTORE_SYNC_DOC || DEFAULT_FIRESTORE_SYNC_DOC;
}

async function readGitHubGistSyncState() {
  const gist = await fetchGitHubGist();
  const filename = getGitHubSyncFilename();
  const content = gist.files?.[filename]?.content;

  if (!content) {
    return defaultSyncState;
  }

  return normalizeSyncState(JSON.parse(content));
}

async function writeGitHubGistSyncState(state: SyncState) {
  const gistId = getGitHubGistId();
  const filename = getGitHubSyncFilename();
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: githubHeaders(),
    body: JSON.stringify({
      files: {
        [filename]: {
          content: `${JSON.stringify(state, null, 2)}\n`,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub Gist 同步保存失败：${response.status}`);
  }

  return state;
}

async function fetchGitHubGist() {
  const gistId = getGitHubGistId();
  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: githubHeaders(),
  });

  if (!response.ok) {
    throw new Error(`GitHub Gist 同步读取失败：${response.status}`);
  }

  return (await response.json()) as {
    files?: Record<string, { content?: string }>;
  };
}

function githubHeaders() {
  const token = process.env.GITHUB_SYNC_TOKEN;
  if (!token) {
    throw new Error('缺少 GITHUB_SYNC_TOKEN。');
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function getGitHubGistId() {
  const gistId = process.env.GITHUB_SYNC_GIST_ID;
  if (!gistId) {
    throw new Error('缺少 GITHUB_SYNC_GIST_ID。');
  }
  return gistId;
}

function getGitHubSyncFilename() {
  return process.env.GITHUB_SYNC_FILENAME || 'daily-10-ideas-sync.json';
}

function shouldUseFirestore() {
  return process.env.SYNC_PROVIDER === 'firebase_firestore' || Boolean(process.env.FIRESTORE_SYNC_DOC);
}

function shouldUseGitHubGist() {
  return process.env.SYNC_PROVIDER === 'github_gist' || Boolean(process.env.GITHUB_SYNC_GIST_ID);
}
