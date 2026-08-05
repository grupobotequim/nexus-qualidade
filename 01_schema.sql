-- =====================================================================
-- NEXUS QUALIDADE — Auditoria de qualidade/food safety (Botequim)
-- Sistema INTERNO  ->  ao criar, clicar em "Run without RLS"
-- Cole numa ABA NOVA do SQL Editor (+ New query)
-- =====================================================================

-- 1) CASAS (unidades: Esmeralda, SCS, SBC, Washington Luís, CD Santo André...)
create table if not exists qual_casas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  apelido     text,
  tipo        text not null default 'loja',   -- loja | cd
  ativo       boolean not null default true,
  criada_em   timestamptz not null default now()
);

-- 2) FUNCIONÁRIOS (equipe das casas — usado no checklist e no módulo de treinamento)
create table if not exists qual_funcionarios (
  id          uuid primary key default gen_random_uuid(),
  casa_id     uuid references qual_casas(id),
  nome        text not null,
  cargo       text,                                -- gerente, cozinheiro, barman, estoquista...
  whatsapp    text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- 3) AUDITORES (nutricionistas / quem preenche o checklist)
create table if not exists qual_auditores (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  crn         text,                                -- registro profissional (ex: CRN 27.760)
  whatsapp    text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- 4) TEMPLATES de checklist (Rotina Loja, Rotina CD, Geral Loja, Geral CD...)
create table if not exists qual_templates (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,                       -- "Rotina - Lojas", "Rotina - CD"
  tipo_visita text not null default 'rotina',       -- rotina | geral
  aplica_a    text not null default 'loja',         -- loja | cd
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- 5) ÁREAS dentro de um template (ex: Salão, Bar, Cozinha, Câmara resfriada...)
create table if not exists qual_areas (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid references qual_templates(id) on delete cascade,
  nome         text not null,
  ordem        int not null default 0
);

-- 6) PERGUNTAS dentro de uma área
create table if not exists qual_perguntas (
  id           uuid primary key default gen_random_uuid(),
  area_id      uuid references qual_areas(id) on delete cascade,
  texto        text not null,
  ordem        int not null default 0
);

-- 7) AUDITORIAS (cabeçalho — uma visita completa numa casa)
create table if not exists qual_auditorias (
  id                uuid primary key default gen_random_uuid(),
  casa_id           uuid references qual_casas(id),
  auditor_id        uuid references qual_auditores(id),
  template_id       uuid references qual_templates(id),
  status            text not null default 'rascunho',  -- rascunho | enviada
  nota_final_pct    numeric,                            -- ex: 80.80
  nota_ponderada    numeric,                             -- ex: 4.04
  data_visita       date not null default current_date,
  gps_lat           numeric,
  gps_lng           numeric,
  criada_em         timestamptz not null default now(),
  enviada_em        timestamptz
);

-- 8) RESPOSTAS (cada pergunta respondida numa auditoria)
create table if not exists qual_respostas (
  id            uuid primary key default gen_random_uuid(),
  auditoria_id  uuid references qual_auditorias(id) on delete cascade,
  pergunta_id   uuid references qual_perguntas(id),
  nota          text not null,          -- '1' inconforme | '2' parcial | '3' conforme | 'na'
  comentario    text,
  foto_url      text,
  criada_em     timestamptz not null default now()
);

-- 9) APONTAMENTOS de validade/etiqueta (o miolo do "resumo" que hoje é digitado à mão)
create table if not exists qual_apontamentos (
  id            uuid primary key default gen_random_uuid(),
  auditoria_id  uuid references qual_auditorias(id) on delete cascade,
  area_nome     text not null,                -- snapshot do nome da área (Bar, Cozinha...)
  tipo_problema text not null,                -- vencido | sem_etiqueta | etiqueta_errada | data_errada | sem_etiqueta_descongelamento
  produto       text not null,                -- "3 maioneses"
  quantidade    int not null default 1,
  data_ref      date,                         -- data de validade encontrada, quando aplicável
  foto_url      text,
  criado_em     timestamptz not null default now()
);

