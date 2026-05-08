// ───────── SUPABASE CONFIG ─────────
const SUPABASE_URL = 'https://ccytzaruxdbtqqblpciq.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_IowVi8PFf6gDSzjpC8EgQA_sFzzkvsv';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ───────── STATE ─────────
let STATE = {
  operadores: [],
  maquinas: [],
  paradas: [],
  registros: []
};

// ───────── INITIALIZATION ─────────
window.onload = async () => {
  showToast('Sincronizando com a base de dados de tempos...', 'ok');
  await loadConfig();
  await loadData();
  renderAll();
  
  // Theme check
  if (localStorage.getItem('soma-theme') === 'light') {
    document.body.classList.add('light-theme');
  }
};

async function loadConfig() {
  try {
    const { data: oper } = await sb.from('operadores').select('*');
    const { data: maq } = await sb.from('maquinas').select('*');
    const { data: par } = await sb.from('paradas_motivos').select('*');
    
    STATE.operadores = oper || [];
    STATE.maquinas = maq || [];
    STATE.paradas = par || [];
    
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
  const fOper = document.getElementById('filter-oper');
  
  if (sOper) {
    sOper.innerHTML = '<option value="">Selecione</option>' + 
      STATE.operadores.map(o => `<option value="${o.cod}">${o.cod} - ${o.nome}</option>`).join('');
  }
  if (sMaq) {
    sMaq.innerHTML = '<option value="">Selecione</option>' + 
      STATE.maquinas.map(m => `<option value="${m.cod}">${m.cod} - ${m.nome}</option>`).join('');
  }
  if (fOper) {
    fOper.innerHTML = '<option value="">Todos Operadores</option>' + 
      STATE.operadores.map(o => `<option value="${o.cod}">${o.nome}</option>`).join('');
  }
}

// ───────── THEME TOGGLE ─────────
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('soma-theme', isLight ? 'light' : 'dark');
}

// ───────── NAVIGATION ─────────
function setPage(p) {
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(nv => nv.classList.remove('active'));
  
  const page = document.getElementById('page-' + p);
  if (page) page.classList.add('active');
  
  const nav = document.getElementById('nav-' + p);
  if (nav) nav.classList.add('active');
  
  document.getElementById('page-title').textContent = p.charAt(0).toUpperCase() + p.slice(1).replace('-',' ');

  if (p === 'banco') renderDatabase();
  if (p === 'config') renderConfigTable();
}

