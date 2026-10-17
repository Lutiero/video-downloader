const api = globalThis.browser ?? globalThis.chrome;
const browserName = globalThis.browser ? 'firefox' : 'chrome';

// Estado em storage.session (chave "job:<key>"); o popup lê direto de lá.
api.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'download') return;
  const { item } = msg;
  const key = 'job:' + item.key;
  const set = (job) => api.storage.session.set({ [key]: job });
  set({ status: 'baixando' });
  // A porta nativa mantém o service worker vivo até o yt-dlp terminar.
  const port = api.runtime.connectNative('video_downloader');
  let finished = false;
  port.onMessage.addListener((r) => {
    if (r.progress !== undefined) return set({ status: 'baixando', pct: r.progress });
    finished = true;
    set(r.ok ? { status: 'concluído', file: r.file } : { status: 'erro', error: r.error });
    api.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: r.ok ? 'Download concluído' : 'Falha no download',
      message: r.ok ? r.file.split('/').pop() : r.error.slice(-200),
    });
  });
  port.onDisconnect.addListener(() => {
    if (!finished) set({ status: 'erro', error: api.runtime.lastError?.message || 'helper encerrou' });
  });
  port.postMessage({ url: item.url, n: item.n, direct: item.direct, browser: browserName });
});
