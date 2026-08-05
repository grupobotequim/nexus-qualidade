-- Cadastro das unidades e das nutricionistas (cola em ABA NOVA, "Run without RLS")

insert into qual_casas (nome, apelido, tipo) values
  ('Botequim Esmeralda (Santo André)',        'Esmeralda',  'loja'),
  ('Botequim São Caetano do Sul',             'SCS',        'loja'),
  ('Botequim São Bernardo do Campo',          'SBC',        'loja'),
  ('Botequim Washington Luís',                'W. Luís',    'loja'),
  ('Centro de Distribuição - Santo André',    'CD',         'cd');

insert into qual_auditores (nome, crn) values
  ('Maria Ament', null),
  ('Kátia Cavalcante Beber', 'CRN 27.760');
