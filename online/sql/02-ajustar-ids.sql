-- depois da carga inicial (ids vindos do banco local), avança as sequências pra não colidir
create or replace function qualidade_ajustar_ids() returns void language plpgsql security definer set search_path = public as $$
declare t text; begin
  foreach t in array array['qualidade_modelos','qualidade_perguntas','qualidade_respostas','qualidade_epi_catalogo','qualidade_epi_entregas','qualidade_historico_itens'] loop
    execute format('select setval(pg_get_serial_sequence(%L, ''id''), greatest((select coalesce(max(id),0) from %I), 1) + 1000, false)', t, t);
  end loop;
end $$;
revoke all on function qualidade_ajustar_ids() from public, anon, authenticated;
grant execute on function qualidade_ajustar_ids() to service_role;
-- só as sequências qualidade_* (NÃO mexer nas dos outros apps)
do $$ declare s text; begin for s in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S' and c.relname like 'qualidade%' loop execute format('revoke all on sequence %I from anon, authenticated', s); end loop; end $$;
