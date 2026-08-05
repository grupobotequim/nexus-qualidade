# Nexus Qualidade — Auditoria de Qualidade/Food Safety (Botequim)

## O que é
Sistema próprio de auditoria de qualidade/food safety das lojas + CD do Grupo Botequim, pra substituir o app de terceiro que as nutricionistas (Maria Ament, Kátia Cavalcante Beber — CRN 27.760) usam hoje. Construído em cima do escopo funcional que a nutricionista mandou + do padrão real de uso observado no grupo "Nutri Botequim" (121 mensagens analisadas, 20/07 a 05/08/2026). Doc de contexto/decisões completo em `CEREBRO-LUCAS\PROJETOS\Botequim-Lucro-20\Nexus-Qualidade\` (CLAUDE.md + MELHORIAS-PROPOSTAS.md).

## Stack (reaproveitando a arquitetura do Nexus-Inventário)
- **Front:** HTML puro, sem framework, sem build step
- **Banco:** Supabase (Postgres), tabelas prefixo `qual_*`, RLS desligado (sistema interno)
- **Fotos:** Supabase Storage, bucket `qualidade-fotos`
- Dois apps:
  - `auditoria.html` — app de campo (nutricionista preenche o checklist na unidade)
  - `painel.html` — painel de gestão (ranking, cobrança de pendência, fila de WhatsApp, treinamento/certificação)

## Como rodar — ✅ já configurado (05/08/2026)
Reaproveitando o projeto Supabase `caixinha-botequim` (ref `kuyhkltbwlkvtgbabscv`, mesmo do Nexus-Inventário):
1. ✅ `01_schema.sql`, `02_seed_casas_auditores.sql`, `03_seed_checklist_rotina.sql` já rodados via Management API.
2. ✅ Bucket de Storage `qualidade-fotos` (público) já criado.
3. ✅ `SUPABASE_URL`/`SUPABASE_ANON_KEY` já preenchidos no topo de `auditoria.html` e `painel.html`.
4. Conferido: 5 casas, 2 auditoras, 2 templates, 20 áreas, 109 perguntas no banco.
5. Ainda local (`file://`) — falta publicar no GitHub Pages quando quiser usar no celular de verdade (câmera funciona melhor em HTTPS).

## Decisões de design importantes
- **Nota ponderada = nota_final_pct / 20.** Descoberto batendo os números reais do grupo (80.80% → 4.04; 93.33% → 4.67) — não estava escrito no escopo, foi engenharia reversa dos relatórios reais.
- **Apontamentos de validade são um registro à parte** (`qual_apontamentos`), não uma pergunta do checklist — porque no uso real ela aponta produtos específicos ("3 maioneses vencidas"), não uma nota de área. O checklist (perguntas 1/2/3/N-A) e os apontamentos (itens fora do padrão) são dois modelos de dado diferentes que convivem na mesma auditoria.
- **🚫 Nenhuma mensagem de WhatsApp é enviada pelo sistema.** Regra do Lucas (bronca de 29/07/2026 — nenhum robô manda mensagem sozinho, nem agendado). O sistema só GERA a mensagem (resumo automático, ranking, cobrança de pendência) e deixa em `qual_mensagens_pendentes` com status `pendente`. Alguém copia e manda manualmente pelo painel, depois marca como enviada. **Não wire isso pra envio automático sem o Lucas mandar explicitamente na hora.**
- **Offline first no `auditoria.html`**: rascunho salvo em `localStorage` a cada mudança (chave por unidade+data); se o envio falhar por falta de conexão, entra numa fila local (`qual_fila_offline`) e tenta de novo sozinho quando a internet voltar.

## O que falta (próximos passos, em ordem)
1. **Decidir e configurar o projeto Supabase** — reaproveitar `caixinha-botequim` ou criar um novo (a confirmar com Lucas).
2. **Testar de ponta a ponta** com dado real de uma unidade (rodar o schema, preencher um checklist de verdade, ver se a nota bate com o app atual).
3. **Cadastrar `qual_funcionarios`** — hoje só existe schema, sem seed (não tinha lista de funcionários nos documentos recebidos). Cadastro manual ou importar de outro sistema (RH?).
4. **"Relatório Geral"** — o escopo cita esse segundo tipo de visita (mensal/sazonal), mas só vieram perguntas do tipo "Rotina". Falta pedir pra nutricionista o checklist do Geral.
5. **Envio real pro WhatsApp** — quando o Lucas decidir automatizar de verdade o "copiar e colar" do painel, isso é trabalho de infra (Danilo/Iago — área de Automação & IA), plugando num robô de WhatsApp existente (ws-agent/zb-agent) com confirmação explícita a cada envio, nunca silencioso.
6. **Cruzar com o Nexus Etiquetas** — os apontamentos mais comuns (`sem_etiqueta`/`etiqueta_errada`/`vencido`) são o problema que o Etiquetas resolve na ponta. Se a unidade já usa Etiquetas, dá pra puxar validade de lá em vez do auditor contar na mão — depende de acesso à base do Etiquetas.
7. **Sanitizar antes de repassar pra qualquer contratado externo** (ver regra padrão de handoff — tirar token/PAT, `.gitignore`).

## Cérebro / arquivos-chave
| Arquivo | O que é |
|---|---|
| `01_schema.sql` | Schema das 14 tabelas `qual_*` + 2 views (ranking, áreas problemáticas) |
| `02_seed_casas_auditores.sql` | Unidades + as duas nutricionistas |
| `03_seed_checklist_rotina.sql` | Checklists reais (7 áreas lojas, 13 áreas CD) extraídos dos PDFs |
| `auditoria.html` | App de campo — preenchimento do checklist |
| `painel.html` | Painel de gestão — ranking, cobrança, fila WhatsApp, certificados |

## 🔗 Relacionados
- Doc de contexto/melhorias: `CEREBRO-LUCAS\PROJETOS\Botequim-Lucro-20\Nexus-Qualidade\CLAUDE.md` e `MELHORIAS-PROPOSTAS.md`
- Arquitetura de referência: `CEREBRO-LUCAS\PROJETOS\Botequim-Lucro-20\Nexus-Inventario\` (`C:\dev\nexus-inventario`)
