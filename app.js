// ───────── CONFIGURAÇÃO DO SUPABASE (herdado de auth.js) ─────────
// `sb` e `AUTH` são injetados por auth.js (carregado antes deste arquivo)
// Garante compatibilidade mesmo se auth.js ainda não rodou
if (typeof sb === 'undefined') {
  const _url = 'https://ccytzaruxdbtqqblpciq.supabase.co';
  const _key = 'sb_publishable_IowVi8PFf6gDSzjpC8EgQA_sFzzkvsv';
  window.sb = supabase.createClient(_url, _key);
}

// ───────── ESTADO GLOBAL ─────────
let STATE = {
  operadores: [],
  maquinas: [],
  paradas: [],
  setores: [],
  empresas: [],
  registros: []
};

// ───────── INICIALIZAÇÃO ─────────
window.onload = async () => {
  // 1. Verificar autenticação (redireciona para login.html se não logado)
  const authenticated = await AUTH.init();
  if (!authenticated) return;

  showToast('Sincronizando com a base de dados de tempos...', 'ok');
  await loadConfig();
  await loadData();
  renderAll();

  // 2. Aplicar regras de acesso baseadas no perfil
  AUTH.applyRBAC();

  // 3. Verificação de tema salvo
  if (localStorage.getItem('soma-theme') === 'light') {
    document.body.classList.add('light-theme');
  }
};

async function loadConfig() {
  try {
    const [
      { data: opers },
      { data: maqs },
      { data: pars },
      { data: sets },
      { data: emps }
    ] = await Promise.all([
      sb.from('operadores').select('*').order('nome'),
      sb.from('maquinas').select('*').order('nome'),
      sb.from('paradas_motivos').select('*').order('descricao'),
      sb.from('setores').select('*').order('descricao'),
      sb.from('empresas').select('*').order('descricao')
    ]);

    STATE.operadores = opers || [];
    STATE.maquinas = maqs || [];
    STATE.paradas = pars || [];
    STATE.setores = sets || [];
    STATE.empresas = emps || [];

    // Preencher Selects no Digitador
    const fOper = document.getElementById('f-codoper');
    if (fOper) fOper.innerHTML = '<option value="">Selecione</option>' + STATE.operadores.map(o => `<option value="${o.cod}">${o.cod} - ${o.nome}</option>`).join('');

    const fMaq = document.getElementById('f-codmaq');
    if (fMaq) fMaq.innerHTML = '<option value="">Selecione</option>' + STATE.maquinas.map(m => `<option value="${m.cod}">${m.cod} - ${m.nome}</option>`).join('');

    const fSetor = document.getElementById('f-codsetor');
    if (fSetor) fSetor.innerHTML = '<option value="">Selecione</option>' + STATE.setores.map(s => `<option value="${s.cod}">${s.cod} - ${s.descricao}</option>`).join('');

    const fEmpresa = document.getElementById('f-empresa');
    if (fEmpresa) fEmpresa.innerHTML = '<option value="">Selecione</option>' + STATE.empresas.map(e => `<option value="${e.cod}">${e.cod} - ${e.descricao}</option>`).join('');

    // Preencher Selects de Filtro no Banco de Dados e Dashboard
    const dbFilterOper = document.getElementById('filter-oper');
    if (dbFilterOper) dbFilterOper.innerHTML = '<option value="">Todos Operadores</option>' + STATE.operadores.map(o => `<option value="${o.cod}">${o.nome}</option>`).join('');

    const dbFilterSetor = document.getElementById('filter-setor');
    if (dbFilterSetor) dbFilterSetor.innerHTML = '<option value="">Todos Setores</option>' + STATE.setores.map(s => `<option value="${s.cod}">${s.descricao}</option>`).join('');

    const dashFilterSetor = document.getElementById('dash-filter-setor');
    if (dashFilterSetor) dashFilterSetor.innerHTML = '<option value="">Todos Setores</option>' + STATE.setores.map(s => `<option value="${s.cod}">${s.descricao}</option>`).join('');

    const dashFilterEmpresa = document.getElementById('dash-filter-empresa');
    if (dashFilterEmpresa) dashFilterEmpresa.innerHTML = '<option value="">Todas Empresas</option>' + STATE.empresas.map(e => `<option value="${e.cod}">${e.descricao}</option>`).join('');

    // Particular
    const partOper = document.getElementById('particular-oper');
    if (partOper) partOper.innerHTML = '<option value="">— Selecione um operador —</option>' + STATE.operadores.map(o => `<option value="${o.cod}">${o.nome}</option>`).join('');
  } catch (err) {
    showToast('Erro ao carregar configurações de campo', 'err');
  }
}

async function loadData() {
  try {
    const { data: regs } = await sb.from('registros_cronoanalise')
      .select('*')
      .order('data', { ascending: false });
    STATE.registros = regs || [];
  } catch (err) {
    showToast('Erro ao acessar base de dados de tempos', 'err');
  }
}

function fillSelects() {
  // Mantido para compatibilidade histórica, agora consolidado em loadConfig
}

// ───────── ALTERNÂNCIA DE TEMA ─────────
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('soma-theme', isLight ? 'light' : 'dark');
}

// ───────── NAVEGAÇÃO ENTRE PÁGINAS ─────────
function setPage(p) {
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nv => nv.classList.remove('active'));
  
  const page = document.getElementById('page-' + p);
  if (page) page.classList.add('active');
  
  const nav = document.getElementById('nav-' + p);
  if (nav) nav.classList.add('active');
  
  document.getElementById('page-title').textContent = {
    dashboard: 'Dashboard Operacional',
    digitador: 'Digitador',
    banco: 'Base de Dados de Tempos',
    paradas: 'Análise de Paradas',
    particular: 'Análise Particular',
    config: 'Configurações',
    auditoria: 'Últimas Alterações'
  }[p] || p;

  if (p === 'banco') renderDatabase();
  if (p === 'paradas') renderParadas();
  if (p === 'config') renderConfigTable();
  if (p === 'particular') renderParticular();
  if (p === 'auditoria') renderAuditoria();
}

