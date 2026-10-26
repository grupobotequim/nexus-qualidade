# Gera o front ONLINE da Qualidade a partir da tela local do ws-agent (public/qualidade.html):
# troca a API local pela Edge Function "qualidade", põe a tela do código de acesso, a caneta de
# marcar foto e o PDF feito no próprio celular. Saída: web/ (e copia pro site grupobotequim.github.io/qualidade).
#   python C:\dev\nexus-qualidade\online\gerar-web.py
import re, shutil, pathlib
AQUI = pathlib.Path(__file__).parent
SRC = pathlib.Path(r'C:\dev\ws-agent\public\qualidade.html')
WEB = AQUI / 'web'
SITE = pathlib.Path(r'C:\dev\grupobotequim.github.io\qualidade')
s = SRC.read_text(encoding='utf-8')

def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (c, a[:80])
    s = s.replace(a, b)

# --- API → Edge Function (sessão do código de acesso no header)
rep("""let TOK = null
async function tok() { if (!TOK) TOK = (await (await fetch('/api/painel/token')).json()).token; return TOK }
async function api(url, body) {
  const o = body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-painel-token': await tok() }, body: JSON.stringify(body) } : {}
  let r = await fetch(url, o)
  if (r.status === 401 && body !== undefined) { TOK = null; o.headers['x-painel-token'] = await tok(); r = await fetch(url, o) }
  const j = await r.json().catch(() => ({}))
  if (!r.ok || j.erro) throw new Error(j.erro || 'HTTP ' + r.status)
  return j
}""", """const FN = 'https://kuyhkltbwlkvtgbabscv.supabase.co/functions/v1/qualidade'
let SESS = LS.get('qual_sessao', '')
const rotaFn = (url) => url.replace(/^\\/api\\/qualidade/, FN).replace(/^\\/api\\/pessoas/, FN + '/pessoas')
const fotoUrl = (f) => `${FN}/foto/${encodeURIComponent(f)}?s=${SESS}`
async function api(url, body) {
  const o = { headers: { 'x-sessao': SESS } }
  if (body !== undefined) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body) }
  let r
  try { r = await fetch(rotaFn(url), o) } catch { throw new Error('sem internet — tente de novo') }
  const j = await r.json().catch(() => ({}))
  if (r.status === 401) { telaLogin(j.erro); throw new Error(j.erro || 'entre com o código de acesso') }
  if (!r.ok || j.erro) throw new Error(j.erro || 'HTTP ' + r.status)
  return j
}
// ======================================================= CÓDIGO DE ACESSO
function telaLogin(msg) {
  if ($('#login')) { $('#login-e').textContent = msg || ''; return }
  const d = document.createElement('div'); d.id = 'login'
  d.innerHTML = `<form onsubmit="entrar(event)"><h1>📋 Qualidade</h1><p>Grupo Botequim — digite o código de acesso</p>
    <input id="login-c" inputmode="numeric" autocomplete="one-time-code" maxlength="12" autofocus><button class="pri">Entrar</button><div class="e" id="login-e">${esc(msg && !/entre com/.test(msg) ? msg : '')}</div></form>`
  document.body.appendChild(d); setTimeout(() => $('#login-c') && $('#login-c').focus(), 50)
}
async function entrar(ev) {
  ev.preventDefault()
  const b = ev.target.querySelector('button'); b.disabled = true
  try {
    const r = await fetch(FN + '/entrar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: $('#login-c').value.trim() }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.sessao) throw new Error(j.erro || 'não deu certo')
    SESS = j.sessao; LS.set('qual_sessao', SESS); $('#login').remove(); iniciarApp()
  } catch (e) { $('#login-e').textContent = e.message; b.disabled = false }
}
function sair() { if (!confirm('Sair deste aparelho?')) return; LS.set('qual_sessao', ''); SESS = ''; location.reload() }""")

