import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createConfiguredGenerator } from './openai.js';
import { normalizeRequest } from './prompt.js';
import { readSyncState, writeSyncState } from './storage.js';
import type { GenerateIdeas } from './types.js';

export function createApp(generateIdeas: GenerateIdeas = createConfiguredGenerator()) {
  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: process.env.LLM_PROVIDER || 'deepseek' });
  });

  app.post('/api/generate', async (req, res) => {
    try {
      const request = normalizeRequest(req.body);
      const response = await generateIdeas(request);
      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败，请稍后再试。';
      const status =
        message.includes('OPENAI_API_KEY') || message.includes('DEEPSEEK_API_KEY') || message.includes('请输入')
          ? 400
          : 502;
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/sync', async (_req, res) => {
    try {
      res.json(await readSyncState());
    } catch {
      res.status(500).json({ error: '读取同步数据失败。' });
    }
  });

  app.put('/api/sync', async (req, res) => {
    try {
      res.json(await writeSyncState(req.body));
    } catch {
      res.status(500).json({ error: '保存同步数据失败。' });
    }
  });

  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) {
        res.sendFile(path.join(distPath, 'index.html'));
        return;
      }
      next();
    });
  }

  return app;
}
