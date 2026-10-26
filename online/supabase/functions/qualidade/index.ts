// 📋 23/10/2026 — Qualidade ONLINE do Grupo Botequim (checklist da Kátia + Uniforme/EPI).
// Front: https://grupobotequim.github.io/qualidade/  →  esta função  →  tabelas qualidade_* (RLS ligado,
// sem grant pra anon) + bucket PRIVADO qualidade-privado (foto só por URL assinada).
// Porta de entrada: CÓDIGO DE ACESSO (na nuvem só o hash) → sessão de 30 dias. 5 erros = trava 15 min.
// O ws-agent do Lucas puxa daqui (qualidade-nuvem.js) pro banco local → ranking/pendências da Secretaria.
// 🔒 NÃO ENVIA NADA (nem e-mail, nem WhatsApp): só prepara o texto do e-mail.
const U = Deno.env.get('SUPABASE_URL')!
const K = Deno.env.get('PRESENCA_SB_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'qualidade-privado'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-sessao',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } })
class Erro extends Error { constructor(m: string, public st = 400) { super(m) } }

async function rest(caminho: string, init: RequestInit = {}) {
  const r = await fetch(`${U}/rest/v1/${caminho}`, { ...init, headers: { apikey: K, Authorization: `Bearer ${K}`, 'content-type': 'application/json', ...(init.headers || {}) } })
  const t = await r.text()
  if (!r.ok) throw new Error(`db ${r.status}: ${t.slice(0, 200)}`)
  return t ? JSON.parse(t) : null
}
const ins = (tab: string, body: unknown, extra = '') => rest(`${tab}${extra}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) })
const upd = (filtro: string, body: unknown) => rest(filtro, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) })
const del = (filtro: string) => rest(filtro, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
const upsert = (tab: string, body: unknown[]) => body.length ? rest(`${tab}?on_conflict=id`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) }) : null
const enc = encodeURIComponent

async function sha256(s: string) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
}
function iguais(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
const aleat = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('')

// ---------------------------------------------------------------- datas / nota (igual ao qualidade.js local)
const FATOR: Record<string, number> = { verde: 1, amarela: 0.5, vermelha: 0 }
const DIA = 86400e3
const diaBR = (ts: number) => new Date(ts - 3 * 3600e3).toISOString().slice(0, 10)
const hojeISO = () => diaBR(Date.now())
const addDias = (iso: string, n: number) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DIA).toISOString().slice(0, 10)
const segunda = (iso: string) => { const d = new Date(iso + 'T12:00:00Z'); return addDias(iso, -((d.getUTCDay() + 6) % 7)) }
const r2 = (n: number) => Math.round(n * 100) / 100
const txt = (s: unknown, n = 500) => (s == null ? null : String(s).slice(0, n))
const dataOk = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
const codOk = (s: string) => { if (!/^[\w-]{3,40}$/.test(s)) throw new Erro('código inválido'); return s }
type Resp = { resposta: string | null; peso: number; [k: string]: unknown }
function calcular(resps: Resp[]) {
  let pts = 0, tot = 0
  const n: Record<string, number> = { verde: 0, amarela: 0, vermelha: 0, na: 0, sem: 0 }
  for (const r of resps) {
    if (r.resposta === 'na') { n.na++; continue }
    if (!r.resposta || !(r.resposta in FATOR)) { n.sem++; continue }
    n[r.resposta]++; pts += (r.peso || 1) * FATOR[r.resposta]; tot += r.peso || 1
  }
  return { nota: tot ? r2((pts / tot) * 100) : null, pontos: r2(pts), peso_total: r2(tot), ...n }
}

// ---------------------------------------------------------------- acesso
function ipDe(req: Request) { return (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'sem-ip').split(',')[0].trim().slice(0, 60) }
async function falha(chave: string, limite: number, janelaMs: number) {
  const r = (await rest(`qualidade_tentativas?ip=eq.${enc(chave)}&select=*`))?.[0]
  const velho = !r || Date.now() - Date.parse(r.atualizado_em) > janelaMs
  let n = (velho ? 0 : r.n) + 1, bloq = null as string | null
  if (n >= limite) { bloq = new Date(Date.now() + 15 * 60e3).toISOString(); n = 0 }
  await rest('qualidade_tentativas', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ ip: chave, n, bloqueado_ate: bloq ?? (velho ? null : r.bloqueado_ate), atualizado_em: new Date().toISOString() }) })
}
async function bloqueado(chave: string) {
  const r = (await rest(`qualidade_tentativas?ip=eq.${enc(chave)}&select=bloqueado_ate`))?.[0]
  return r?.bloqueado_ate && Date.parse(r.bloqueado_ate) > Date.now()
}
async function entrar(req: Request, b: Record<string, unknown>) {
  const ip = ipDe(req)
  if ((await bloqueado('ip:' + ip)) || (await bloqueado('geral'))) throw new Erro('Muitas tentativas erradas — espere 15 minutos.', 429)
  const cod = String(b.codigo || '').trim()
  const cfg = (await rest('qualidade_config?chave=eq.codigo_hash&select=valor'))?.[0]
  if (!cfg || !/^\d{4,12}$/.test(cod) || !iguais(await sha256('qualidade:' + cod), cfg.valor)) {
    await falha('ip:' + ip, 5, 60 * 60e3)
    await falha('geral', 30, 60 * 60e3) // trava geral contra quem troca de IP
    throw new Erro('Código errado.', 401)
  }
  await del(`qualidade_tentativas?ip=eq.${enc('ip:' + ip)}`)
  const s = aleat(24)
  await ins('qualidade_sessoes', { token_hash: await sha256(s), expira_em: new Date(Date.now() + 30 * DIA).toISOString() })
  await del(`qualidade_sessoes?expira_em=lt.${new Date().toISOString()}`).catch(() => {})
  return { ok: true, sessao: s }
}
const sessOk = new Map<string, number>()
async function exigeSessao(s: string | null) {
  if (!s || !/^[a-f0-9]{48}$/.test(s)) throw new Erro('entre com o código de acesso', 401)
  const h = await sha256(s)
  if ((sessOk.get(h) || 0) > Date.now()) return
  const r = (await rest(`qualidade_sessoes?token_hash=eq.${h}&select=expira_em`))?.[0]
  if (!r || Date.parse(r.expira_em) < Date.now()) throw new Erro('sessão expirada — entre de novo com o código', 401)
  sessOk.set(h, Date.now() + 60e3)
}

// ---------------------------------------------------------------- fotos (bucket privado)
async function subirImagem(dataUrl: unknown, nome: string) {
  const m = String(dataUrl || '').match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/)
  if (!m) throw new Erro('imagem inválida')
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))
  if (bin.length > 4 * 1024 * 1024) throw new Erro('imagem grande demais')
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  const arq = `${nome}.${ext}`
  const r = await fetch(`${U}/storage/v1/object/${BUCKET}/fotos/${arq}`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'content-type': ext === 'jpg' ? 'image/jpeg' : 'image/' + ext, 'x-upsert': 'true' }, body: bin })
  if (!r.ok) throw new Error('storage ' + r.status + ': ' + (await r.text()).slice(0, 150))
  return arq
}
const urlCache = new Map<string, { u: string; ate: number }>()
async function urlAssinada(arq: string) {
  if (!/^[\w.-]+$/.test(arq)) throw new Erro('arquivo inválido', 404)
  const c = urlCache.get(arq)
  if (c && c.ate > Date.now()) return c.u
  const r = await fetch(`${U}/storage/v1/object/sign/${BUCKET}/fotos/${arq}`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) })
  if (!r.ok) throw new Erro('foto não encontrada', 404)
  const j = await r.json()
  const u = `${U}/storage/v1${j.signedURL || j.signedUrl}`
  urlCache.set(arq, { u, ate: Date.now() + 50 * 60e3 })
  return u
}
async function apagarFotos(arqs: string[]) {
  const ps = arqs.filter((a) => a && /^[\w.-]+$/.test(a)).flatMap((a) => ['fotos/' + a, ...['jpg', 'png', 'webp'].map((e) => 'fotos/' + a.replace(/\.\w+$/, '') + '-orig.' + e)])
  if (!ps.length) return
  await fetch(`${U}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { apikey: K, Authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: ps }) }).catch(() => {})
}