-- 10) AÇÕES CORRETIVAS (fecha o ciclo: vincula ao apontamento que gerou o problema)
create table if not exists qual_acoes_corretivas (
  id               uuid primary key default gen_random_uuid(),
  apontamento_id   uuid references qual_apontamentos(id) on delete cascade,
  descricao        text not null,             -- "descarte imediato + treinamento corretivo"
  responsavel_nome text,                      -- quem recebeu o treinamento/aplicou a correção
  foto_url         text,
  status           text not null default 'pendente',  -- pendente | resolvida
  criada_em        timestamptz not null default now(),
  resolvida_em     timestamptz
);

-- 11) TREINAMENTOS (evento de treinamento aplicado numa casa)
create table if not exists qual_treinamentos (
  id           uuid primary key default gen_random_uuid(),
  casa_id      uuid references qual_casas(id),
  auditor_id   uuid references qual_auditores(id),
  tema         text not null,                 -- "Higiene, saúde e manipulação de alimentos"
  carga_horas  numeric,
  data_evento  date not null default current_date,
  foto_url     text,
  criado_em    timestamptz not null default now()
);

-- 12) PRESENÇA no treinamento
create table if not exists qual_treinamento_participantes (
  id              uuid primary key default gen_random_uuid(),
  treinamento_id  uuid references qual_treinamentos(id) on delete cascade,
  funcionario_id  uuid references qual_funcionarios(id),
  assinou         boolean default true
);

-- 13) CERTIFICADOS (curso formal, com validade — cobrança de renovação)
create table if not exists qual_certificados (
  id               uuid primary key default gen_random_uuid(),
  funcionario_id   uuid references qual_funcionarios(id),
  curso            text not null,             -- "Boas Práticas de Manipulação de Alimentos"
  carga_horas      numeric,
  emitido_por      text,
  data_emissao     date not null,
  validade_meses   int default 12,
  certificado_url  text,
  criado_em        timestamptz not null default now()
);

-- 14) FILA DE MENSAGENS PENDENTES — staging pro WhatsApp.
--     NUNCA enviado sozinho: sistema só gera e deixa "pronta pra mandar";
--     alguém aprova em painel.html antes de sair (ver CLAUDE.md, regra de 29/07).
create table if not exists qual_mensagens_pendentes (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null,               -- resumo_auditoria | ranking_semanal | cobranca_pendencia
  casa_id        uuid references qual_casas(id),
  referencia_id  uuid,                        -- id da auditoria / ação corretiva / período do ranking
  grupo_destino  text,                        -- "Nutri Botequim" — informativo, quem envia decide de fato
  texto          text not null,
  status         text not null default 'pendente',  -- pendente | aprovada | enviada | descartada
  aprovado_por   text,
  aprovado_em    timestamptz,
  criada_em      timestamptz not null default now()
);

-- ÍNDICES
create index if not exists idx_areas_template        on qual_areas(template_id);
create index if not exists idx_perguntas_area         on qual_perguntas(area_id);
create index if not exists idx_auditorias_casa        on qual_auditorias(casa_id, data_visita);
create index if not exists idx_respostas_auditoria    on qual_respostas(auditoria_id);
create index if not exists idx_apontamentos_auditoria on qual_apontamentos(auditoria_id);
create index if not exists idx_acoes_status           on qual_acoes_corretivas(status);
create index if not exists idx_certificados_func      on qual_certificados(funcionario_id);
create index if not exists idx_mensagens_status       on qual_mensagens_pendentes(status);

-- VIEW: ranking semanal automático (nota média por casa, últimos 7 dias vs 7 dias anteriores)
create or replace view qual_v_ranking_semanal as
select
  c.id as casa_id,
  c.nome as casa_nome,
  avg(a.nota_final_pct) filter (where a.data_visita >= current_date - 7) as media_semana_atual,
  avg(a.nota_final_pct) filter (where a.data_visita >= current_date - 14 and a.data_visita < current_date - 7) as media_semana_anterior,
  count(*) filter (where a.data_visita >= current_date - 7) as visitas_semana_atual
from qual_casas c
left join qual_auditorias a on a.casa_id = c.id and a.status = 'enviada'
group by c.id, c.nome;

-- VIEW: áreas mais problemáticas (recorrência de apontamentos por área)
create or replace view qual_v_areas_problematicas as
select
  ap.area_nome,
  count(*) as total_apontamentos,
  count(distinct ap.auditoria_id) as auditorias_distintas
from qual_apontamentos ap
group by ap.area_nome
order by total_apontamentos desc;