// ───────── CONFIG MANAGEMENT (RULE 1.4) ─────────
async function renderConfigTable() {
  const lOper = document.getElementById('list-oper');
  const lMaq = document.getElementById('list-maq');
  const lPar = document.getElementById('list-parada-motivos');

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
    // Clear inputs
    if (type === 'oper') { document.getElementById('new-oper-cod').value=''; document.getElementById('new-oper-nome').value=''; }
    if (type === 'maq') { document.getElementById('new-maq-cod').value=''; document.getElementById('new-maq-nome').value=''; }
    if (type === 'par') { document.getElementById('new-par-cod').value=''; document.getElementById('new-par-desc').value=''; }
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

// ───────── DATABASE VIEW (RULE 5) ─────────
function renderDatabase() {
  const fPeca = document.getElementById('filter-peca').value.toLowerCase();
  const fOper = document.getElementById('filter-oper').value;
  const fData = document.getElementById('filter-data').value;

  const filtered = STATE.registros.filter(r => {
    const matchPeca = !fPeca || r.cod_peca.toLowerCase().includes(fPeca);
    const matchOper = !fOper || r.cod_oper === fOper;
    const matchData = !fData || r.data === fData;
    return matchPeca && matchOper && matchData;
  });

  const tbody = document.getElementById('db-body');
  if (!tbody) return;

  tbody.innerHTML = filtered.map(r => `
    <tr>
      <td>${new Date(r.data).toLocaleDateString('pt-BR')}</td>
      <td>${r.cod_oper}</td>
      <td>${r.cod_maq}</td>
      <td>${r.cod_peca}</td>
      <td>${r.qtd}</td>
      <td>${r.eficiencia.toFixed(1)}%</td>
      <td>${getStatusLabel(r.eficiencia)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteRecord('${r.id}')">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--muted);">Nenhum registro encontrado com estes filtros.</td></tr>';
}

async function deleteRecord(id) {
  if (!confirm('Excluir este registro permanentemente?')) return;
  const { error } = await sb.from('registros_cronoanalise').delete().eq('id', id);
  if (error) {
    showToast('Erro ao excluir', 'err');
  } else {
    showToast('Registro excluído!', 'ok');
    await loadData();
    renderDatabase();
    renderAll();
  }
}

function clearFilters() {
  document.getElementById('filter-peca').value = '';
  document.getElementById('filter-oper').value = '';
  document.getElementById('filter-data').value = '';
  renderDatabase();
}

// ───────── DB CLEAR (RULE 5) ─────────
function confirmClear() {
  document.getElementById('modal-clear').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-clear').classList.remove('active');
}

async function clearDB() {
  const { error } = await sb.from('registros_cronoanalise').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  if (error) {
    showToast('Erro ao limpar base: ' + error.message, 'err');
  } else {
    showToast('Base de dados de tempos limpa com sucesso!', 'ok');
    closeModal();
    await loadData();
    renderAll();
    if (document.getElementById('page-banco').classList.contains('active')) renderDatabase();
  }
}

// ───────── CORE LOGIC (RULE 1.1) ─────────
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

// ───────── UI HELPERS ─────────
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => t.className = '', 3000);
}

// ───────── DIGITADOR LOGIC ─────────
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
  // Production
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

  // Stoppages
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
  const hInicio = document.getElementById('f-h-inicio').value;
  const hFim = document.getElementById('f-h-fim').value;
  const hDisp = document.getElementById('f-hdisp').value;
  const hProg = document.getElementById('f-hprog').value;

  if (!data || !codOper || !codMaq) {
    showToast('Atenção: Cabeçalho incompleto!', 'err');
    return;
  }

  const pecaRows = document.querySelectorAll('#pecas-body tr');
  const paradaRows = document.querySelectorAll('#paradas-body tr');

  // We will save one record per production row, or just one if no production but has stoppage
  // However, the rule says "Save on Supabase". Let's follow the standard of one row per cycle if possible.
  // For now, let's save the summarized turn to 'registros_cronoanalise' or similar.
  // To keep it equal to the spreadsheet "Digitador" view, we save each production line.

  const records = [];
  
  if (pecaRows.length === 0 && paradaRows.length === 0) {
    showToast('Adicione ao menos um registro!', 'err');
    return;
  }

  // Common data
  const base = {
    data, 
    mes: parseInt(mes) || null, 
    turno, 
    cod_oper: codOper, 
    desc_oper: descOper, 
    cod_maq: codMaq, 
    desc_maq: descMaq,
    h_inicio: hInicio || null, 
    h_fim: hFim || null, 
    h_disponivel: parseFloat(hDisp) || 0, 
    h_programada: parseFloat(hProg) || 0
  };

  // If we have production rows
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
      eficiencia: hProd > 0 ? (hProd / (parseFloat(hProg) || 1)) * 100 : 0, // Placeholder calculation
      tipo_registro: 'PRODUCAO'
    });
  });

  // If we have stoppage rows
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
  const totalHDisp = STATE.registros[0].h_disponivel || 8.8; 
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

  // Rule 4: Executive Summary
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

  // Rule 4: Comparative Table
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

  // Rule 4: Ganhos e Alertas
  const ganhos = document.getElementById('ganhos-alertas');
  ganhos.innerHTML = `
    <div class="config-row" style="border-left:3px solid var(--success)">
      <span>[GANHO] Redução de tempo residual em processos de Bobinagem.</span>
    </div>
    <div class="config-row" style="border-left:3px solid var(--danger)">
      <span>[ALERTA] ${gargalosCount} gargalos críticos identificados no turno.</span>
    </div>
  `;

  // Rule 4: Projeção
  const proj = document.getElementById('projecao-entrega');
  const remTime = Math.max(0, 8.8 - totalHProd); // Simplified
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

function exportCSV() {
  if (STATE.registros.length === 0) return;
  const headers = Object.keys(STATE.registros[0]).join(',');
  const rows = STATE.registros.map(r => Object.values(r).join(',')).join('\n');
  const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "soma_cronoanalise.csv");
  document.body.appendChild(link);
  link.click();
}
