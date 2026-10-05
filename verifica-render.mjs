// Verificação manual do build: sobe dist/ e confere o que o navegador mostra.
// Não é teste de regressão — é a checagem de que o bundle realmente renderiza o
// catálogo. Rodar: `npm run build && node verifica-render.mjs`

import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const RAIZ = process.cwd()
const PORTA = 4199
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain',
}

const server = createServer(async (req, res) => {
  const url = req.url.split('?')[0]
  const file = join(RAIZ, 'dist', url === '/' ? 'index.html' : url)

  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('nao encontrado')
  }
})

await new Promise((r) => server.listen(PORTA, r))

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

const erros = []
page.on('pageerror', (e) => erros.push(e.message))
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()))

await page.goto(`http://localhost:${PORTA}/`, { waitUntil: 'networkidle' })

const contagens = await page.locator('dd').allTextContents()
const aviso = await page.locator('[data-testid="affiliate-notice"]').innerText()
const h1 = await page.locator('h1').innerText()

const alvosPequenos = await page.evaluate(() =>
  [...document.querySelectorAll('a,button')]
    .filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.height < 44
    })
    .map((el) => `${el.tagName}.${el.className || '(sem classe)'} ${el.getBoundingClientRect().height}px`)
)

console.log('h1:', h1)
console.log('contagens (catálogo | publicados | pendentes):', contagens.join(' | '))
console.log('aviso de afiliado:', aviso.replace(/\s+/g, ' ').slice(0, 80))
console.log('alvos de toque < 44px:', alvosPequenos.length ? alvosPequenos : 'nenhum')
console.log('erros de console:', erros.length ? erros : 'nenhum')

await browser.close()
server.close()