# --- fotos (bucket privado → URL assinada pela função)
s, n = re.subn(r"/api/qualidade/foto/\$\{([^}]+)\}", r"${fotoUrl(\1)}", s)
assert n == 4, n
# --- PDF feito no celular (página relatorio.html)
s, n = re.subn(r"window\.open\('/api/qualidade/relatorios/\$\{([^}]+)\}/pdf'\)", r"window.open('relatorio.html#${\1}')", s); assert n == 2, n
s, n = re.subn(r"location\.href='/api/qualidade/relatorios/\$\{([^}]+)\}/pdf\?baixar=1'", r"window.open('relatorio.html?baixar=1#${\1}')", s); assert n == 2, n
rep("$('#barra').innerHTML = '<div class=\"barra\"><div class=\"sub\">Finalizando e gerando o PDF…</div></div>'", "$('#barra').innerHTML = '<div class=\"barra\"><div class=\"sub\">Finalizando…</div></div>'")
# --- Pendências/ranking e histórico antigo ficam na Secretaria (não vão pra internet)
rep(", ['painel', '📌 Pendências e ranking']]", "]")
rep("window.open('/nutri?aba=hist')", "toast('relatório do app antigo — fica na Secretaria')")
rep("Os relatórios antigos do app de terceiro (lidos do grupo) estão em 📌 Pendências e ranking › Histórico.", "Os relatórios antigos do app de terceiro ficam na Secretaria (contam no comparativo).")
rep("""function telaPainel() { $('#main').innerHTML = `<div class="card" style="padding:0;overflow:hidden"><iframe src="/nutri" style="width:100%;height:calc(100vh - 150px);border:0;display:block"></iframe></div>` }""", "")
rep(", painel: telaPainel })", " })")  # 23/10: sem isso o ir() quebrava (telaPainel não existe online) e a tela ficava em "carregando…"
rep("""<h1>📋 Qualidade <small>Grupo Botequim</small></h1>""", """<h1>📋 Qualidade <small>Grupo Botequim</small><button onclick="sair()" style="margin-left:auto;background:none;border:0;color:#d5efea;font-size:13px;padding:4px">sair</button></h1>""")

# --- 🖊️ caneta: depois de tirar a foto, marca/circula com o dedo; vale a marcada, a original vai junto
rep("""    const r = await api('/api/qualidade/foto', { imagem: c.toDataURL('image/jpeg', 0.72) })
    const q = ITEM(id); q.fotos = [...(q.fotos || []), r.arquivo]; pintar(q); agendarSalvar(); toast('📷 foto anexada')""",
"""    const orig = c.toDataURL('image/jpeg', 0.8)
    input.value = ''
    const m = await caneta(orig); if (!m) return
    toast('📷 enviando a foto…')
    const r = await api('/api/qualidade/foto', m.marcou ? { imagem: m.url, original: orig } : { imagem: orig })
    const q = ITEM(id); q.fotos = [...(q.fotos || []), r.arquivo]; pintar(q); agendarSalvar(); toast(m.marcou ? '📷 foto marcada anexada' : '📷 foto anexada')""")
rep("""c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); FOTO_REC = c.toDataURL('image/jpeg', 0.72); $('#e-fok').textContent = '📷 foto ok' }""",
"""c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); input.value = ''; const orig = c.toDataURL('image/jpeg', 0.8); const m = await caneta(orig); if (!m) return; FOTO_REC = m.url; FOTO_ORIG = m.marcou ? orig : null; $('#e-fok').textContent = m.marcou ? '📷 foto marcada ok' : '📷 foto ok' }""")
rep("let FOTO_REC = null, ASSIN_TEM = false", "let FOTO_REC = null, FOTO_ORIG = null, ASSIN_TEM = false")
rep("ASSIN_TEM = false; FOTO_REC = null", "ASSIN_TEM = false; FOTO_REC = null; FOTO_ORIG = null")
rep("assinatura: ASSIN_TEM ? $('#e-assin').toDataURL('image/png') : null, foto: FOTO_REC })", "assinatura: ASSIN_TEM ? $('#e-assin').toDataURL('image/png') : null, foto: FOTO_REC, foto_original: FOTO_ORIG })")