function renderDatabase() {
  const list = document.getElementById('db-body');
  if (!list) return;

  const fPeca = document.getElementById('filter-peca').value.toLowerCase();
  const fOper = document.getElementById('filter-oper').value;
  const fSetor = document.getElementById('filter-setor')?.value || '';
  const fData = document.getElementById('filter-data').value;

  const filtered = STATE.registros.filter(r => {
    const mPeca = !fPeca || (r.cod_peca && r.cod_peca.toLowerCase().includes(fPeca));
    const mOper = !fOper || r.cod_oper === fOper;
    const mSetor = !fSetor || r.cod_setor === fSetor;
    const mData = !fData || r.data === fData;
    return mPeca && mOper && mSetor && mData;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px;">Nenhum registro encontrado com estes filtros.</td></tr>';
    return;
  }

  // Botão excluir/editar: visível apenas para programador e coordenador
  const canDelete = AUTH.isMinCoordenador();

  list.innerHTML = filtered.map(r => `
    <tr>
      <td>${new Date(r.data).toLocaleDateString('pt-BR')}</td>
      <td>${r.cod_oper}</td>
      <td>${r.cod_maq}</td>
      <td>${r.cod_peca || '-'}</td>
      <td>${r.qtd || 0}</td>
      <td>${r.tipo_registro === 'PRODUCAO' ? (r.eficiencia ? r.eficiencia.toFixed(1)+'%' : '-') : '-'}</td>
      <td><span class="status-badge ${getStatusClass(r.eficiencia)}">${r.tipo_registro}</span></td>
      <td>${canDelete ? `<button class="btn btn-warning btn-sm" onclick="editRegistro('${r.id}')" style="margin-right:5px;background:transparent;border:none;cursor:pointer;font-size:14px;" title="Editar">✏️</button><button class="btn btn-danger btn-sm" data-rbac="delete-btn" onclick="delRegistro('${r.id}')">Excluir</button>` : '<span style="color:var(--text-muted);font-size:12px;">—</span>'}</td>
    </tr>
  `).join('');
}

async function editRegistro(id) {
  const r = STATE.registros.find(x => x.id === id);
  if (!r) return;
  const opt = prompt(`O que deseja alterar em ${r.tipo_registro}?
1 - Código (Peça ou Parada)
2 - Valor (Quantidade ou Horas)
3 - Observação / Título da Parada`, '1');
  
  if (!opt) return;

  let field, val;
  if (opt === '1') {
    field = r.tipo_registro === 'PRODUCAO' ? 'cod_peca' : 'cod_parada';
    val = prompt(`Novo código:`, r[field]);
    if (val) val = val.toUpperCase();
  } else if (opt === '2') {
    field = r.tipo_registro === 'PRODUCAO' ? 'qtd' : 'h_parada';
    val = prompt(`Novo valor para ${field}:`, r[field]);
    if (val !== null) val = parseFloat(val);
  } else if (opt === '3') {
    field = r.tipo_registro === 'PRODUCAO' ? 'classe_equipamento' : 'desc_parada';
    val = prompt(`Nova descrição / observação / classe:`, r[field]);
  }

  if (field && val !== null && !isNaN(val) || (field && val !== null && isNaN(val))) {
    const payload = { [field]: val };
    
    // Recalcular horas produtivas e eficiência se for PRODUCÃO e mudar qtd
    if (r.tipo_registro === 'PRODUCAO' && field === 'qtd') {
       const hProd = r.tp_padrao > 0 ? val / r.tp_padrao : 0;
       payload.h_produtiva = hProd;
       if (r.h_programada > 0) {
          payload.eficiencia = (hProd / r.h_programada) * 100;
       }
    }

    const { error } = await sb.from('registros_cronoanalise').update(payload).eq('id', id);
    if (!error) {
      showToast('Registro alterado!', 'ok');
      await loadData();
      renderAll();
      if (document.getElementById('page-banco')?.classList.contains('active')) renderDatabase();
      if (document.getElementById('page-particular')?.classList.contains('active')) renderParticular();
    } else {
      showToast('Erro ao alterar: ' + error.message, 'err');
    }
  }
}

function getStatusClass(efic) {
  if (!efic) return '';
  if (efic >= 95) return 'status-padrao';
  if (efic >= 80) return 'status-desvio';
  return 'status-gargalo';
}

async function delRegistro(id) {
  if (!confirm('Excluir este registro permanentemente?')) return;
  const { error, count } = await sb.from('registros_cronoanalise').delete({ count: 'exact' }).eq('id', id);
  if (error) {
    showToast('Erro ao excluir: ' + error.message, 'error');
    return;
  }
  if (count === 0) {
    showToast('Permissão negada ou registro não encontrado.', 'error');
    return;
  }
  showToast('Registro excluído!', 'ok');
  await loadData();
  renderAll();
  renderDatabase();
}

function clearFilters() {
  document.getElementById('filter-peca').value = '';
  document.getElementById('filter-oper').value = '';
  const fSetor = document.getElementById('filter-setor');
  if (fSetor) fSetor.value = '';
  document.getElementById('filter-data').value = '';
  renderDatabase();
}

let charts = { tipo: null, motivos: null };

function renderParadas() {
  const paradas = STATE.registros.filter(r => r.tipo_registro === 'PARADA');
  const tbody = document.getElementById('paradas-detail-body');
  
  if (tbody) {
    tbody.innerHTML = paradas.length === 0 
      ? '<tr><td colspan="4" style="text-align:center; padding:20px;">Nenhuma parada registrada.</td></tr>'
      : paradas.map(p => `
      <tr>
        <td>${new Date(p.data).toLocaleDateString('pt-BR')}</td>
        <td><strong>${p.cod_parada}</strong> - ${p.desc_parada}</td>
        <td>${(p.h_parada || 0).toFixed(2)}h</td>
        <td><span class="status-badge ${p.tipo_parada === 'PROG' ? 'status-padrao' : 'status-gargalo'}">${p.tipo_parada}</span></td>
      </tr>
    `).join('');
  }

  // Processar gráficos de paradas
  const ctxTipo = document.getElementById('chart-tipo');
  const ctxMot = document.getElementById('chart-motivos');
  
  if (!ctxTipo || !ctxMot) return;

  // Agrupamento por tipo de parada
  const prog = paradas.filter(p => p.tipo_parada === 'PROG').reduce((s,p) => s + (p.h_parada || 0), 0);
  const nprog = paradas.filter(p => p.tipo_parada === 'NÃO PROG').reduce((s,p) => s + (p.h_parada || 0), 0);

  if (charts.tipo) charts.tipo.destroy();
  charts.tipo = new Chart(ctxTipo, {
    type: 'doughnut',
    data: {
      labels: ['PROG', 'NÃO PROG'],
      datasets: [{
        data: [prog, nprog],
        backgroundColor: ['#00f2c3', '#ff4d6d'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#8b949e' } } }
    }
  });

  // Agrupamento por motivo (Top 5)
  const motMap = {};
  paradas.forEach(p => {
    const key = p.desc_parada || 'Não informado';
    motMap[key] = (motMap[key] || 0) + (p.h_parada || 0);
  });
  const sortedMot = Object.entries(motMap).sort((a,b) => b[1] - a[1]).slice(0, 5);

  if (charts.motivos) charts.motivos.destroy();
  charts.motivos = new Chart(ctxMot, {
    type: 'bar',
    data: {
      labels: sortedMot.map(x => x[0].substring(0, 15)),
      datasets: [{
        label: 'Horas',
        data: sortedMot.map(x => x[1]),
        backgroundColor: '#4d94ff',
        borderRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
        y: { grid: { display: false }, ticks: { color: '#8b949e' } }
      }
    }
  });
}

// ───────── GERENCIAMENTO DE CONFIGURAÇÕES (REGRA 1.4) ─────────
async function renderConfigTable() {
  const lOper = document.getElementById('list-oper');
  const lMaq = document.getElementById('list-maq');
  const lPar = document.getElementById('list-parada-motivos');
  const lSet = document.getElementById('list-setores');
  const lEmp = document.getElementById('list-empresas');

  if (lOper) {
    lOper.innerHTML = STATE.operadores.map(o => `
      <div class="config-row">
        <span><strong>${o.cod}</strong> - ${o.nome}</span>
        <div>
          ${AUTH.isMinCoordenador() ? `<button class="btn-edit" style="background:transparent;border:none;cursor:pointer;margin-right:10px;font-size:14px;" onclick="editConfig('operadores', '${o.id}', '${o.nome}', 'nome')" title="Editar">✏️</button>` : ''}
          <button class="btn-del" onclick="removeConfig('operadores', '${o.id}')">×</button>
        </div>
      </div>
    `).join('');
  }
  if (lMaq) {
    lMaq.innerHTML = STATE.maquinas.map(m => `
      <div class="config-row">
        <span><strong>${m.cod}</strong> - ${m.nome}</span>
        <div>
          ${AUTH.isMinCoordenador() ? `<button class="btn-edit" style="background:transparent;border:none;cursor:pointer;margin-right:10px;font-size:14px;" onclick="editConfig('maquinas', '${m.id}', '${m.nome}', 'nome')" title="Editar">✏️</button>` : ''}
          <button class="btn-del" onclick="removeConfig('maquinas', '${m.id}')">×</button>
        </div>
      </div>
    `).join('');
  }
  if (lPar) {
    lPar.innerHTML = STATE.paradas.map(p => `
      <div class="config-row">
        <span><strong>${p.cod}</strong> - ${p.descricao} <small>(${p.tipo})</small></span>
        <div>
          ${AUTH.isMinCoordenador() ? `<button class="btn-edit" style="background:transparent;border:none;cursor:pointer;margin-right:10px;font-size:14px;" onclick="editConfig('paradas_motivos', '${p.id}', '${p.descricao}', 'descricao')" title="Editar">✏️</button>` : ''}
          <button class="btn-del" onclick="removeConfig('paradas_motivos', '${p.id}')">×</button>
        </div>
      </div>
    `).join('');
  }
  if (lSet) {
    lSet.innerHTML = STATE.setores.length === 0
      ? '<p style="color:var(--muted);font-size:13px;"><em>Nenhum setor cadastrado.</em></p>'
      : STATE.setores.map(s => `
      <div class="config-row">
        <span><strong>${s.cod}</strong> - ${s.descricao}${s.meta ? ' <span style="color:var(--accent);font-size:12px;margin-left:8px;">Meta: <strong>${s.meta}%</strong></span>' : ''}</span>
        <div>
          ${AUTH.isMinCoordenador() ? `<button class="btn-edit" style="background:transparent;border:none;cursor:pointer;margin-right:10px;font-size:14px;" onclick="editConfig('setores', '${s.id}', '${s.descricao}', 'descricao')" title="Editar">✏️</button>` : ''}
          <button class="btn-del" onclick="removeConfig('setores', '${s.id}')">×</button>
        </div>
      </div>
    `).join('');
  }
  if (lEmp) {
    lEmp.innerHTML = STATE.empresas.length === 0
      ? '<p style="color:var(--muted);font-size:13px;"><em>Nenhuma empresa cadastrada.</em></p>'
      : STATE.empresas.map(e => `
      <div class="config-row">
        <span><strong>${e.cod}</strong> - ${e.descricao}</span>
        <div>
          ${AUTH.isMinCoordenador() ? `<button class="btn-edit" style="background:transparent;border:none;cursor:pointer;margin-right:10px;font-size:14px;" onclick="editConfig('empresas', '${e.id}', '${e.descricao}', 'descricao')" title="Editar">✏️</button>` : ''}
          <button class="btn-del" onclick="removeConfig('empresas', '${e.id}')">×</button>
        </div>
      </div>
    `).join('');
  }
}

async function editConfig(table, id, currentVal, fieldName) {
  const newVal = prompt(`Editar ${fieldName}:`, currentVal);
  if (newVal !== null && newVal.trim() !== '') {
    const payload = {};
    payload[fieldName] = newVal.toUpperCase();
    const { error } = await sb.from(table).update(payload).eq('id', id);
    if (!error) {
      showToast('Alterado com sucesso!', 'ok');
      await loadConfig();
      renderConfigTable();
    } else {
      showToast('Erro ao alterar: ' + error.message, 'err');
    }
  }
}

async function addConfig(type) {
  let table = '';
  let payload = {};

  if (type === 'oper') {
    table = 'operadores';
    payload = {
      cod: document.getElementById('new-oper-cod').value,
      nome: document.getElementById('new-oper-nome').value.toUpperCase()
    };
  } else if (type === 'maq') {
    table = 'maquinas';
    payload = { cod: document.getElementById('new-maq-cod').value, nome: document.getElementById('new-maq-nome').value.toUpperCase() };
  } else if (type === 'par') {
    table = 'paradas_motivos';
    payload = { 
      cod: document.getElementById('new-par-cod').value, 
      descricao: document.getElementById('new-par-desc').value.toUpperCase(),
      tipo: document.getElementById('new-par-tipo').value
    };
  } else if (type === 'set') {
    table = 'setores';
    payload = {
      cod: document.getElementById('new-set-cod').value,
      descricao: document.getElementById('new-set-desc').value.toUpperCase(),
      meta: parseFloat(document.getElementById('new-set-meta').value) || null
    };
  } else if (type === 'emp') {
    table = 'empresas';
    payload = {
      cod: document.getElementById('new-emp-cod').value,
      descricao: document.getElementById('new-emp-desc').value.toUpperCase()
    };
  }

  if (!payload.cod) {
    showToast('Informe ao menos o código!', 'err');
    return;
  }

  const { error } = await sb.from(table).insert([payload]);
  if (error) {
    showToast('Erro ao salvar: ' + (error.message || error.code || 'verifique o Supabase'), 'err');
    console.error('[addConfig] Erro Supabase:', error);
  } else {
    showToast('Configuração salva com sucesso!', 'ok');
    await loadConfig();
    renderConfigTable();
    // Limpar campos do formulário
    if (type === 'oper') { document.getElementById('new-oper-cod').value=''; document.getElementById('new-oper-nome').value=''; }
    if (type === 'maq') { document.getElementById('new-maq-cod').value=''; document.getElementById('new-maq-nome').value=''; }
    if (type === 'par') { document.getElementById('new-par-cod').value=''; document.getElementById('new-par-desc').value=''; }
    if (type === 'set') { document.getElementById('new-set-cod').value=''; document.getElementById('new-set-desc').value=''; document.getElementById('new-set-meta').value=''; }
    if (type === 'emp') { document.getElementById('new-emp-cod').value=''; document.getElementById('new-emp-desc').value=''; }
  }
}

async function removeConfig(table, id) {
  if (!confirm('Deseja realmente remover esta configuração?')) return;
  const { error, count } = await sb.from(table).delete({ count: 'exact' }).eq('id', id);
  
  if (error) {
    showToast('Erro ao remover configuração', 'err');
  } else if (count === 0) {
    showToast('Permissão negada ou configuração não encontrada.', 'err');
  } else {
    showToast('Configuração removida!', 'ok');
    await loadConfig();
    renderConfigTable();
  }
}



// ───────── LIMPEZA DA BASE DE DADOS (REGRA 5) ─────────
function confirmClear() {
  document.getElementById('modal-clear').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-clear').classList.remove('active');
}



// ───────── LÓGICA DE CÁLCULO PRINCIPAL (REGRA 1.1) ─────────
function calculateEfficiency(real, pattern) {
  if (!pattern || pattern === 0) return 0;
  return (real / pattern) * 100;
}

function getStatusLabel(efic) {
  if (efic === 0) return '<span class="status-tag">[SEM PADRÃO DEFINIDO]</span>';
  if (efic >= 95) return '<span class="status-tag status-padrão">[DENTRO DO PADRÃO]</span>';
  if (efic >= 80) return '<span class="status-tag status-desvio">[DESVIO MODERADO]</span>';
  return '<span class="status-tag status-gargalo">[GARGALO CRÍTICO]</span>';
}

// ───────── AUXILIARES DE INTERFACE ─────────
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => t.className = '', 3000);
}

// ───────── LÓGICA DO DIGITADOR ─────────
function updateMonth() {
  const dateStr = document.getElementById('f-data').value;
  if (dateStr) {
    const d = new Date(dateStr);
    document.getElementById('f-mes').value = d.getUTCMonth() + 1;
  }
}

function calcTurnHours() {
  const start = document.getElementById('f-h-inicio').value;
  const end = document.getElementById('f-h-fim').value;
  if (start && end) {
    const s = start.split(':');
    const e = end.split(':');
    const diff = (parseInt(e[0]) + parseInt(e[1])/60) - (parseInt(s[0]) + parseInt(s[1])/60);
    document.getElementById('f-hdisp').value = Math.max(0, diff).toFixed(2);
    calcResumo();
  }
}

function addPecaRow() {
  const tbody = document.getElementById('pecas-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="ex: 3185" class="peca-cod"></td>
    <td><input type="number" value="0" class="peca-qtd" oninput="calcResumo()"></td>
    <td><input type="number" value="0.00" step="0.01" class="peca-padrao" oninput="calcResumo()"></td>
    <td class="row-hprod">0.0000</td>
    <td><input type="number" value="0.000" step="0.001" class="peca-kwa" oninput="calcResumo()"></td>
    <td class="row-kwa-medio">0.000</td>
    <td><input type="text" placeholder="ex: A" class="peca-classe" style="width:70px;"></td>
    <td><button class="btn-del" onclick="this.parentElement.parentElement.remove(); calcResumo();">×</button></td>
  `;
  tbody.appendChild(tr);
}

function addParadaRow() {
  const tbody = document.getElementById('paradas-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="parada-cod" onchange="fillParadaRow(this)">
        <option value="">-</option>
        ${STATE.paradas.map(p => `<option value="${p.cod}">${p.cod}</option>`).join('')}
      </select>
    </td>
    <td><input type="text" class="parada-desc" readonly></td>
    <td><input type="number" value="0.00" step="0.01" class="parada-horas" oninput="calcResumo()"></td>
    <td><input type="text" class="parada-tipo" readonly></td>
    <td><button class="btn-del" onclick="this.parentElement.parentElement.remove(); calcResumo();">×</button></td>
  `;
  tbody.appendChild(tr);
}

function fillParadaRow(el) {
  const tr = el.parentElement.parentElement;
  const cod = el.value;
  const p = STATE.paradas.find(x => x.cod === cod);
  tr.querySelector('.parada-desc').value = p ? p.descricao : '';
  tr.querySelector('.parada-tipo').value = p ? p.tipo : '';
  calcResumo();
}

function addObsRow() {
  const tbody = document.getElementById('obs-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Título (Ex: Atraso, Destaque...)" class="obs-titulo" style="width:100%;"></td>
    <td><input type="text" placeholder="Descrição detalhada da observação" class="obs-desc" style="width:100%;"></td>
    <td><button class="btn-del" onclick="this.parentElement.parentElement.remove();">×</button></td>
  `;
  tbody.appendChild(tr);
}

function calcResumo() {
  // Cálculo de produção
  let totalQtd = 0;
  let totalHProd = 0;
  document.querySelectorAll('#pecas-body tr').forEach(tr => {
    const qtd = parseFloat(tr.querySelector('.peca-qtd').value) || 0;
    const pad = parseFloat(tr.querySelector('.peca-padrao').value) || 0;
    const hProd = pad > 0 ? qtd / pad : 0;
    const kwa = parseFloat(tr.querySelector('.peca-kwa')?.value) || 0;
    const kwaM = qtd > 0 ? kwa / qtd : 0;
    tr.querySelector('.row-hprod').textContent = hProd.toFixed(4);
    if (tr.querySelector('.row-kwa-medio')) tr.querySelector('.row-kwa-medio').textContent = kwaM.toFixed(3);
    totalQtd += qtd;
    totalHProd += hProd;
  });

  // Cálculo de paradas
  let totalHPar = 0;
  document.querySelectorAll('#paradas-body tr').forEach(tr => {
    const h = parseFloat(tr.querySelector('.parada-horas').value) || 0;
    totalHPar += h;
  });

  const hDisp = parseFloat(document.getElementById('f-hdisp').value) || 0;
  const hProg = parseFloat(document.getElementById('f-hprog').value) || 0;
  const hTrab = Math.max(0, hProg - totalHPar);
  const efic = hTrab > 0 ? (totalHProd / hTrab) * 100 : 0;
  const util = hProg > 0 ? (hTrab / hProg) * 100 : 0;

  document.getElementById('res-qtd').textContent = totalQtd;
  document.getElementById('res-hprod').textContent = totalHProd.toFixed(4);
  document.getElementById('res-hpar').textContent = totalHPar.toFixed(4);
  document.getElementById('res-htrab').textContent = hTrab.toFixed(4);
  document.getElementById('res-efic').textContent = efic.toFixed(1) + '%';
  document.getElementById('res-util').textContent = util.toFixed(1) + '%';
}


async function saveRegisto() {
  const data = document.getElementById('f-data').value;
  const mes = document.getElementById('f-mes').value;
  const turno = document.getElementById('f-turno').value;
  const codOper = document.getElementById('f-codoper').value;
  const descOper = document.getElementById('f-descoper').value;
  const codMaq = document.getElementById('f-codmaq').value;
  const descMaq = document.getElementById('f-descmaq').value;
  const codSetor = document.getElementById('f-codsetor').value;
  const descSetor = STATE.setores.find(s => s.cod === codSetor)?.descricao || '';
  const codEmpresa = document.getElementById('f-empresa').value;
  const descEmpresa = STATE.empresas.find(e => e.cod === codEmpresa)?.descricao || '';
  const hInicio = document.getElementById('f-h-inicio').value;
  const hFim = document.getElementById('f-h-fim').value;
  const hDisp = document.getElementById('f-hdisp').value;
  const hProg = parseFloat(document.getElementById('f-hprog').value) || 0;

  if (!data || !codOper || !codMaq) {
    showToast('Atenção: Cabeçalho incompleto!', 'err');
    return;
  }

  const pecaRows = document.querySelectorAll('#pecas-body tr');
  const paradaRows = document.querySelectorAll('#paradas-body tr');
  const obsRows = document.querySelectorAll('#obs-body tr');

  if (pecaRows.length === 0 && paradaRows.length === 0 && obsRows.length === 0) {
    showToast('Adicione ao menos um registro!', 'err');
    return;
  }

  // Pré-cálculo das horas de parada para eficiência correta (REGRA 1.1)
  let totalHPar = 0;
  paradaRows.forEach(tr => {
    totalHPar += parseFloat(tr.querySelector('.parada-horas').value) || 0;
  });
  const hTrab = Math.max(0, hProg - totalHPar);

  const base = {
    data,
    mes: parseInt(mes) || null,
    turno,
    cod_oper: codOper,
    desc_oper: descOper,
    cod_maq: codMaq,
    desc_maq: descMaq,
    cod_setor: codSetor || null,
    desc_setor: descSetor || null,
    cod_empresa: codEmpresa || null,
    desc_empresa: descEmpresa || null,
    h_inicio: hInicio || null,
    h_fim: hFim || null,
    h_disponivel: parseFloat(hDisp) || 0,
    h_programada: hProg,
    // Auditoria de quem salvou
    created_by_name: (typeof AUTH !== 'undefined' && AUTH.name) ? AUTH.name : 'Sistema',
    created_by_role: (typeof AUTH !== 'undefined' && AUTH.role) ? AUTH.role : 'desconhecido',
    created_by_uid:  (typeof AUTH !== 'undefined' && AUTH.user) ? AUTH.user.id : null
  };

  const records = [];

  // Linhas de produção — eficiência usa hTrab (horas líquidas produtivas)
  pecaRows.forEach(tr => {
    const qtd = parseFloat(tr.querySelector('.peca-qtd').value) || 0;
    const pad = parseFloat(tr.querySelector('.peca-padrao').value) || 0;
    const hProd = pad > 0 ? qtd / pad : 0;
    const kwa = parseFloat(tr.querySelector('.peca-kwa')?.value) || 0;
    records.push({
      ...base,
      cod_peca: tr.querySelector('.peca-cod').value,
      qtd,
      tp_padrao: pad,
      h_produtiva: hProd,
      eficiencia: hTrab > 0 ? (hProd / hTrab) * 100 : 0,
      kwa_total: kwa,
      kwa_medio: qtd > 0 ? kwa / qtd : 0,
      classe_equipamento: tr.querySelector('.peca-classe')?.value || null,
      tipo_registro: 'PRODUCAO'
    });
  });

  // Linhas de parada
  paradaRows.forEach(tr => {
    records.push({
      ...base,
      cod_parada: tr.querySelector('.parada-cod').value,
      desc_parada: tr.querySelector('.parada-desc').value,
      h_parada: parseFloat(tr.querySelector('.parada-horas').value) || 0,
      tipo_parada: tr.querySelector('.parada-tipo').value,
      tipo_registro: 'PARADA'
    });
  });

  // Linhas de observação
  obsRows.forEach(tr => {
    const titulo = tr.querySelector('.obs-titulo').value;
    const desc = tr.querySelector('.obs-desc').value;
    if (titulo || desc) {
      records.push({
        ...base,
        cod_parada: titulo, // Reutilizando para título
        desc_parada: desc,  // Reutilizando para descrição
        tipo_registro: 'OBSERVACAO'
      });
    }
  });

  const { error } = await sb.from('registros_cronoanalise').insert(records);
  if (error) {
    showToast('Erro ao salvar: ' + error.message, 'err');
  } else {
    showToast('Registro do turno salvo com sucesso!', 'ok');
    clearForm();
    await loadData();
    renderAll();
    if (document.getElementById('page-banco')?.classList.contains('active')) {
      renderDatabase();
    }
  }
}


function clearForm() {
  document.getElementById('pecas-body').innerHTML = '';
  document.getElementById('paradas-body').innerHTML = '';
  document.getElementById('obs-body').innerHTML = '';
  document.getElementById('f-h-inicio').value = '';
  document.getElementById('f-h-fim').value = '';
  addPecaRow();
  calcResumo();
}

function clearDashFilters() {
  const fSetor = document.getElementById('dash-filter-setor');
  if (fSetor) fSetor.value = '';
  const fTurno = document.getElementById('dash-filter-turno');
  if (fTurno) fTurno.value = '';
  const fEmpresa = document.getElementById('dash-filter-empresa');
  if (fEmpresa) fEmpresa.value = '';
  renderAll();
}

// ───────── DASHBOARD (REGRA 4) ─────────
function renderAll() {
  const dsSetor = document.getElementById('dash-filter-setor')?.value;
  const dsTurno = document.getElementById('dash-filter-turno')?.value;
  const dsEmpresa = document.getElementById('dash-filter-empresa')?.value;

  // Filtragem dos registros baseada na barra do Dashboard
  let filteredRecords = STATE.registros;
  if (dsSetor) filteredRecords = filteredRecords.filter(r => r.cod_setor === dsSetor);
  if (dsTurno) filteredRecords = filteredRecords.filter(r => r.turno === dsTurno);
  if (dsEmpresa) filteredRecords = filteredRecords.filter(r => r.cod_empresa === dsEmpresa);

  if (filteredRecords.length === 0) {
    document.getElementById('kpi-efic-global').textContent = '0%';
    document.getElementById('kpi-qtd-total').textContent = '0';
    document.getElementById('kpi-residual').textContent = '0h';
    document.getElementById('kpi-gargalos').textContent = '0';
    document.getElementById('parecer-consultivo').innerHTML = '<em>Nenhum registro encontrado com os filtros aplicados.</em>';
    return;
  }

  const pecas = filteredRecords.filter(r => r.tipo_registro === 'PRODUCAO');
  const paradas = filteredRecords.filter(r => r.tipo_registro === 'PARADA');

  // Cálculo KPI
  const totalProduced = pecas.reduce((sum, p) => sum + (parseFloat(p.qtd) || 0), 0);
  const totalHProd = pecas.reduce((sum, p) => sum + (parseFloat(p.h_produtiva) || 0), 0);
  const totalHDisp = filteredRecords.reduce((max, r) => Math.max(max, r.h_disponivel || 0), 0) || 8.8;
  const residual = Math.max(0, totalHDisp - totalHProd);
  
  const recordsWithPattern = pecas.filter(r => r.tp_padrao > 0);
  const avgEfic = recordsWithPattern.length > 0 ? 
    recordsWithPattern.reduce((sum, r) => sum + (r.eficiencia || 0), 0) / recordsWithPattern.length : 0;
  
  document.getElementById('kpi-efic-global').textContent = avgEfic.toFixed(1) + '%';
  document.getElementById('kpi-qtd-total').textContent = totalProduced;
  document.getElementById('kpi-residual').textContent = residual.toFixed(2) + 'h';
  
  const gargalosCount = STATE.registros.filter(r => r.tipo_registro === 'PRODUCAO' && (r.eficiencia || 0) < 80).length;
  document.getElementById('kpi-gargalos').textContent = gargalosCount;

  // Regra 4: Resumo Executivo
  const parecer = document.getElementById('parecer-consultivo');
  const worst = [...STATE.registros].filter(r => r.tp_padrao > 0).sort((a,b) => a.eficiencia - b.eficiencia)[0];
  
  if (worst) {
    const status = avgEfic >= 95 ? '[DENTRO DO PADRÃO]' : (avgEfic >= 80 ? '[DESVIO MODERADO]' : '[GARGALO CRÍTICO]');
    const color = avgEfic >= 95 ? 'var(--success)' : (avgEfic >= 80 ? 'var(--warn)' : 'var(--danger)');
    
    parecer.innerHTML = `
      <p style="font-weight:600; color:${color}; margin-bottom:12px;">${status} - Saúde do processo operacional em ${(avgEfic).toFixed(1)}% de eficiência.</p>
      <div style="font-size:13px; border-left:3px solid ${color}; padding-left:12px;">
        <strong>Desvio Identificado:</strong> Peça <em>${worst.cod_peca}</em> com performance de ${worst.eficiencia.toFixed(1)}%.<br>
        <strong>Causa Provável:</strong> ${worst.eficiencia < 80 ? 'Fadiga excessiva ou gargalo de método.' : 'Ritmo abaixo da média.'}<br>
        <strong>Sugestão:</strong> Revalidar ergonomia e fluxo de materiais.
      </div>
    `;
  }

  // Regra 4: Tabela Comparativa
  const tableComp = document.getElementById('table-comparativa');
  const latestProd = STATE.registros.filter(r => r.tipo_registro === 'PRODUCAO').slice(0, 5);
  if (latestProd.length > 0) {
    tableComp.innerHTML = latestProd.map(r => `
      <tr>
        <td>${r.cod_peca}</td>
        <td>${(r.h_produtiva * 1.1).toFixed(2)}</td> 
        <td>${(r.h_produtiva * 1.05).toFixed(2)}</td>
        <td>${(r.tp_padrao || 0).toFixed(2)}</td>
      </tr>
    `).join('');
  }

  // Regra 4: Ganhos e Alertas
  const ganhos = document.getElementById('ganhos-alertas');
  ganhos.innerHTML = `
    <div class="config-row" style="border-left:3px solid var(--success)">
      <span>[GANHO] Redução de tempo residual em processos de Bobinagem.</span>
    </div>
    <div class="config-row" style="border-left:3px solid var(--danger)">
      <span>[ALERTA] ${gargalosCount} gargalos críticos identificados no turno.</span>
    </div>
  `;

  // Regra 4: Projeção de Entrega
  const proj = document.getElementById('projecao-entrega');
  const remTime = Math.max(0, 8.8 - totalHProd); // Tempo restante no turno
  const estimated = Math.floor(avgEfic > 0 ? (totalProduced / (totalHProd || 1)) * remTime : 0);
  proj.innerHTML = `<strong>${estimated} peças</strong> estimadas para o restante do turno baseado no ritmo atual.`;
}

function fillOper() {
  const cod = document.getElementById('f-codoper').value;
  const o = STATE.operadores.find(x => x.cod === cod);
  document.getElementById('f-descoper').value = o ? o.nome : '';
}

function fillMaq() {
  const cod = document.getElementById('f-codmaq').value;
  const m = STATE.maquinas.find(x => x.cod === cod);
  document.getElementById('f-descmaq').value = m ? m.nome : '';
}

function fillSetor() {
  const cod = document.getElementById('f-codsetor').value;
  const s = STATE.setores.find(x => x.cod === cod);
  document.getElementById('f-descsetor').value = s ? s.descricao : '';
}

function exportCSV() {
  if (STATE.registros.length === 0) return;
  const headers = Object.keys(STATE.registros[0]).join(',');
  const rows = STATE.registros.map(r =>
    Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', 'soma_data.csv');
  a.click();
}

async function simulateData() {
  const opers = STATE.operadores.length > 0 ? STATE.operadores : [{cod:'OP01', nome:'João Silva'}];
  const maqs = STATE.maquinas.length > 0 ? STATE.maquinas : [{cod:'MQ01', nome:'Prensa'}];
  const motives = STATE.paradas.length > 0 ? STATE.paradas : [{cod:'P01', descricao:'Manutenção', tipo:'PROG'}];
  
  const records = [];
  const today = new Date().toISOString().split('T')[0];
  
  // 10 Paradas simuladas
  for(let i=0; i<10; i++) {
    const op = opers[Math.floor(Math.random() * opers.length)];
    const mq = maqs[Math.floor(Math.random() * maqs.length)];
    const mot = motives[Math.floor(Math.random() * motives.length)];
    const duration = (Math.random() * 1.2 + 0.1).toFixed(2);
    
    records.push({
      data: today, turno: 'D', cod_oper: op.cod, desc_oper: op.nome,
      cod_maq: mq.cod, desc_maq: mq.nome, tipo_registro: 'PARADA',
      cod_parada: mot.cod, desc_parada: mot.descricao, h_parada: parseFloat(duration),
      h_inicio: '07:30', h_fim: '17:18', h_disponivel: 9.8, h_programada: 8.8,
      cod_peca: '-', qtd: 0, tp_padrao: 0, h_produtiva: 0, mes: 5,
      tipo_parada: mot.tipo
    });
  }

  // 5 Produções
  const pecas = ['3185', '4200', '1150', '2290', '5000'];
  for(let i=0; i<5; i++) {
    const op = opers[Math.floor(Math.random() * opers.length)];
    const mq = maqs[Math.floor(Math.random() * maqs.length)];
    const peca = pecas[i];
    const qtd = Math.floor(Math.random() * 100 + 50);
    const tp = (Math.random() * 5 + 10).toFixed(2); // Peças/hora
    const hProd = (qtd / parseFloat(tp)).toFixed(2);

    records.push({
      data: today, turno: 'D', cod_oper: op.cod, desc_oper: op.nome,
      cod_maq: mq.cod, desc_maq: mq.nome, tipo_registro: 'PRODUCAO',
      cod_parada: '-', desc_parada: '-', h_parada: 0,
      h_inicio: '07:30', h_fim: '17:18', h_disponivel: 9.8, h_programada: 8.8,
      cod_peca: peca, qtd: qtd, tp_padrao: parseFloat(tp), h_produtiva: parseFloat(hProd), 
      mes: 5, eficiencia: (Math.random() * 20 + 80).toFixed(1)
    });
  }
  
  const { error } = await sb.from('registros_cronoanalise').insert(records);
  if(!error) {
    showToast('Dados simulados com sucesso!');
    await loadData();
    renderAll();
  } else {
    console.error('Erro na simulação:', error);
    showToast('Falha ao simular dados.');
  }
}

// Lógica de deleção em massa — acionada pelo modal de confirmação
async function clearDB() {
  const { error } = await sb.from('registros_cronoanalise').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (!error) {
    showToast('Base de dados de tempos limpa com sucesso!', 'ok');
    closeModal();
    await loadData();
    renderAll();
    setPage('dashboard'); // Retorna ao menu principal após limpeza
  } else {
    showToast('Erro ao limpar base de dados', 'err');
  }
}

// updateParadaDesc: alias público de fillParadaRow para compatibilidade com o HTML
function updateParadaDesc(el) { fillParadaRow(el); }

// ─────────── ANÁLISE PARTICULAR ────────────────────────────────────────────
let chartParticular = null;

function renderParticular() {
  const codOper = document.getElementById('particular-oper')?.value;
  const content = document.getElementById('particular-content');
  const empty   = document.getElementById('particular-empty');

  if (!codOper) {
    if (content) content.style.display = 'none';
    if (empty)   empty.style.display   = 'block';
    return;
  }

  if (content) content.style.display = 'block';
  if (empty)   empty.style.display   = 'none';

  const operData = STATE.operadores.find(o => o.cod === codOper);
  const records  = STATE.registros.filter(r => r.cod_oper === codOper && r.tipo_registro === 'PRODUCAO');

  // Meta vem do setor do operador — usa o setor do primeiro registro encontrado
  const codSetor = records.length > 0 ? records[0].cod_setor : null;
  const setorData = codSetor ? STATE.setores.find(s => s.cod === codSetor) : null;
  const meta = parseFloat(setorData?.meta) || 85;

  // H. Programadas — soma única por turno/dia
  const turnos = new Set(records.map(r => `${r.data}_${r.turno}`));
  let totalHProg = 0;
  turnos.forEach(key => {
    const rec = records.find(r => `${r.data}_${r.turno}` === key);
    totalHProg += rec?.h_programada || 0;
  });

  const totalHTrab = records.reduce((s, r) => s + (r.h_produtiva || 0), 0);
  const avgEfic    = records.length > 0
    ? records.reduce((s, r) => s + (r.eficiencia || 0), 0) / records.length : 0;

  document.getElementById('part-hprog').textContent = totalHProg.toFixed(2) + 'h';
  document.getElementById('part-htrab').textContent = totalHTrab.toFixed(4) + 'h';
  document.getElementById('part-meta').textContent  = meta + '%';
  document.getElementById('part-efic').textContent  = avgEfic.toFixed(1) + '%';

  const eficCard = document.getElementById('part-efic-card');
  if (eficCard) {
    eficCard.className = 'card kpi ' +
      (avgEfic >= meta ? 'accent' : avgEfic >= meta * 0.85 ? 'warn' : 'danger');
  }

  const badge = document.getElementById('part-meta-badge');
  if (badge) badge.textContent = operData ? `${operData.nome} — Meta: ${meta}%` : '';

  // Agrupamento por projeto (cod_peca)
  const pm = {};
  records.forEach(r => {
    const k = r.cod_peca || 'N/A';
    if (!pm[k]) pm[k] = { cod_peca: k, qtd: 0, kwa: 0, efic_sum: 0, count: 0, classe: r.classe_equipamento || '-', maq: r.cod_maq || '-' };
    pm[k].qtd      += r.qtd || 0;
    pm[k].kwa      += r.kwa_total || 0;
    pm[k].efic_sum += r.eficiencia || 0;
    pm[k].count++;
  });
  const projects = Object.values(pm);

  const tbody = document.getElementById('part-projects-body');
  if (tbody) {
    tbody.innerHTML = projects.length === 0
      ? '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted);">Nenhum projeto registrado para este profissional.</td></tr>'
      : projects.map(p => {
          const kwaM  = p.qtd > 0 ? (p.kwa / p.qtd) : 0;
          const eficP = p.count > 0 ? p.efic_sum / p.count : 0;
          return `<tr>
            <td><strong>${p.cod_peca}</strong></td>
            <td>${p.qtd}</td>
            <td>${p.kwa.toFixed(3)}</td>
            <td>${kwaM.toFixed(3)}</td>
            <td><span class="status-badge">${p.classe}</span></td>
            <td>${p.maq}</td>
            <td><span class="status-badge ${getStatusClass(eficP)}">${eficP.toFixed(1)}%</span></td>
          </tr>`;
        }).join('');
  }

  // Renderizar Observações do Profissional
  const obsBody = document.getElementById('part-obs-body');
  const obsRecords = STATE.registros.filter(r => r.cod_oper === codOper && r.tipo_registro === 'OBSERVACAO');
  
  if (obsBody) {
    if (obsRecords.length === 0) {
      obsBody.innerHTML = '<em style="color:var(--muted);font-size:13px;">Nenhuma observação registrada para este profissional.</em>';
    } else {
      obsBody.innerHTML = obsRecords.map(o => `
        <details class="obs-details" style="background:var(--surface); border:1px solid var(--border); padding:10px; border-radius:6px; margin-bottom:10px; cursor:pointer;">
          <summary style="font-weight:600; font-size:14px; outline:none; color:var(--accent);">
            📅 ${new Date(o.data).toLocaleDateString('pt-BR')} — ${o.cod_parada || 'Sem Título'}
          </summary>
          <div style="padding-top:10px; font-size:13px; color:var(--text); line-height:1.5; display:flex; justify-content:space-between; align-items:center;">
            <span>${o.desc_parada || 'Sem descrição.'}</span>
            ${AUTH.isMinCoordenador() ? `<button style="background:transparent;border:none;cursor:pointer;font-size:14px;" onclick="editObs('${o.id}', '${o.desc_parada || ''}')" title="Editar">✏️</button>` : ''}
          </div>
        </details>
      `).join('');
    }
  }

  // Gráfico de barras com linha de meta
  const ctx = document.getElementById('chart-particular');
  if (!ctx) return;
  if (chartParticular) chartParticular.destroy();
  chartParticular = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: projects.map(p => p.cod_peca),
      datasets: [
        {
          label: 'Eficiência (%)',
          data: projects.map(p => p.count > 0 ? (p.efic_sum / p.count).toFixed(1) : 0),
          backgroundColor: projects.map(p => {
            const e = p.count > 0 ? p.efic_sum / p.count : 0;
            return e >= 95 ? '#00f2c3' : e >= 80 ? '#ffd700' : '#ff4d6d';
          }),
          borderRadius: 5
        },
        {
          label: 'Meta (%)',
          data: projects.map(() => meta),
          type: 'line',
          borderColor: '#4d94ff',
          borderDash: [6, 4],
          pointRadius: 0,
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8b949e' } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' }, suggestedMax: 120 }
      }
    }
  });
}

async function editObs(id, currentDesc) {
  const newVal = prompt('Editar observação:', currentDesc);
  if (newVal !== null && newVal.trim() !== '') {
    const { error } = await sb.from('registros_cronoanalise').update({ desc_parada: newVal }).eq('id', id);
    if (!error) {
      showToast('Observação alterada!', 'ok');
      await loadData();
      renderParticular();
    } else {
      showToast('Erro: ' + error.message, 'err');
    }
  }
}

// ─────────── AUDITORIA (só Programador) ────────────────────────────────────
async function renderAuditoria() {
  const tbody = document.getElementById('audit-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">Carregando...</td></tr>';

  try {
    const { data, error } = await sb.from('registros_cronoanalise')
      .select('id, created_at, cod_oper, tipo_registro, cod_peca, desc_parada, created_by_name, created_by_role')
      .order('created_at', { ascending: false })
      .limit(60);

    if (error || !data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">Nenhuma alteração registrada.</td></tr>';
      return;
    }

    const roleColors = { programador: '#00f2c3', coordenador: '#4d94ff', alimentador: '#ffd700' };
    const roleLabels = { programador: '⚡ Programador', coordenador: '🎯 Coordenador', alimentador: '📋 Alimentador' };

    tbody.innerHTML = data.map(r => {
      const dt = r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '-';
      const role = r.created_by_role || 'desconhecido';
      const color = roleColors[role] || '#8b949e';
      const label = roleLabels[role] || role;
      const motivo = r.tipo_registro === 'PRODUCAO' ? (r.cod_peca || '-') : (r.desc_parada || '-');
      return `
        <tr>
          <td style="font-family:var(--font-mono);font-size:12px;">${dt}</td>
          <td><strong>${r.cod_oper || '-'}</strong></td>
          <td><span class="status-badge ${r.tipo_registro === 'PRODUCAO' ? 'status-padrão' : 'status-gargalo'}">${r.tipo_registro || '-'}</span></td>
          <td>${motivo}</td>
          <td style="font-size:13px;">${r.created_by_name || '<em style="color:var(--text-muted)">Não identificado</em>'}</td>
          <td><span style="color:${color};font-size:12px;font-weight:700;">${label}</span></td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--danger);">Erro ao carregar auditoria.</td></tr>';
  }
}

window.simulateData = simulateData;
window.delRegistro = delRegistro;
window.clearFilters = clearFilters;
window.clearDashFilters = clearDashFilters;
window.confirmClear = confirmClear;
window.addObsRow = addObsRow;
window.clearDB = clearDB;
window.exportCSV = exportCSV;
window.addConfig = addConfig;
window.removeConfig = removeConfig;
window.addPecaRow = addPecaRow;
window.addParadaRow = addParadaRow;
window.saveRegisto = saveRegisto;
window.setPage = setPage;
window.toggleTheme = toggleTheme;
window.fillOper = fillOper;
window.fillMaq = fillMaq;
window.fillSetor = fillSetor;
window.fillParadaRow = fillParadaRow;
window.updateParadaDesc = updateParadaDesc;
window.renderParticular = renderParticular;
window.renderAuditoria  = renderAuditoria;
window.editConfig       = editConfig;
window.editRegistro     = editRegistro;
window.editObs          = editObs;

console.log('SOMA: Sistema inicializado com sucesso. v2.2 — RBAC ativo.');
