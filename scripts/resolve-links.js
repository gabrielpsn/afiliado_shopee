// Resolve links curtos de afiliado da Shopee para a URL real do produto.
// Ferramenta de desenvolvimento: serve para descobrir shopid/itemid e para
// verificar se um link continua vivo antes de publicar.
//
// Não extrai nome, preço nem imagem. A Shopee bloqueia leitura automatizada
// dessas páginas (captcha no HTML e 403 na API pública), então o preenchimento
// do catálogo é manual.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DELAY_MS = 1200;

export function parseShopeeUrl(url) {
  const match = url.match(/shopee\.com\.br\/([^/?#]+)\/(\d+)\/(\d+)/);
  if (!match) return null;
  return { shopName: match[1], shopId: match[2], itemId: match[3] };
}

export async function resolveLink(shortUrl, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(shortUrl, {
      redirect: 'manual',
      headers: { 'User-Agent': UA },
    });

    const location = res.headers.get('location');
    if (!location) {
      return { ok: false, motivo: `sem redirect (HTTP ${res.status})` };
    }

    const parsed = parseShopeeUrl(location);
    if (!parsed) {
      return { ok: false, motivo: 'redirect fora do formato esperado' };
    }

    // URL pública e estável, sem os parâmetros de rastreio do painel de afiliados.
    const limpa = `https://shopee.com.br/${parsed.shopName}/${parsed.shopId}/${parsed.itemId}`;

    return { ok: true, ...parsed, urlPublica: limpa };
  } catch (erro) {
    return { ok: false, motivo: erro.message };
  }
}

export function toCsvRow(entrada) {
  const base = entrada.link.replace('https://s.shopee.com.br/', '');
  if (!entrada.ok) return `${base},ERRO,"${entrada.motivo}",,`;
  return `${base},OK,${entrada.itemId},${entrada.shopId},${entrada.shopName},${entrada.urlPublica}`;
}

export const CSV_HEADER =
  'linkCurto,status,itemId,shopId,loja,urlPublica';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Executado apenas quando chamado direto (node scripts/resolve-links.js),
// nunca em import, para os testes não dispararem rede.
if (process.argv[1] && process.argv[1].endsWith('resolve-links.js')) {
  const entrada = await import('node:fs/promises');
  const raw = await entrada.readFile(new URL('../data/links.txt', import.meta.url), 'utf8');
  const links = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  console.log(`${links.length} links para resolver\n`);
  const linhas = [CSV_HEADER];

  for (const [i, link] of links.entries()) {
    const r = await resolveLink(link);
    linhas.push(toCsvRow({ link, ...r }));
    const marca = r.ok ? `item ${r.itemId} @ ${r.shopName}` : `ERRO ${r.motivo}`;
    console.log(`[${String(i + 1).padStart(2)}/${links.length}] ${marca}`);
    await sleep(DELAY_MS);
  }

  const destino = new URL('../data/links-resolvidos.csv', import.meta.url);
  await entrada.writeFile(destino, linhas.join('\n') + '\n', 'utf8');

  const ok = linhas.length - 1;
  console.log(`\n${ok}/${links.length} resolvidos -> data/links-resolvidos.csv`);
}
