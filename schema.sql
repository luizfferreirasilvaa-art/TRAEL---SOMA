-- SOMA: Inteligência em Cronoanálise
-- Schema de Banco de Dados (Supabase/PostgreSQL)

-- Limpeza para Reinstalação (CUIDADO: Apaga dados existentes)
DROP TABLE IF EXISTS registros_cronoanalise;
DROP TABLE IF EXISTS paradas_motivos;
DROP TABLE IF EXISTS maquinas;
DROP TABLE IF EXISTS operadores;

-- 1. Tabela de Operadores
CREATE TABLE operadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Máquinas
CREATE TABLE maquinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Motivos de Parada
CREATE TABLE paradas_motivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod TEXT UNIQUE NOT NULL,
    "desc" TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('PROG', 'NÃO PROG')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela Principal: Registros de Cronoanálise
CREATE TABLE registros_cronoanalise (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data DATE NOT NULL,
    mes INTEGER,
    turno TEXT,
    cod_oper TEXT,
    desc_oper TEXT,
    cod_maq TEXT,
    desc_maq TEXT,
    h_inicio TIME,
    h_fim TIME,
    h_disponivel NUMERIC(10,4),
    h_programada NUMERIC(10,4),
    
    -- Seção Produção
    cod_peca TEXT,
    qtd NUMERIC(10,2),
    tp_padrao NUMERIC(10,4),
    h_produtiva NUMERIC(10,4),
    eficiencia NUMERIC(10,2),
    status TEXT,

    -- Seção Paradas
    cod_parada TEXT,
    desc_parada TEXT,
    h_parada NUMERIC(10,4),
    tipo_parada TEXT,
    
    tipo_registro TEXT, -- PRODUCAO ou PARADA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Configuração de RLS (Segurança)
ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE paradas_motivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_cronoanalise ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para o MVP
CREATE POLICY "Public Select Operadores" ON operadores FOR SELECT USING (true);
CREATE POLICY "Public Insert Operadores" ON operadores FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Operadores" ON operadores FOR DELETE USING (true);

CREATE POLICY "Public Select Maquinas" ON maquinas FOR SELECT USING (true);
CREATE POLICY "Public Insert Maquinas" ON maquinas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Maquinas" ON maquinas FOR DELETE USING (true);

CREATE POLICY "Public Select Paradas Motivos" ON paradas_motivos FOR SELECT USING (true);
CREATE POLICY "Public Insert Paradas Motivos" ON paradas_motivos FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Paradas Motivos" ON paradas_motivos FOR DELETE USING (true);

CREATE POLICY "Public Select Registros" ON registros_cronoanalise FOR SELECT USING (true);
CREATE POLICY "Public Insert Registros" ON registros_cronoanalise FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Registros" ON registros_cronoanalise FOR DELETE USING (true);

-- 6. Dados Iniciais de Exemplo (Seed)
INSERT INTO operadores (cod, nome) VALUES 
('OP01', 'João Silva'),
('OP02', 'Maria Oliveira'),
('OP03', 'Carlos Souza');

INSERT INTO maquinas (cod, nome) VALUES 
('MQ01', 'Prensa Hidráulica 01'),
('MQ02', 'Bobinadeira Automática'),
('MQ03', 'Célula de Solda');

INSERT INTO paradas_motivos (cod, "desc", tipo) VALUES 
('P01', 'Falta de Matéria-prima', 'NÃO PROG'),
('P02', 'Manutenção Preventiva', 'PROG'),
('P03', 'Troca de Ferramenta', 'PROG'),
('P04', 'Queda de Energia', 'NÃO PROG');
