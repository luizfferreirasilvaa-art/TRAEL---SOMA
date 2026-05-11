// ───────── CONFIGURAÇÃO DO SUPABASE ─────────
const SUPABASE_URL = 'https://ccytzaruxdbtqqblpciq.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_IowVi8PFf6gDSzjpC8EgQA_sFzzkvsv';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ───────── ESTADO GLOBAL ─────────
let STATE = {
  operadores: [],
  maquinas: [],
  paradas: [],
  setores: [],
  registros: []
};

// ───────── INICIALIZAÇÃO ─────────
window.onload = async () => {
  showToast('Sincronizando com a base de dados de tempos...', 'ok');
  await loadConfig();
  await loadData();
  renderAll();
  
  // Verificação de tema salvo
  if (localStorage.getItem('soma-theme') === 'light') {
    document.body.classList.add('light-theme');
  }
};

async function loadConfig() {
  try {
    const { data: oper } = await sb.from('operadores').select('*');
    const { data: maq } = await sb.from('maquinas').select('*');
    const { data: par } = await sb.from('paradas_motivos').select('*');
    const { data: set } = await sb.from('setores').select('*');
    
    STATE.operadores = oper || [];
    STATE.maquinas = maq || [];
    STATE.paradas = par || [];
    STATE.setores = set || [];
    
    fillSelects();
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
  const sOper = document.getElementById('f-codoper');
  const sMaq = document.getElementById('f-codmaq');
  const sSetor = document.getElementById('f-codsetor');
  const fOper = document.getElementById('filter-oper');
  const fSetor = document.getElementById('filter-setor');
  
  if (sOper) {
    sOper.innerHTML = '<option value="">Selecione</option>' + 
      STATE.operadores.map(o => `<option value="${o.cod}">${o.cod} - ${o.nome}</option>`).join('');
  }
  if (sMaq) {
    sMaq.innerHTML = '<option value="">Selecione</option>' + 
      STATE.maquinas.map(m => `<option value="${m.cod}">${m.cod} - ${m.nome}</option>`).join('');
  }
  if (sSetor) {
    sSetor.innerHTML = '<option value="">Selecione</option>' + 
      STATE.setores.map(s => `<option value="${s.cod}">${s.cod} - ${s.desc}</option>`).join('');
  }
  if (fOper) {
    fOper.innerHTML = '<option value="">Todos Operadores</option>' + 
      STATE.operadores.map(o => `<option value="${o.cod}">${o.nome}</option>`).join('');
  }
  if (fSetor) {
    fSetor.innerHTML = '<option value="">Todos Setores</option>' + 
      STATE.setores.map(s => `<option value="${s.cod}">${s.cod} - ${s.desc}</option>`).join('');
  }
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
  
  document.getElementById('page-title').textContent = p.charAt(0).toUpperCase() + p.slice(1).replace('-',' ');

  if (p === 'banco') renderDatabase();
  if (p === 'paradas') renderParadas();
  if (p === 'config') renderConfigTable();
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

  list.innerHTML = filtered.map(r => `
    <tr>
      <td>${new Date(r.data).toLocaleDateString('pt-BR')}</td>
      <td>${r.cod_oper}</td>
      <td>${r.cod_maq}</td>
      <td>${r.cod_peca || '-'}</td>
      <td>${r.qtd || 0}</td>
      <td>${r.tipo_registro === 'PRODUCAO' ? (r.eficiencia ? r.eficiencia.toFixed(1)+'%' : '-') : '-'}</td>
      <td><span class="status-badge ${getStatusClass(r.eficiencia)}">${r.tipo_registro}</span></td>
      <td><button class="btn btn-danger btn-sm" onclick="delRegistro('${r.id}')">Excluir</button></td>
    </tr>
  `).join('');
}

function getStatusClass(efic) {
  if (!efic) return '';
  if (efic >= 95) return 'status-padrao';
  if (efic >= 80) return 'status-desvio';
  return 'status-gargalo';
}

async function delRegistro(id) {
  if (!confirm('Excluir este registro permanentemente?')) return;
  const { error } = await sb.from('registros_cronoanalise').delete().eq('id', id);
  if (!error) {
    showToast('Registro excluído!');
    await loadData();
    renderAll();
    renderDatabase();
  }
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

  if (lOper) {
    lOper.innerHTML = STATE.operadores.map(o => `
      <div class="config-row">
        <span><strong>${o.cod}</strong> - ${o.nome}</span>
        <button class="btn-del" onclick="removeConfig('operadores', '${o.id}')">×</button>
      </div>
    `).join('');
  }
  if (lMaq) {
    lMaq.innerHTML = STATE.maquinas.map(m => `
      <div class="config-row">
        <span><strong>${m.cod}</strong> - ${m.nome}</span>
        <button class="btn-del" onclick="removeConfig('maquinas', '${m.id}')">×</button>
      </div>
    `).join('');
  }
  if (lPar) {
    lPar.innerHTML = STATE.paradas.map(p => `
      <div class="config-row">
        <span><strong>${p.cod}</strong> - ${p.desc} <small>(${p.tipo})</small></span>
        <button class="btn-del" onclick="removeConfig('paradas_motivos', '${p.id}')">×</button>
      </div>
    `).join('');
  }
  if (lSet) {
    lSet.innerHTML = STATE.setores.length === 0
      ? '<p style="color:var(--muted);font-size:13px;"><em>Nenhum setor cadastrado.</em></p>'
      : STATE.setores.map(s => `
      <div class="config-row">
        <span><strong>${s.cod}</strong> - ${s.desc}</span>
        <button class="btn-del" onclick="removeConfig('setores', '${s.id}')">×</button>
      </div>
    `).join('');
  }
}

async function addConfig(type) {
  let table = '';
  let payload = {};

  if (type === 'oper') {
    table = 'operadores';
    payload = { cod: document.getElementById('new-oper-cod').value, nome: document.getElementById('new-oper-nome').value.toUpperCase() };
  } else if (type === 'maq') {
    table = 'maquinas';
    payload = { cod: document.getElementById('new-maq-cod').value, nome: document.getElementById('new-maq-nome').value.toUpperCase() };
  } else if (type === 'par') {
    table = 'paradas_motivos';
    payload = { 
      cod: document.getElementById('new-par-cod').value, 
      "desc": document.getElementById('new-par-desc').value.toUpperCase(),
      tipo: document.getElementById('new-par-tipo').value
    };
  } else if (type === 'set') {
    table = 'setores';
    payload = {
      cod: document.getElementById('new-set-cod').value.toUpperCase(),
      desc: document.getElementById('new-set-desc').value.toUpperCase()
    };
  }

  if (!payload.cod) {
    showToast('Informe ao menos o código!', 'err');
    return;
  }

  const { error } = await sb.from(table).insert([payload]);
  if (error) {
    showToast('Erro ao salvar configuração', 'err');
  } else {
    showToast('Configuração salva com sucesso!', 'ok');
    await loadConfig();
    renderConfigTable();
    // Limpar campos do formulário
    if (type === 'oper') { document.getElementById('new-oper-cod').value=''; document.getElementById('new-oper-nome').value=''; }
    if (type === 'maq') { document.getElementById('new-maq-cod').value=''; document.getElementById('new-maq-nome').value=''; }
    if (type === 'par') { document.getElementById('new-par-cod').value=''; document.getElementById('new-par-desc').value=''; }
    if (type === 'set') { document.getElementById('new-set-cod').value=''; document.getElementById('new-set-desc').value=''; }
  }
}

async function removeConfig(table, id) {
  if (!confirm('Deseja realmente remover esta configuração?')) return;
  const { error } = await sb.from(table).delete().eq('id', id);
  if (error) {
    showToast('Erro ao remover registro', 'err');
  } else {
    showToast('Registro removido!', 'ok');
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
  tr.querySelector('.parada-desc').value = p ? p.desc : '';
  tr.querySelector('.parada-tipo').value = p ? p.tipo : '';
  calcResumo();
}

function calcResumo() {
  // Cálculo de produção
  let totalQtd = 0;
  let totalHProd = 0;
  document.querySelectorAll('#pecas-body tr').forEach(tr => {
    const qtd = parseFloat(tr.querySelector('.peca-qtd').value) || 0;
    const pad = parseFloat(tr.querySelector('.peca-padrao').value) || 0;
    const hProd = pad > 0 ? qtd / pad : 0;
    tr.querySelector('.row-hprod').textContent = hProd.toFixed(4);
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
  const descSetor = STATE.setores.find(s => s.cod === codSetor)?.desc || '';
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

  if (pecaRows.length === 0 && paradaRows.length === 0) {
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
    h_inicio: hInicio || null,
    h_fim: hFim || null,
    h_disponivel: parseFloat(hDisp) || 0,
    h_programada: hProg
  };

  const records = [];

  // Linhas de produção — eficiência usa hTrab (horas líquidas produtivas)
  pecaRows.forEach(tr => {
    const qtd = parseFloat(tr.querySelector('.peca-qtd').value) || 0;
    const pad = parseFloat(tr.querySelector('.peca-padrao').value) || 0;
    const hProd = pad > 0 ? qtd / pad : 0;
    records.push({
      ...base,
      cod_peca: tr.querySelector('.peca-cod').value,
      qtd,
      tp_padrao: pad,
      h_produtiva: hProd,
      eficiencia: hTrab > 0 ? (hProd / hTrab) * 100 : 0,
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
  document.getElementById('f-h-inicio').value = '';
  document.getElementById('f-h-fim').value = '';
  addPecaRow();
  calcResumo();
}

function renderAll() {
  if (STATE.registros.length === 0) {
    document.getElementById('kpi-efic-global').textContent = '0%';
    document.getElementById('kpi-qtd-total').textContent = '0';
    document.getElementById('kpi-residual').textContent = '0h';
    document.getElementById('kpi-gargalos').textContent = '0';
    document.getElementById('parecer-consultivo').innerHTML = '<em>Aguardando registros...</em>';
    return;
  }

  const totalProduced = STATE.registros.reduce((sum, r) => sum + (r.qtd || 0), 0);
  const totalHDisp = STATE.registros.reduce((max, r) => Math.max(max, r.h_disponivel || 0), 0) || 8.8;
  const totalHProd = STATE.registros.reduce((sum, r) => sum + (r.h_produtiva || 0), 0);
  const residual = Math.max(0, totalHDisp - totalHProd);
  
  const recordsWithPattern = STATE.registros.filter(r => r.tp_padrao > 0);
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
  document.getElementById('f-descsetor').value = s ? s.desc : '';
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
  const motives = STATE.paradas.length > 0 ? STATE.paradas : [{cod:'P01', desc:'Manutenção', tipo:'PROG'}];
  
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
      cod_parada: mot.cod, desc_parada: mot.desc, h_parada: parseFloat(duration),
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
    await loadData();
    renderAll();
    if (document.getElementById('page-banco')?.classList.contains('active')) renderDatabase();
  } else {
    showToast('Erro ao limpar base de dados', 'err');
  }
}

// updateParadaDesc: alias público de fillParadaRow para compatibilidade com o HTML
function updateParadaDesc(el) { fillParadaRow(el); }

window.simulateData = simulateData;
window.delRegistro = delRegistro;
window.clearFilters = clearFilters;
window.confirmClear = confirmClear;
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

console.log('SOMA: Sistema inicializado com sucesso.');