CANETA = r"""
// ======================================================= 🖊️ CANETA (marcar a foto com o dedo)
const CORES = [['#ef1c1c', 'vermelho'], ['#facc15', 'amarelo'], ['#2563eb', 'azul']]
function caneta(dataUrl) {
  return new Promise((fim) => {
    const img = new Image()
    img.onload = () => {
      const W = img.width, H = img.height, tracos = []
      let cor = CORES[0][0], atual = null
      const d = document.createElement('div'); d.id = 'caneta'
      d.innerHTML = `<div class="ct-topo"><b>🖊️ Circule o problema</b><span class="sub" style="color:#cbd5d1">use o dedo</span></div>
        <div class="ct-area"><canvas></canvas></div>
        <div class="ct-bar"><div class="ct-cores">${CORES.map(([c, n], i) => `<button class="ct-cor ${i ? '' : 'on'}" data-c="${c}" title="${n}" style="background:${c}"></button>`).join('')}</div>
          <button data-a="desfazer">↶ Desfazer</button><button data-a="limpar">Limpar</button></div>
        <div class="ct-bar"><button data-a="cancelar">Cancelar</button><button class="pri" data-a="salvar" style="flex:1">Salvar ✓</button></div>`
      document.body.appendChild(d)
      const cv = d.querySelector('canvas'), area = d.querySelector('.ct-area')
      const esc = Math.min(area.clientWidth / W, area.clientHeight / H)
      cv.style.width = Math.round(W * esc) + 'px'; cv.style.height = Math.round(H * esc) + 'px'
      cv.width = W; cv.height = H
      const x = cv.getContext('2d'), larg = Math.max(4, Math.round(Math.max(W, H) * 0.007))
      const desenhar = (ctx) => {
        ctx.drawImage(img, 0, 0, W, H)
        for (const t of tracos) {
          ctx.strokeStyle = t.cor; ctx.lineWidth = larg; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
          ctx.beginPath(); t.p.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)))
          if (t.p.length === 1) ctx.lineTo(t.p[0][0] + 0.1, t.p[0][1])
          ctx.stroke()
        }
      }
      desenhar(x)
      const pos = (e) => { const b = cv.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * W, ((e.clientY - b.top) / b.height) * H] }
      cv.onpointerdown = (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); atual = { cor, p: [pos(e)] }; tracos.push(atual); desenhar(x) }
      cv.onpointermove = (e) => { if (!atual) return; e.preventDefault(); atual.p.push(pos(e)); desenhar(x) }
      cv.onpointerup = cv.onpointercancel = () => { atual = null }
      const sai = (v) => { d.remove(); fim(v) }
      d.querySelectorAll('.ct-cor').forEach((b) => (b.onclick = () => { cor = b.dataset.c; d.querySelectorAll('.ct-cor').forEach((z) => z.classList.toggle('on', z === b)) }))
      d.querySelector('[data-a=desfazer]').onclick = () => { tracos.pop(); desenhar(x) }
      d.querySelector('[data-a=limpar]').onclick = () => { tracos.length = 0; desenhar(x) }
      d.querySelector('[data-a=cancelar]').onclick = () => sai(null)
      d.querySelector('[data-a=salvar]').onclick = () => sai(tracos.length ? { url: cv.toDataURL('image/jpeg', 0.82), marcou: true } : { url: dataUrl, marcou: false })
    }
    img.onerror = () => fim({ url: dataUrl, marcou: false })
    img.src = dataUrl
  })
}
"""
rep("\n;(async () => {\n  try { await carregarBase() }", CANETA + "\nasync function iniciarApp() {\n  try { await carregarBase() }")
rep("""  if (m) abrir(m[1]).catch(() => ir('preencher')); else ir(ABA)
})()""", """  if (m) abrir(m[1]).catch(() => ir('preencher')); else ir(ABA)
}
if (!SESS) telaLogin(); else iniciarApp()""")

CSS = """
#login{position:fixed;inset:0;z-index:40;background:#0f766e;display:grid;place-items:center}
#login form{background:#fff;border-radius:18px;padding:26px 22px;width:min(340px,90vw);text-align:center}
#login h1{font-size:20px;margin:0 0 4px}#login p{color:#5b6b64;font-size:14px;margin:0 0 16px}
#login input{font-size:26px;letter-spacing:.3em;text-align:center;padding:12px;border:2px solid #dfe5e2;border-radius:12px}
#login button{margin-top:14px;width:100%;padding:14px}#login .e{color:#dc2626;font-size:14px;margin-top:10px;min-height:18px}
#caneta{position:fixed;inset:0;z-index:30;background:#0b1210;display:flex;flex-direction:column;padding:10px 10px calc(10px + env(safe-area-inset-bottom));gap:8px;color:#fff}
#caneta .ct-topo{display:flex;justify-content:space-between;align-items:center;padding:2px 4px}
#caneta .ct-area{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
#caneta canvas{touch-action:none;border-radius:8px;background:#000;max-width:100%;max-height:100%}
#caneta .ct-bar{display:flex;gap:8px;align-items:center}#caneta .ct-bar button{flex:1;padding:12px}
#caneta .ct-cores{display:flex;gap:8px;margin-right:4px}#caneta .ct-cor{width:38px;height:38px;flex:0 0 38px;border-radius:50%;padding:0;border:3px solid #0b1210;box-shadow:0 0 0 2px #556}
#caneta .ct-cor.on{box-shadow:0 0 0 3px #fff}
"""
rep("</style>\n</head>", CSS + "</style>\n</head>")
assert '/api/' not in re.sub(r"rotaFn = \(url\) => url\.replace\([^\n]*", '', s).replace("api('/api/", '').replace("api(`/api/", ''), 'sobrou rota local'

