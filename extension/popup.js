const api = globalThis.browser ?? globalThis.chrome;
const list = document.getElementById('list');
let items = [];

// Roda dentro da página (injetada). Precisa ser autocontida.
function collect() {
  const host = location.hostname.replace(/^www\./, '');
  const http = (u) => (/^https?:/.test(u || '') ? u : '');
  if (host !== 'x.com' && host !== 'twitter.com') {
    const vids = [...document.querySelectorAll('video')];
    const yt = /(^|\.)youtube\.com$|^youtu\.be$/.test(host);
    const id = new URLSearchParams(location.search).get('v') || location.pathname.match(/^\/shorts\/([\w-]+)/)?.[1];
    return vids.map((v, i) => ({
      url: location.href,
      n: vids.length > 1 && !yt ? i + 1 : undefined,
      direct: http(v.currentSrc || v.src),
      title: document.title.replace(/^\(\d+\)\s*/, ''),
      thumb: v.poster || (yt && id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ''),
    }));
  }
  const out = [];
  const fromArticle = (art, url) =>
    [...art.querySelectorAll('video')].forEach((v, i) =>
      out.push({
        url,
        n: i + 1,
        title: art.querySelector('[data-testid="User-Name"]')?.innerText.split('\n')[0] || url,
        text: art.querySelector('[data-testid="tweetText"]')?.innerText || '',
        thumb: v.poster,
      }));
  const statusUrl = (art) => {
    const m = art.querySelector('a[href*="/status/"] time')?.closest('a').href.match(/^(.*\/status\/\d+)/);
    return m && m[1];
  };
  const m = location.pathname.match(/^\/([^/]+)\/status\/(\d+)(?:\/video\/(\d+))?/);
  if (m) {
    const url = `https://x.com/${m[1]}/status/${m[2]}`;
    if (m[3]) {
      // Modal de vídeo aberto: só esse vídeo. ponytail: N conta fotos também; se o post misturar fotos e vídeos o índice pode destoar.
      const v = document.querySelector('[aria-modal="true"] video') || document.querySelector('video');
      return [{ url, n: +m[3], title: `@${m[1]} · vídeo ${m[3]}`, text: '', thumb: v?.poster }];
    }
    const art = [...document.querySelectorAll('article')].find((a) => statusUrl(a)?.endsWith('/status/' + m[2]));
    if (art) fromArticle(art, url);
    return out;
  }
  document.querySelectorAll('article').forEach((art) => {
    const url = statusUrl(art);
    if (url) fromArticle(art, url);
  });
  return out;
}

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

// Monta as linhas uma vez; update() só mexe em botão, barra e texto (sem piscar a miniatura).
function build() {
  document.getElementById('count').textContent = items.length ? `${items.length} vídeo(s)` : '';
  if (!items.length) {
    list.append(el('div', { id: 'empty', textContent: 'Nenhum vídeo encontrado nesta página.' }));
    return;
  }
  for (const it of items) {
    it.ui = {
      row: el('div', { className: 'item' }),
      sub: el('span', { textContent: it.text || it.url, title: it.text || it.url }),
      fill: el('i'),
      bar: el('div', { className: 'bar' }),
      btn: el('button', {
        onclick: () =>
          it.file
            ? api.runtime.sendNativeMessage('video_downloader', { reveal: it.file })
            : api.runtime.sendMessage({ type: 'download', item: { ...it, ui: undefined } }),
      }),
    };
    const { row, sub, fill, bar, btn } = it.ui;
    bar.append(fill);
    row.append(
      el('img', { ...(it.thumb && { src: it.thumb }), onerror: (e) => e.target.removeAttribute('src') }),
      el('div', { className: 'info' }, el('b', { textContent: it.title }), sub, bar),
      btn,
    );
    list.append(row);
  }
}

function update(jobs) {
  for (const it of items) {
    const job = jobs['job:' + it.key];
    const { row, sub, fill, bar, btn } = it.ui;
    const st = job?.status;
    it.file = st === 'concluído' ? job.file : '';
    row.className = 'item ' + (st === 'concluído' ? 'ok' : st === 'erro' ? 'erro' : '');
    bar.style.display = st === 'baixando' ? 'block' : 'none';
    bar.classList.toggle('indet', st === 'baixando' && job.pct === undefined);
    fill.style.width = job?.pct === undefined ? '' : job.pct + '%';
    btn.textContent = st === 'baixando' ? (job.pct === undefined ? '…' : job.pct + '%') : st === 'concluído' ? 'Mostrar no Finder' : st === 'erro' ? 'Repetir' : 'Baixar';
    btn.disabled = st === 'baixando';
    sub.className = st === 'erro' ? 'err' : '';
    sub.textContent = st === 'erro' ? job.error.slice(-120) : st === 'concluído' ? job.file.split('/').pop() : it.text || it.url;
    sub.title = sub.textContent;
  }
}

(async () => {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  try {
    const res = await api.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: collect });
    const seen = new Set();
    items = res.flatMap((r) => r.result || []).filter((it) => {
      it.key = it.direct || it.url + '#' + (it.n ?? '');
      return !seen.has(it.key) && seen.add(it.key);
    });
  } catch {
    // página restrita (chrome://, loja de extensões...): lista vazia
  }
  build();
  const refresh = async () => update(await api.storage.session.get(null));
  refresh();
  api.storage.onChanged.addListener(refresh);
})();
