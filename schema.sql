-- SOMA: Inteligência em Cronoanálise
-- Schema de Banco de Dados (Supabase/PostgreSQL)

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
    h_disponivel NUMERIC(5,2) DEFAULT 8.8,
    turno TEXT,
    cod_oper TEXT REFERENCES operadores(cod),
    cod_maq TEXT REFERENCES maquinas(cod),
    cod_peca TEXT NOT NULL,
    qtd NUMERIC(10,2) NOT NULL,
    tp_padrao NUMERIC(10,4) NOT NULL,
    componente TEXT, -- Manual ou Máquina
    h_produtiva NUMERIC(10,4),
    eficiencia NUMERIC(10,2),
    status TEXT, -- PADRAO, DESVIO, GARGALO, SEM_PADRAO
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Configuração de RLS (Segurança)
ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE paradas_motivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_cronoanalise ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público para o MVP (Ajuste para Auth em Produção)
CREATE POLICY "Leitura pública operadores" ON operadores FOR SELECT USING (true);
CREATE POLICY "Leitura pública maquinas" ON maquinas FOR SELECT USING (true);
CREATE POLICY "Leitura pública paradas" ON paradas_motivos FOR SELECT USING (true);
CREATE POLICY "Leitura pública registros" ON registros_cronoanalise FOR SELECT USING (true);
CREATE POLICY "Inserção pública registros" ON registros_cronoanalise FOR INSERT WITH CHECK (true);

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
