type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default function handler(_req: unknown, res: ApiResponse) {
  res.status(200).json({ ok: true, provider: process.env.LLM_PROVIDER || 'deepseek' });
}
