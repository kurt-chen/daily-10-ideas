import dotenv from 'dotenv';
import { createApp } from './app.js';

const runtimePort = process.env.PORT;
const runtimeHost = process.env.HOST;
dotenv.config({ override: true });
if (runtimePort) {
  process.env.PORT = runtimePort;
}
if (runtimeHost) {
  process.env.HOST = runtimeHost;
}

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const app = createApp();

app.listen(port, host, () => {
  console.log(`每日10想 listening on http://${host}:${port}`);
});