// ---------------------------------------------------------------- relatório
async function relatorio(codigo: string) {
  const r = (await rest(`qualidade_relatorios?codigo=eq.${enc(codigo)}&select=*`))?.[0]
  if (!r) return null
  const resp = (await rest(`qualidade_respostas?codigo=eq.${enc(codigo)}&select=*&order=ordem,id`)) as Resp[]
  const casa = (await rest(`qualidade_casas?id=eq.${enc(r.casa_id)}&select=*`))?.[0] || null
  const areas: { area: string; itens: Resp[]; [k: string]: unknown }[] = []
  for (const x of resp) {
    let a = areas.find((y) => y.area === x.area)
    if (!a) areas.push((a = { area: x.area as string, itens: [] }))
    a.itens.push(x)
  }
  for (const a of areas) Object.assign(a, calcular(a.itens))
  return { ...r, casa, areas, calc: calcular(resp), ncs: resp.filter((x) => x.resposta === 'amarela' || x.resposta === 'vermelha') }
}
const agora = () => Date.now()

// ---------------------------------------------------------------- comparativo da semana
async function comparativo(semIni?: string | null) {
  const ini = segunda(dataOk(semIni) ? semIni! : hojeISO()), fim = addDias(ini, 6)
  const antIni = addDias(ini, -7), antFim = addDias(ini, -1)
  const casas = await rest('qualidade_casas?ativo=eq.1&select=id,nome,apelido,tipo&order=ordem')
  const hist = (await rest(`qualidade_historico?data=gte.${antIni}&data=lte.${fim}&nota=not.is.null&select=codigo,casa_id,data,nota,fonte,ts`))
    .map((r: Record<string, unknown>) => ({ ...r, modelo: 'Rotina', demo: 0 }))
  const nossos = (await rest(`qualidade_relatorios?status=eq.finalizado&nota=not.is.null&data=gte.${antIni}&data=lte.${fim}&select=codigo,casa_id,data,nota,finalizado_em,modelo_nome,demo`))
    .map((r: Record<string, unknown>) => ({ codigo: r.codigo, casa_id: r.casa_id, data: r.data, nota: r.nota, fonte: 'sistema', ts: r.finalizado_em, modelo: r.modelo_nome, demo: r.demo ? 1 : 0 }))
  type Lin = { codigo: string; casa_id: string; data: string; nota: number; fonte: string; modelo: string; demo: number }
  const todos = [...hist, ...nossos] as Lin[]
  const familia = (m: string) => (/^geral/i.test(m || '') ? 'Geral' : /estrutur/i.test(m || '') ? 'Estrutural' : 'Rotina')
  const modelos = [...new Set(todos.map((r) => familia(r.modelo)))].sort((a, b) => (a === 'Rotina' ? -1 : b === 'Rotina' ? 1 : a.localeCompare(b)))
  const media = (arr: Lin[]) => (arr.length ? r2(arr.reduce((s, x) => s + x.nota, 0) / arr.length) : null)
  const dlt = (a: number | null, b: number | null) => (a != null && b != null ? r2(a - b) : null)
  // deno-lint-ignore no-explicit-any
  const linhas = casas.map((c: any) => {
    const cel: Record<string, unknown> = {}
    for (const m of modelos) {
      const doM = todos.filter((r) => r.casa_id === c.id && familia(r.modelo) === m)
      const sem = doM.filter((r) => r.data >= ini), ant = doM.filter((r) => r.data < ini)
      cel[m] = { nota: media(sem), n: sem.length, anterior: media(ant), delta: dlt(media(sem), media(ant)),
        relatorios: sem.sort((a, b) => a.data.localeCompare(b.data)).map((r) => ({ codigo: r.codigo, data: r.data, nota: r.nota, demo: r.demo, fonte: r.fonte })) }
    }
    const daCasa = todos.filter((r) => r.casa_id === c.id), base = daCasa.some((r) => !r.demo) ? daCasa.filter((r) => !r.demo) : daCasa
    const sem = base.filter((r) => r.data >= ini), ant = base.filter((r) => r.data < ini)
    return { ...c, cel, geral: { nota: media(sem), anterior: media(ant), delta: dlt(media(sem), media(ant)), n: sem.length } }
  })
  // deno-lint-ignore no-explicit-any
  const ord = linhas.filter((l: any) => l.geral.nota != null).sort((a: any, b: any) => b.geral.nota - a.geral.nota)
  // deno-lint-ignore no-explicit-any
  ord.forEach((l: any, i: number) => (l.pos = i + 1))
  const cods = todos.filter((r) => r.data >= ini)
  const codH = cods.filter((r) => r.fonte !== 'sistema').map((r) => r.codigo), codQ = cods.filter((r) => r.fonte === 'sistema').map((r) => r.codigo)
  const lista = (a: string[]) => a.map((c) => `"${c.replace(/"/g, '')}"`).join(',')
  const itens = [
    ...(codH.length ? await rest(`qualidade_historico_itens?codigo=in.(${enc(lista(codH))})&nota=lt.5&select=codigo,area,pergunta,nota,comentario`) : [])
      .map((x: Record<string, unknown>) => ({ ...x, grav: (x.nota as number) <= 2 ? 'vermelha' : 'amarela' })),
    ...(codQ.length ? await rest(`qualidade_respostas?codigo=in.(${enc(lista(codQ))})&resposta=in.(amarela,vermelha)&select=codigo,area,pergunta,resposta,comentario`) : [])
      .map((x: Record<string, unknown>) => ({ ...x, grav: x.resposta })),
  ]
  const casaDoCod = Object.fromEntries(cods.map((r) => [r.codigo, r.casa_id]))
  const ag: Record<string, { area: string; pergunta: string; vezes: number; vermelhas: number; casas: Record<string, number> }> = {}
  for (const x of itens) {
    const k = x.area + '::' + x.pergunta
    const a = (ag[k] = ag[k] || { area: x.area, pergunta: x.pergunta, vezes: 0, vermelhas: 0, casas: {} })
    a.vezes++; if (x.grav === 'vermelha') a.vermelhas++
    const cid = casaDoCod[x.codigo]; a.casas[cid] = (a.casas[cid] || 0) + 1
  }
  const piores = Object.values(ag).sort((a, b) => b.vezes - a.vezes || b.vermelhas - a.vermelhas).slice(0, 12)
  // deno-lint-ignore no-explicit-any
  const porCasa = Object.fromEntries(casas.map((c: any) => [c.id, Object.values(ag).filter((a) => a.casas[c.id]).sort((a, b) => b.casas[c.id] - a.casas[c.id]).slice(0, 3).map((a) => a.pergunta)]))
  // reincidências de cada casa: pergunta que saiu 🟡/🔴 nesta semana e já tinha saído antes (últimas 4 semanas)
  const r4Ini = addDias(ini, -21)
  // deno-lint-ignore no-explicit-any
  type X = Record<string, any>
  const h4 = (await rest(`qualidade_historico?data=gte.${r4Ini}&data=lte.${fim}&nota=not.is.null&select=codigo,casa_id,data`)).map((r: X) => ({ ...r, fonte: 'hist' }))
  const q4 = (await rest(`qualidade_relatorios?status=eq.finalizado&nota=not.is.null&data=gte.${r4Ini}&data=lte.${fim}&select=codigo,casa_id,data,demo`)).map((r: X) => ({ ...r, fonte: 'sistema' }))
  const t4 = [...h4, ...q4] as X[]
  const c4H = t4.filter((r) => r.fonte !== 'sistema').map((r) => r.codigo as string), c4Q = t4.filter((r) => r.fonte === 'sistema').map((r) => r.codigo as string)
  const it4: X[] = [
    ...(c4H.length ? await rest(`qualidade_historico_itens?codigo=in.(${enc(lista(c4H))})&nota=lt.5&select=codigo,area,pergunta,nota`) : []).map((x: X) => ({ ...x, grav: x.nota <= 2 ? 'vermelha' : 'amarela' })),
    ...(c4Q.length ? await rest(`qualidade_respostas?codigo=in.(${enc(lista(c4Q))})&resposta=in.(amarela,vermelha)&select=codigo,area,pergunta,resposta`) : []).map((x: X) => ({ ...x, grav: x.resposta })),
  ]
  const info4 = Object.fromEntries(t4.map((r) => [r.codigo, r]))
  const rc: Record<string, Record<string, { area: string; pergunta: string; vezes: number; vermelhas: number; semana: number; datas: string[] }>> = {}
  for (const x of it4) {
    const r = info4[x.codigo]; if (!r) continue
    const cid = r.casa_id as string, k = x.area + '::' + x.pergunta
    const m = (rc[cid] = rc[cid] || {})
    const a = (m[k] = m[k] || { area: x.area, pergunta: x.pergunta, vezes: 0, vermelhas: 0, semana: 0, datas: [] })
    a.vezes++; if (x.grav === 'vermelha') a.vermelhas++
    if (r.data >= ini) a.semana++
    a.datas.push(r.data)
  }
  // deno-lint-ignore no-explicit-any
  const reincidencias = Object.fromEntries(casas.map((c: any) => [c.id, Object.values(rc[c.id] || {}).filter((a) => a.semana > 0 && a.vezes > 1)
    .map((a) => ({ ...a, datas: [...new Set(a.datas)].sort() })).sort((a, b) => b.vezes - a.vezes || b.vermelhas - a.vermelhas).slice(0, 8)]))
  return { semana: { de: ini, ate: fim }, anterior: { de: antIni, ate: antFim }, modelos, linhas, piores, piores_por_casa: porCasa, reincidencias, reinc_desde: r4Ini, tem_demo: nossos.some((d: Lin) => d.demo && d.data >= ini) }
}

