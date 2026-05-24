import dotenv from 'dotenv';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createApp } from './app.js';

dotenv.config();

const deepseekApiKey = defineSecret('DEEPSEEK_API_KEY');
const githubSyncToken = defineSecret('GITHUB_SYNC_TOKEN');

export const api = onRequest(
  {
    region: 'asia-east1',
    timeoutSeconds: 120,
    memory: '512MiB',
    maxInstances: 10,
    secrets: [deepseekApiKey, githubSyncToken],
  },
  createApp(),
);
