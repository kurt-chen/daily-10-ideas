import { readSyncState, writeSyncState } from '../server/storage.js';

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    if (req.method === 'GET') {
      res.status(200).json(await readSyncState());
      return;
    }

    if (req.method === 'PUT') {
      res.status(200).json(await writeSyncState(req.body));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch {
    res.status(500).json({ error: '同步数据处理失败。' });
  }
}