// ---------------------------------------------------------------- EPI
// deno-lint-ignore no-explicit-any
function situacaoEpi(e: any, hoje: string) {
  if (e.status !== 'ativo') return e.status
  if (e.troca_em && e.troca_em < hoje) return 'vencida'
  if (e.ca_validade && e.ca_validade < hoje) return 'ca_vencido'
  if (e.troca_em && e.troca_em <= addDias(hoje, 15)) return 'vence_logo'
  return 'ok'
}

// ---------------------------------------------------------------- rotas
// deno-lint-ignore no-explicit-any
type B = Record<string, any>
async function rota(req: Request, metodo: string, p: string[], q: URLSearchParams, b: B): Promise<unknown> {
  const [a, x, y] = p
  const G = metodo === 'GET', P = metodo === 'POST'

  // casas
  if (a === 'casas' && !x && G) return rest('qualidade_casas?select=*&order=ativo.desc,ordem')
  if (a === 'casas' && !x && P) {
    if (b.id) {
      const atual = (await rest(`qualidade_casas?id=eq.${enc(b.id)}&select=id`))?.[0]
      if (atual) {
        const m: B = { email: txt(b.email, 300) || null, atualizado_em: agora() }
        if (b.nome != null) m.nome = txt(b.nome, 60)
        if (b.apelido != null) m.apelido = txt(b.apelido, 60)
        if (b.responsavel != null) m.responsavel = txt(b.responsavel, 80)
        if (b.tipo) m.tipo = b.tipo === 'cd' ? 'cd' : 'loja'
        if (b.ativo != null) m.ativo = b.ativo ? 1 : 0
        await upd(`qualidade_casas?id=eq.${enc(b.id)}`, m)
        return { ok: true, id: b.id }
      }
    }
    if (!b.nome) throw new Erro('nome do restaurante é obrigatório')
    const id = String(b.nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
    if (!id) throw new Erro('nome inválido')
    if ((await rest(`qualidade_casas?id=eq.${enc(id)}&select=id`))?.length) throw new Erro('já existe uma casa com esse nome')
    const mx = (await rest('qualidade_casas?select=ordem&order=ordem.desc.nullslast&limit=1'))?.[0]?.ordem || 0
    await ins('qualidade_casas', { id, nome: txt(b.nome, 60), apelido: txt(b.apelido, 60), tipo: b.tipo === 'cd' ? 'cd' : 'loja', ordem: mx + 1, responsavel: txt(b.responsavel, 80), email: txt(b.email, 300), ativo: 1, atualizado_em: agora() })
    return { ok: true, id }
  }

  // modelos
  if (a === 'modelos' && !x && G) {
    const ms = await rest('qualidade_modelos?ativo=eq.1&select=*&order=id')
    const ps = await rest('qualidade_perguntas?ativo=eq.1&select=modelo_id,peso&limit=20000')
    // deno-lint-ignore no-explicit-any
    return ms.map((m: any) => { const d = ps.filter((p: B) => p.modelo_id === m.id); return { ...m, n_perguntas: d.length, soma_pesos: r2(d.reduce((s: number, p: B) => s + (p.peso || 0), 0)) } })
  }
  if (a === 'modelos' && x && G) {
    const m = (await rest(`qualidade_modelos?id=eq.${+x}&select=*`))?.[0]
    if (!m) throw new Erro('modelo não existe')
    return { ...m, perguntas: await rest(`qualidade_perguntas?modelo_id=eq.${m.id}&ativo=eq.1&select=*&order=ordem,id`) }
  }
  if (a === 'modelos' && !x && P) {
    if (!b.nome) throw new Erro('dê um nome ao modelo')
    const m = (await ins('qualidade_modelos', { nome: txt(b.nome, 80), tipo: txt(b.tipo, 20) || 'rotina', para: ['loja', 'cd'].includes(b.para) ? b.para : 'todas', descricao: txt(b.descricao, 300), ativo: 1, criado_em: agora() }))[0]
    if (b.copiar_de) {
      const ps = await rest(`qualidade_perguntas?modelo_id=eq.${+b.copiar_de}&ativo=eq.1&select=area,ordem,pergunta,peso&order=ordem,id`)
      if (ps.length) await ins('qualidade_perguntas', ps.map((p: B) => ({ ...p, modelo_id: m.id, ativo: 1 })))
    }
    return { ok: true, id: m.id }
  }
  if (a === 'modelos' && x && P) {
    const id = +x
    if (!(await rest(`qualidade_modelos?id=eq.${id}&select=id`))?.length) throw new Erro('modelo não existe')
    if (b.apagar) { await upd(`qualidade_modelos?id=eq.${id}`, { ativo: 0 }); return { ok: true } }
    const m: B = {}
    if (b.nome != null) m.nome = txt(b.nome, 80)
    if (b.descricao != null) m.descricao = txt(b.descricao, 300)
    if (['loja', 'cd', 'todas'].includes(b.para)) m.para = b.para
    if (Object.keys(m).length) await upd(`qualidade_modelos?id=eq.${id}`, m)
    if (Array.isArray(b.perguntas)) {
      const meus = new Set((await rest(`qualidade_perguntas?modelo_id=eq.${id}&select=id`)).map((r: B) => r.id))
      const velhas: B[] = [], novas: B[] = []
      b.perguntas.forEach((p: B, i: number) => {
        if (!String(p.pergunta || '').trim()) return
        const linha = { modelo_id: id, area: txt(p.area, 80) || 'Geral', ordem: i + 1, pergunta: txt(p.pergunta), peso: Math.max(0, Math.min(10, +p.peso || 1)), ativo: 1 }
        if (p.id && meus.has(+p.id)) velhas.push({ id: +p.id, ...linha }); else novas.push(linha)
      })
      await upsert('qualidade_perguntas', velhas)
      const vivos = velhas.map((v) => v.id)
      // quem saiu da lista é arquivado (relatórios antigos guardam a cópia da pergunta)
      await upd(`qualidade_perguntas?modelo_id=eq.${id}&ativo=eq.1${vivos.length ? `&id=not.in.(${vivos.join(',')})` : ''}`, { ativo: 0 })
      if (novas.length) await ins('qualidade_perguntas', novas)
    }
    return { ok: true }
  }

  // relatórios
  if (a === 'relatorios' && !x && G) {
    let f = 'qualidade_relatorios?select=codigo,casa_id,modelo_id,modelo_nome,data,nutri,status,nota,n_verde,n_amarela,n_vermelha,n_na,n_sem,demo,criado_em,finalizado_em&limit=1000'
    if (q.get('casa')) f += `&casa_id=eq.${enc(q.get('casa')!)}`
    if (q.get('status')) f += `&status=eq.${enc(q.get('status')!)}`
    const rs = await rest(f)
    return rs.sort((m: B, n: B) => (n.finalizado_em || n.criado_em || 0) - (m.finalizado_em || m.criado_em || 0)).slice(0, 300).map((r: B) => ({ ...r, espelhado: 0, tem_pdf: 0 }))
  }
  if (a === 'relatorios' && x && !y && G) { const r = await relatorio(codOk(x)); if (!r) throw new Erro('relatório não existe', 404); return r }
  if (a === 'relatorios' && !x && P) {
    const casa = (await rest(`qualidade_casas?id=eq.${enc(String(b.casa_id || ''))}&select=*`))?.[0]
    const m = (await rest(`qualidade_modelos?id=eq.${+b.modelo_id || 0}&ativo=eq.1&select=*`))?.[0]
    if (!casa || !m) throw new Erro('escolha o restaurante e o relatório')
    const codigo = (b.demo ? 'demo-' : 'qual-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    await ins('qualidade_relatorios', { codigo, casa_id: casa.id, modelo_id: m.id, modelo_nome: m.nome, data: dataOk(b.data) ? b.data : hojeISO(), nutri: txt(b.nutri, 60) || 'Nutri', acompanhou: txt(b.acompanhou, 80), status: 'rascunho', demo: b.demo ? 1 : 0, criado_em: agora(), atualizado_em: agora() })
    const ps = await rest(`qualidade_perguntas?modelo_id=eq.${m.id}&ativo=eq.1&select=*&order=ordem,id`)
    try { if (ps.length) await ins('qualidade_respostas', ps.map((p: B) => ({ codigo, pergunta_id: p.id, area: p.area, ordem: p.ordem, pergunta: p.pergunta, peso: p.peso, resposta: null, fotos: [] }))) }
    catch (e) { await del(`qualidade_relatorios?codigo=eq.${codigo}`); throw e }
    return { ok: true, codigo }
  }
  if (a === 'relatorios' && x && P) {
    const codigo = codOk(x)
    const r = (await rest(`qualidade_relatorios?codigo=eq.${enc(codigo)}&select=*`))?.[0]
    if (!r) throw new Erro('relatório não existe', 404)
    if (y === 'salvar') {
      if (r.status === 'finalizado' && !b.reabrir) throw new Erro('relatório já finalizado — use "reabrir" para editar')
      const m: B = { atualizado_em: agora() }
      if (b.nutri != null) m.nutri = txt(b.nutri, 60)
      if (b.acompanhou != null) m.acompanhou = txt(b.acompanhou, 80)
      if (b.obs != null) m.obs = txt(b.obs, 2000)
      if (dataOk(b.data)) m.data = b.data
      const meus = new Set((await rest(`qualidade_respostas?codigo=eq.${enc(codigo)}&select=id`)).map((z: B) => z.id))
      const linhas = (Array.isArray(b.respostas) ? b.respostas : []).filter((z: B) => meus.has(+z.id)).map((z: B) => ({
        id: +z.id, codigo, resposta: ['verde', 'amarela', 'vermelha', 'na'].includes(z.resposta) ? z.resposta : null, comentario: txt(z.comentario, 1000),
        fotos: (Array.isArray(z.fotos) ? z.fotos : []).filter((f: string) => /^[\w.-]+$/.test(f)).slice(0, 6),
      }))
      await upsert('qualidade_respostas', linhas)
      await upd(`qualidade_relatorios?codigo=eq.${enc(codigo)}`, m)
      return { ok: true, calc: calcular(await rest(`qualidade_respostas?codigo=eq.${enc(codigo)}&select=resposta,peso`)) }
    }
    if (y === 'finalizar') {
      const c = calcular(await rest(`qualidade_respostas?codigo=eq.${enc(codigo)}&select=resposta,peso`))
      if (c.nota == null) throw new Erro('responda pelo menos uma pergunta')
      await upd(`qualidade_relatorios?codigo=eq.${enc(codigo)}`, { status: 'finalizado', nota: c.nota, pontos: c.pontos, peso_total: c.peso_total, n_verde: c.verde, n_amarela: c.amarela, n_vermelha: c.vermelha, n_na: c.na, n_sem: c.sem, finalizado_em: agora(), atualizado_em: agora() })
      return { ok: true, calc: c, pdf: null }
    }
    if (y === 'reabrir') { await upd(`qualidade_relatorios?codigo=eq.${enc(codigo)}`, { status: 'rascunho', atualizado_em: agora() }); return { ok: true } }
    if (y === 'apagar') {
      const fs = (await rest(`qualidade_respostas?codigo=eq.${enc(codigo)}&select=fotos`)).flatMap((z: B) => z.fotos || [])
      await del(`qualidade_relatorios?codigo=eq.${enc(codigo)}`)
      await apagarFotos(fs)
      return { ok: true }
    }
  }
  if (a === 'relatorios' && x && y === 'email' && G) { // PREPARA o e-mail (não envia)
    const r = await relatorio(codOk(x))
    if (!r) throw new Erro('relatório não existe', 404)
    const f = (n: number | null) => (n == null ? '—' : Number(n).toFixed(2).replace('.', ','))
    const d = r.data.split('-').reverse().join('/')
    // modelo que já se chama "Relatório estrutural" não vira "Relatório Relatório estrutural"
    const titulo = /^relat[óo]rio\b/i.test(r.modelo_nome || '') ? r.modelo_nome : `Relatório ${r.modelo_nome}`
    const assunto = `${titulo} — ${r.casa?.nome || r.casa_id} — ${d} — nota ${f(r.calc.nota)}%`
    const corpo = [`Olá,`, ``, `Segue o ${titulo.charAt(0).toLowerCase() + titulo.slice(1)} da visita de ${d} (${r.nutri}).`, `Nota final: ${f(r.calc.nota)}%`, ``,
      r.ncs.length ? `Pontos de atenção (${r.ncs.length}):` : 'Nenhum ponto fora do padrão. Parabéns à equipe!',
      ...r.ncs.slice(0, 20).map((z: B) => `- ${z.resposta === 'vermelha' ? '[VERMELHO]' : '[AMARELO]'} ${z.area}: ${z.pergunta}${z.comentario ? ' — ' + z.comentario : ''}`),
      ``, `O PDF completo (com fotos) vai em anexo.`, ``, `Qualidade — Grupo Botequim`].join('\n')
    return { para: r.casa?.email || '', assunto, corpo, envio_automatico: false, falta: 'O sistema não envia e-mail sozinho: baixe o PDF, toque em "Abrir no e-mail" e anexe o PDF.' }
  }
  if (a === 'demo' && x === 'apagar' && P) {
    const rs = await rest('qualidade_relatorios?demo=eq.1&select=codigo')
    const cods = rs.map((r: B) => r.codigo)
    const fotos: string[] = []
    for (let i = 0; i < cods.length; i += 50) {
      const lote = cods.slice(i, i + 50).map((c: string) => `"${c}"`).join(',')
      fotos.push(...(await rest(`qualidade_respostas?codigo=in.(${enc(lote)})&select=fotos`)).flatMap((z: B) => z.fotos || []))
      await del(`qualidade_relatorios?codigo=in.(${enc(lote)})`)
    }
    const es = await rest('qualidade_epi_entregas?demo=eq.1&select=id,assinatura,foto')
    if (es.length) await del('qualidade_epi_entregas?demo=eq.1')
    await apagarFotos([...fotos, ...es.flatMap((e: B) => [e.assinatura, e.foto])])
    return { ok: true, relatorios: cods.length, entregas_epi: es.length }
  }
  if (a === 'comparativo' && G) return comparativo(q.get('semana'))
  if (a === 'foto' && !x && P) { // 🖊️ foto marcada com a caneta = a que vale; a original fica guardada ao lado (<nome>-orig)
    const nome = 'f-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const arquivo = await subirImagem(b.imagem, nome)
    const original = b.original ? await subirImagem(b.original, nome + '-orig') : null
    return { ok: true, arquivo, original }
  }

  // Uniforme e EPI
  if (a === 'epi' && x === 'catalogo' && G) return rest('qualidade_epi_catalogo?ativo=eq.1&select=*&order=tipo.desc,nome')
  if (a === 'epi' && x === 'catalogo' && P) {
    if (b.id) {
      const m: B = { ca: txt(b.ca, 20), troca_dias: b.troca_dias ? +b.troca_dias : null }
      if (b.nome) m.nome = txt(b.nome, 80)
      if (b.tipo) m.tipo = b.tipo === 'epi' ? 'epi' : 'uniforme'
      if (b.ativo != null) m.ativo = b.ativo ? 1 : 0
      await upd(`qualidade_epi_catalogo?id=eq.${+b.id}`, m); return { ok: true }
    }
    if (!b.nome) throw new Erro('nome do item')
    const r = (await ins('qualidade_epi_catalogo', { nome: txt(b.nome, 80), tipo: b.tipo === 'epi' ? 'epi' : 'uniforme', ca: txt(b.ca, 20), troca_dias: b.troca_dias ? +b.troca_dias : null, ativo: 1 }))[0]
    return { ok: true, id: r.id }
  }
  if (a === 'epi' && x === 'entregas' && !y && G) {
    const hoje = hojeISO()
    let f = 'qualidade_epi_entregas?select=*&order=data_entrega.desc,id.desc&limit=2000'
    if (q.get('casa')) f += `&casa_id=eq.${enc(q.get('casa')!)}`
    if (q.get('pessoa')) f += `&pessoa_id=eq.${+q.get('pessoa')!}`
    const rows = (await rest(f)).map((e: B) => ({ ...e, situacao: situacaoEpi(e, hoje) }))
    const casas = (await rest('qualidade_casas?ativo=eq.1&select=id,nome&order=ordem')).map((c: B) => {
      const d = rows.filter((e: B) => e.casa_id === c.id && e.status === 'ativo')
      return { ...c, pessoas: new Set(d.map((e: B) => e.pessoa_id ?? e.pessoa_nome)).size, itens: d.reduce((s: number, e: B) => s + (e.qtd || 1), 0), vencidas: d.filter((e: B) => e.situacao === 'vencida' || e.situacao === 'ca_vencido').length, vence_logo: d.filter((e: B) => e.situacao === 'vence_logo').length, sem_assinatura: d.filter((e: B) => !e.assinatura && !e.foto).length }
    })
    return { hoje, entregas: rows, casas, alertas: rows.filter((e: B) => ['vencida', 'ca_vencido', 'vence_logo'].includes(e.situacao)) }
  }
  if (a === 'epi' && x === 'entregas' && !y && P) {
    const item = (await rest(`qualidade_epi_catalogo?id=eq.${+b.item_id || 0}&select=*`))?.[0]
    if (!b.pessoa_nome || !item) throw new Erro('escolha a pessoa e o item')
    const data = dataOk(b.data_entrega) ? b.data_entrega : hojeISO()
    const troca = dataOk(b.troca_em) ? b.troca_em : item.troca_dias ? addDias(data, item.troca_dias) : null
    const base = 'epi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const assin = b.assinatura ? await subirImagem(b.assinatura, base + '-assin') : null
    const foto = b.foto ? await subirImagem(b.foto, base + '-foto') : null
    if (b.foto && b.foto_original) await subirImagem(b.foto_original, base + '-foto-orig')
    const r = (await ins('qualidade_epi_entregas', { pessoa_id: b.pessoa_id ? +b.pessoa_id : null, pessoa_nome: txt(b.pessoa_nome, 120), casa_id: txt(b.casa_id, 30), item_id: item.id, item_nome: item.nome, tipo: item.tipo,
      tamanho: txt(b.tamanho, 10), qtd: Math.max(1, +b.qtd || 1), data_entrega: data, ca: txt(b.ca, 20) || item.ca || null, ca_validade: dataOk(b.ca_validade) ? b.ca_validade : null, troca_em: troca,
      assinatura: assin, foto, entregue_por: txt(b.entregue_por, 60), obs: txt(b.obs, 500), status: 'ativo', demo: b.demo ? 1 : 0, criado_em: agora(), atualizado_em: agora() }))[0]
    return { ok: true, id: r.id, troca_em: troca }
  }
  if (a === 'epi' && x === 'entregas' && y && P) {
    const id = +y
    if (b.apagar) {
      const e = (await rest(`qualidade_epi_entregas?id=eq.${id}&select=assinatura,foto`))?.[0]
      await del(`qualidade_epi_entregas?id=eq.${id}`)
      if (e) await apagarFotos([e.assinatura, e.foto])
      return { ok: true }
    }
    if (['ativo', 'devolvido', 'trocado'].includes(b.status)) await upd(`qualidade_epi_entregas?id=eq.${id}`, { status: b.status, atualizado_em: agora() })
    return { ok: true }
  }

  // pessoas (só nome, casa e cargo)
  if (a === 'pessoas' && G) return { pessoas: (await rest('qualidade_pessoas?select=id,nome,casa,cargo&order=nome&limit=5000')).map((p: B) => ({ ...p, ativo: 1 })) }

  throw new Erro('rota não existe', 404)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const url = new URL(req.url)
    const partes = url.pathname.split('/').filter(Boolean)
    const i = partes.indexOf('qualidade')
    const p = (i >= 0 ? partes.slice(i + 1) : partes).map(decodeURIComponent)
    let b: B = {}
    if (req.method === 'POST') {
      const t = await req.text()
      if (t.length > 7 * 1024 * 1024) throw new Erro('envio grande demais')
      b = t ? JSON.parse(t) : {}
    }
    if (p[0] === 'entrar' && req.method === 'POST') return json(await entrar(req, b))
    if (p[0] === 'ping') return json({ ok: true })
    if (p[0] === 'foto' && p[1] && req.method === 'GET') { // <img src> → redireciona pra URL assinada (1h)
      await exigeSessao(url.searchParams.get('s'))
      return new Response(null, { status: 302, headers: { ...CORS, location: await urlAssinada(p[1]), 'cache-control': 'private, max-age=1800' } })
    }
    await exigeSessao(req.headers.get('x-sessao'))
    return json(await rota(req, req.method, p, url.searchParams, b))
  } catch (e) {
    const st = e instanceof Erro ? e.st : 500
    return json({ erro: e instanceof Error ? e.message : String(e) }, st)
  }
})
