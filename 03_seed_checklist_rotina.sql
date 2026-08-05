-- Seed dos checklists REAIS de rotina (extraídos dos PDFs da nutricionista, 05/08/2026)
-- Cola em ABA NOVA do SQL Editor, "Run without RLS"
-- Cobre só tipo_visita='rotina' (o "Relatório Geral" citado no escopo ainda não veio com perguntas)

do $$
declare
  tpl_lojas uuid;
  tpl_cd    uuid;
  area_id   uuid;
begin

  -- =========================================================
  -- TEMPLATE: Rotina - Lojas (7 áreas)
  -- =========================================================
  insert into qual_templates (nome, tipo_visita, aplica_a) values ('Rotina - Lojas', 'rotina', 'loja')
    returning id into tpl_lojas;

  -- Área 1 | Salão
  insert into qual_areas (template_id, nome, ordem) values (tpl_lojas, 'Salão', 1) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Amostras do buffet da feijoada devidamente retiradas?', 1),
    (area_id, 'Setor limpo e organizado?', 2),
    (area_id, 'Os condimentos (maionese, mostarda, ketchup, molho de pimenta, azeite e vinagre) estão com datas de validade adequadas?', 3),
    (area_id, 'Planilha de temperatura do buffet da feijoada preenchida?', 4),
    (area_id, 'Os produtos de limpeza estão devidamente identificados?', 5),
    (area_id, 'Planilha de recebimento dos perecíveis atualizada?', 6),
    (area_id, 'Planilha de limpeza diária dos banheiros está preenchida diariamente?', 7),
    (area_id, 'Os condimentos (maionese, mostarda, ketchup, molho de pimenta, azeite e vinagre) estão com datas de fracionamento adequadas?', 8),
    (area_id, 'Foi encontrada bebidas vencidas nas geladeiras do salão?', 9);

  -- Área 2 | Bar
  insert into qual_areas (template_id, nome, ordem) values (tpl_lojas, 'Bar', 2) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Setor limpo e organizado?', 1),
    (area_id, 'Preenchimento adequado da planilha de controle de temperatura dos equipamentos?', 2),
    (area_id, 'Foi encontrado algum alimento com data errada ou rasurada?', 3),
    (area_id, 'Os equipamentos estão limpos e organizados?', 4),
    (area_id, 'Alimentos prontos ou abertos sem proteção ou identificação de validade?', 5),
    (area_id, 'Preenchimento adequado da planilha de higienização dos equipamentos?', 6),
    (area_id, 'Contaminação cruzada?', 7),
    (area_id, 'Foi encontrado alimento com data vencida?', 8);

  -- Área 3 | Cozinha
  insert into qual_areas (template_id, nome, ordem) values (tpl_lojas, 'Cozinha', 3) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Alimentos prontos ou abertos sem proteção ou identificação de validade?', 1),
    (area_id, 'Alimentos com etiqueta de descongelamento correta?', 2),
    (area_id, 'Preenchimento adequado da planilha de controle de temperatura dos equipamentos?', 3),
    (area_id, 'Foi encontrado algum alimento com data errada ou rasurada?', 4),
    (area_id, 'Os equipamentos estão limpos e organizados?', 5),
    (area_id, 'Contaminação cruzada?', 6),
    (area_id, 'Foi encontrado alimento com data vencida?', 7),
    (area_id, 'Setor limpo e organizado?', 8),
    (area_id, 'Preenchimento adequado da planilha de higienização dos equipamentos?', 9);

  -- Área 4 | Churrasqueira
  insert into qual_areas (template_id, nome, ordem) values (tpl_lojas, 'Churrasqueira', 4) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Alimentos com etiqueta de descongelamento correta?', 1),
    (area_id, 'Preenchimento adequado da planilha de controle de temperatura dos equipamentos?', 2),
    (area_id, 'Foi encontrado alimento com data vencida?', 3),
    (area_id, 'Setor limpo e organizado?', 4),
    (area_id, 'Os equipamentos estão limpos e organizados?', 5),
    (area_id, 'Contaminação cruzada?', 6),
    (area_id, 'Foi encontrado algum alimento com data errada ou rasurada?', 7),
    (area_id, 'Preenchimento adequado da planilha de higienização dos equipamentos?', 8),
    (area_id, 'Alimentos prontos ou abertos sem proteção ou identificação de validade?', 9);

  -- Área 5 | Câmara resfriada e congelada
  insert into qual_areas (template_id, nome, ordem) values (tpl_lojas, 'Câmara resfriada e congelada', 5) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Preenchimento adequado da planilha de controle de temperatura?', 1),
    (area_id, 'Setor limpo e organizado?', 2),
    (area_id, 'Contaminação cruzada?', 3),
    (area_id, 'Foi encontrado algum alimento com data errada ou rasurada?', 4),
    (area_id, 'Alimentos prontos ou abertos sem proteção ou identificação de validade?', 5),
    (area_id, 'Alimentos com etiqueta de descongelamento correta?', 6),
    (area_id, 'Foi encontrado alimento com data vencida?', 7);

  -- Área 6 | Área comum
  insert into qual_areas (template_id, nome, ordem) values (tpl_lojas, 'Área comum', 6) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Foi encontrado alimentos com data vencida?', 1),
    (area_id, 'Alimentos prontos ou abertos sem proteção ou identificação de validade?', 2),
    (area_id, 'Setor limpo e organizado?', 3);

  -- Área 7 | Estoque seco
  insert into qual_areas (template_id, nome, ordem) values (tpl_lojas, 'Estoque seco', 7) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Foi encontrado alimentos com data vencida?', 1),
    (area_id, 'Setor limpo e organizado?', 2),
    (area_id, 'Alimentos prontos ou abertos sem proteção ou identificação de validade?', 3);

  -- =========================================================
  -- TEMPLATE: Rotina - CD (13 áreas)
  -- =========================================================
  insert into qual_templates (nome, tipo_visita, aplica_a) values ('Rotina - CD', 'rotina', 'cd')
    returning id into tpl_cd;

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Higiene Pessoal', 1) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Colaboradores com uniformes dentro do padrão, bem conservados, limpos e passados?', 1),
    (area_id, 'Pia de lavagem de mãos está abastecida com sabonete bactericida inodoro, papel não reciclado e lixeira com acionamento por pedal?', 2);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Área de recebimento', 2) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'O ambiente está limpo e organizado?', 1),
    (area_id, 'Planilhas devidamente preenchidas?', 2);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Banheiros', 3) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Os banheiros estão limpos, organizados, abastecidos com papel toalha, papel higiênico e sabonete líquido?', 1),
    (area_id, 'As portas, azulejos, piso, espelhos e bancadas, porta papel toalha, saboneteira e porta papel higiênico estão limpos e organizados?', 2),
    (area_id, 'Baldes dos lixos estão limpos, com tampas e com pedal funcionando?', 3),
    (area_id, 'A planilha de limpeza está atualizada?', 4);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Cozinha', 4) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Ausência de contaminação cruzada?', 1),
    (area_id, 'Cozinha limpa e organizada?', 2),
    (area_id, 'Ausência de pragas na área de produção?', 3),
    (area_id, 'Os equipamentos estão limpos?', 4),
    (area_id, 'Higiene dos utensílios e equipamentos desmontáveis?', 5),
    (area_id, 'Foi encontrado alimento vencido, data errada ou rasurada?', 6),
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 7);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Estoque seco', 5) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Presença de apoio para as mercadorias (estrados e prateleiras) em quantidades suficientes e bem conservados?', 1),
    (area_id, 'Área limpa e organizada?', 2),
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 3);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Câmara congelada - Armazenamento', 6) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 1),
    (area_id, 'A câmara está limpa e organizada?', 2),
    (area_id, 'As mercadorias estão armazenadas de forma adequada, palets e prateleiras?', 3),
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 4),
    (area_id, 'Está livre de contaminação cruzada?', 5);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Câmara resfriada - Armazenamento', 7) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'As mercadorias estão armazenadas de forma adequada, palets e prateleiras?', 1),
    (area_id, 'Está livre de contaminação cruzada?', 2),
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 3),
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 4),
    (area_id, 'A câmara está limpa e organizada?', 5);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Câmara congelada - Açougue', 8) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 1),
    (area_id, 'A câmara está limpa e organizada?', 2),
    (area_id, 'Está livre de contaminação cruzada?', 3),
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 4);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Câmara resfriada - Açougue', 9) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 1),
    (area_id, 'A câmara está limpa e organizada?', 2),
    (area_id, 'Está livre de contaminação cruzada?', 3),
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 4);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Área de produção - Açougue', 10) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Setor limpo e organizado?', 1),
    (area_id, 'Os equipamentos estão limpos?', 2),
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 3),
    (area_id, 'Planilha de limpeza dos equipamentos está preenchida?', 4),
    (area_id, 'O ambiente está livre de objetos pessoais?', 5),
    (area_id, 'Ausência de contaminação cruzada?', 6),
    (area_id, 'Higiene dos utensílios e equipamentos desmontáveis?', 7),
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 8);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Área de produção - Sobremesas', 11) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Setor limpo e organizado?', 1),
    (area_id, 'O ambiente está livre objetos pessoais?', 2),
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 3),
    (area_id, 'Ausência de contaminação cruzada?', 4),
    (area_id, 'Preenchimento da planilha de limpeza dos equipamentos?', 5),
    (area_id, 'Os equipamentos estão limpos?', 6),
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 7),
    (area_id, 'Higiene dos utensílios e equipamentos desmontáveis?', 8);

  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Área de produção - Salgados', 12) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Preenchimento da planilha de limpeza dos equipamentos?', 1),
    (area_id, 'Os equipamentos estão limpos?', 2),
    (area_id, 'Setor limpo e organizado?', 3),
    (area_id, 'Ausência de contaminação cruzada?', 4),
    (area_id, 'Alimentos devidamente protegidos e com data de validade?', 5),
    (area_id, 'Foi encontrado data vencida, errada ou rasurada?', 6),
    (area_id, 'Higiene dos utensílios e equipamentos desmontáveis?', 7);

  -- Área 13 | Registros operacionais — PDF cortado na página 3 (só vieram 2 itens claros)
  insert into qual_areas (template_id, nome, ordem) values (tpl_cd, 'Registros operacionais', 13) returning id into area_id;
  insert into qual_perguntas (area_id, texto, ordem) values
    (area_id, 'Planilhas de controle de temperatura dos equipamentos preenchido?', 1),
    (area_id, 'Formulário de controle de aferição de termômetros atualizado?', 2);

end $$;
