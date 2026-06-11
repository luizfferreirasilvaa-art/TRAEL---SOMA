-- ═══════════════════════════════════════════════════════════════════════
--  SOMA MODULAR — Setup de Autenticação e RBAC no Supabase (Idempotente)
--  Pode ser executado múltiplas vezes sem erros.
--  Execute no SQL Editor: Project → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de Perfis de Usuário ───────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('programador', 'coordenador', 'alimentador')),
  display_name TEXT NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 2. RLS na tabela user_profiles ───────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_select_own"     ON user_profiles;
DROP POLICY IF EXISTS "profile_insert_service" ON user_profiles;

CREATE POLICY "profile_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profile_insert_service" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- ── 3. Adicionar coluna meta na tabela setores ────────────────────────
ALTER TABLE setores ADD COLUMN IF NOT EXISTS meta NUMERIC(5,1);

-- ── 4. Colunas de auditoria em registros_cronoanalise ─────────────────
ALTER TABLE registros_cronoanalise ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE registros_cronoanalise ADD COLUMN IF NOT EXISTS created_by_role TEXT;
ALTER TABLE registros_cronoanalise ADD COLUMN IF NOT EXISTS created_by_uid  UUID;

-- ── 5. RLS em registros_cronoanalise ─────────────────────────────────
DROP POLICY IF EXISTS "Public Select Registros"         ON registros_cronoanalise;
DROP POLICY IF EXISTS "Public Insert Registros"         ON registros_cronoanalise;
DROP POLICY IF EXISTS "Public Delete Registros"         ON registros_cronoanalise;
DROP POLICY IF EXISTS "registros_select_auth"           ON registros_cronoanalise;
DROP POLICY IF EXISTS "registros_insert_auth"           ON registros_cronoanalise;
DROP POLICY IF EXISTS "registros_delete_manager"        ON registros_cronoanalise;
DROP POLICY IF EXISTS "registros_update_manager"        ON registros_cronoanalise;

CREATE POLICY "registros_select_auth" ON registros_cronoanalise
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "registros_insert_auth" ON registros_cronoanalise
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "registros_delete_manager" ON registros_cronoanalise
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('programador', 'coordenador')
    )
  );

CREATE POLICY "registros_update_manager" ON registros_cronoanalise
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role IN ('programador', 'coordenador')
    )
  );

-- ── 6. RLS em operadores ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Select Operadores"    ON operadores;
DROP POLICY IF EXISTS "Public Insert Operadores"    ON operadores;
DROP POLICY IF EXISTS "Public Delete Operadores"    ON operadores;
DROP POLICY IF EXISTS "operadores_select_auth"      ON operadores;
DROP POLICY IF EXISTS "operadores_insert_manager"   ON operadores;
DROP POLICY IF EXISTS "operadores_delete_manager"   ON operadores;

CREATE POLICY "operadores_select_auth" ON operadores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "operadores_insert_manager" ON operadores
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('programador','coordenador'))
  );

CREATE POLICY "operadores_delete_manager" ON operadores
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('programador','coordenador'))
  );

-- ── 7. RLS em setores ────────────────────────────────────────────────
ALTER TABLE setores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "setores_select_auth"    ON setores;
DROP POLICY IF EXISTS "setores_insert_manager" ON setores;
DROP POLICY IF EXISTS "setores_delete_manager" ON setores;

CREATE POLICY "setores_select_auth" ON setores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "setores_insert_manager" ON setores
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('programador','coordenador'))
  );

CREATE POLICY "setores_delete_manager" ON setores
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('programador','coordenador'))
  );

-- ── 8. RLS em maquinas ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Select Maquinas"  ON maquinas;
DROP POLICY IF EXISTS "Public Insert Maquinas"  ON maquinas;
DROP POLICY IF EXISTS "Public Delete Maquinas"  ON maquinas;
DROP POLICY IF EXISTS "maquinas_select_auth"    ON maquinas;
DROP POLICY IF EXISTS "maquinas_insert_auth"    ON maquinas;
DROP POLICY IF EXISTS "maquinas_delete_manager" ON maquinas;

CREATE POLICY "maquinas_select_auth" ON maquinas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "maquinas_insert_auth" ON maquinas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "maquinas_delete_manager" ON maquinas
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('programador','coordenador'))
  );

-- ── 9. RLS em paradas_motivos ────────────────────────────────────────
DROP POLICY IF EXISTS "Public Select Paradas Motivos" ON paradas_motivos;
DROP POLICY IF EXISTS "Public Insert Paradas Motivos" ON paradas_motivos;
DROP POLICY IF EXISTS "Public Delete Paradas Motivos" ON paradas_motivos;
DROP POLICY IF EXISTS "paradas_select_auth"           ON paradas_motivos;
DROP POLICY IF EXISTS "paradas_insert_auth"           ON paradas_motivos;
DROP POLICY IF EXISTS "paradas_delete_manager"        ON paradas_motivos;

CREATE POLICY "paradas_select_auth" ON paradas_motivos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "paradas_insert_auth" ON paradas_motivos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "paradas_delete_manager" ON paradas_motivos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('programador','coordenador'))
  );

-- ═══════════════════════════════════════════════════════════════════════
--  PASSO FINAL — Vincular perfis aos usuários criados no Auth
--
--  1. Crie os usuários em: Authentication → Users → "Add user"
--     (Desative "Confirm email" em Auth → Email antes de criar)
--
--     E-mail                       Senha    Nome para Exibição
--     admin.trael@trael.cto        183729   Luiz Silva
--     admin.trael@trael.coo        183729   Erlan Redez
--     admin.trael@trael.ceo        183729   Matheus Inhan
--     gerencia@trael.com           123456   Gerência Operacional
--     soma@trael.com               123456   Operacional de Campo
--
--  2. Após criar, rode a query abaixo para pegar os UUIDs gerados:
--     SELECT id, email FROM auth.users ORDER BY created_at;
--
--  3. Substitua os <UUID_...> e rode o INSERT:
-- ═══════════════════════════════════════════════════════════════════════

-- Descomente e ajuste com os UUIDs reais:
/*
INSERT INTO user_profiles (id, role, display_name) VALUES
  ('<UUID_DO_admin.trael@trael.cto>', 'programador', 'Luiz Silva'),
  ('<UUID_DO_admin.trael@trael.coo>', 'programador', 'Erlan Redez'),
  ('<UUID_DO_admin.trael@trael.ceo>', 'programador', 'Matheus Inhan'),
  ('<UUID_DO_gerencia@trael.com>',    'coordenador',  'Gerência Operacional'),
  ('<UUID_DO_soma@trael.com>',        'alimentador',  'Operacional de Campo')
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      display_name = EXCLUDED.display_name;
*/