WEB.mkdir(exist_ok=True)
(WEB / 'index.html').write_text(s, encoding='utf-8', newline='\n')
SITE.mkdir(exist_ok=True)
for f in WEB.iterdir():
    if f.is_file(): shutil.copy(f, SITE / f.name)
print('ok', len(s), 'bytes →', SITE)

# --- relatorio.html: mesma página do PDF local, mas lendo da função e gerando o PDF no próprio aparelho
r = pathlib.Path(r'C:\dev\ws-agent\public\qualidade-relatorio.html').read_text(encoding='utf-8')
def rr(a, b):
    global r
    assert r.count(a) == 1, a[:80]
    r = r.replace(a, b)
rr('<div class="acoes" id="acoes"><button onclick="print()">🖨️ Imprimir / salvar PDF</button></div>',
   '<div class="acoes" id="acoes"><button id="b-pdf" onclick="baixarPdf()" disabled>⬇️ Baixar PDF</button><button onclick="print()">🖨️ Imprimir</button></div>')
rr("if (/pdf=1/.test(location.search)) document.getElementById('acoes').remove()", """const FN = 'https://kuyhkltbwlkvtgbabscv.supabase.co/functions/v1/qualidade'
let SESS = ''; try { SESS = localStorage.getItem('qual_sessao') || '' } catch {}
let NOME_PDF = 'relatorio.pdf'
async function baixarPdf() {
  const b = document.getElementById('b-pdf'); b.disabled = true; b.textContent = 'gerando…'
  try {
    await html2pdf().set({ margin: [10, 8, 10, 8], filename: NOME_PDF, image: { type: 'jpeg', quality: 0.9 }, html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['.nc', 'tr', '.topo', '.info'] } }).from(document.getElementById('pag')).save()
  } catch (e) { alert('não gerou o PDF: ' + e.message) }
  b.disabled = false; b.textContent = '⬇️ Baixar PDF'
}""")
rr("const cod = decodeURIComponent(location.pathname.split('/').pop())\n  const r = await (await fetch('/api/qualidade/relatorios/' + encodeURIComponent(cod))).json()",
   "const cod = decodeURIComponent(location.hash.slice(1))\n  if (!SESS) { document.getElementById('pag').innerHTML = 'Entre primeiro no app: <a href=\"./\">Qualidade</a>'; return }\n  const r = await (await fetch(FN + '/relatorios/' + encodeURIComponent(cod), { headers: { 'x-sessao': SESS } })).json()")
rr("const foto = (f) => `<img src=\"/api/qualidade/foto/${f}\">`", "const foto = (f) => `<img crossorigin=\"anonymous\" src=\"${FN}/foto/${encodeURIComponent(f)}?s=${SESS}\">`")
rr("document.title = `Relatório ${r.modelo_nome} — ${r.casa?.nome || ''} — ${br(r.data)}`",
   "const TIT = /^relat[óo]rio/i.test(r.modelo_nome || '') ? r.modelo_nome : `Relatório ${r.modelo_nome}` // 26/10: sem 'Relatório Relatório estrutural'\n  document.title = `${TIT} — ${r.casa?.nome || ''} — ${br(r.data)}`\n  NOME_PDF = `${TIT} -${r.casa ? r.casa.nome : r.casa_id} - ${r.data.split('-').reverse().join('-')}${r.demo ? ' (DEMO)' : ''}.pdf`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w .()-]/g, '')")
rr("  document.body.dataset.pronto = '1'", "  document.body.dataset.pronto = '1'\n  document.getElementById('b-pdf').disabled = false\n  if (/baixar=1/.test(location.search)) baixarPdf()")
rr("</style>", "@media(max-width:640px){.info{grid-template-columns:1fr 1fr}.acoes{position:static;justify-content:flex-end;padding:8px}}\n</style>\n<script src=\"https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js\"></script>")
assert '/api/' not in r
(WEB / 'relatorio.html').write_text(r, encoding='utf-8', newline='\n')
shutil.copy(WEB / 'relatorio.html', SITE / 'relatorio.html')
print('ok relatorio.html')
