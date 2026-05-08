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
  
  if (sOper) {
    sOper.innerHTML = '<option value="">Selecione</option>' + 
      STATE.operadores.map(o => `<option value="${o.cod}">${o.cod} - ${o.nome}</option>`).join('');
  }
  if (sMaq) {
    sMaq.innerHTML = '<option value="">Selecione</option>' + 
      STATE.maquinas.map(m => `<option value="${m.cod}">${m.cod} - ${m.nome}</option>`).join('');
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
  
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
  document.getElementById('page-title').textContent = p.charAt(0).toUpperCase() + p.slice(1).replace('-',' ');
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

function addPecaRow() {
  const tbody = document.getElementById('pecas-body');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" placeholder="Cód. Peça" class="peca-cod"></td>
    <td><input type="number" placeholder="Qtd" class="peca-qtd" oninput="updateRow(this)"></td>
    <td><input type="number" placeholder="Padrão" class="peca-padrao" oninput="updateRow(this)"></td>
    <td>
      <select class="peca-comp">
        <option value="Manual">Manual</option>
        <option value="Máquina">Máquina</option>
      </select>
    </td>
    <td class="row-efic">0%</td>
    <td class="row-status">-</td>
    <td><button class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">×</button></td>
  `;
  tbody.appendChild(tr);
}

function updateRow(el) {
  const tr = el.parentElement.parentElement;
  const qtd = parseFloat(tr.querySelector('.peca-qtd').value) || 0;
  const padrao = parseFloat(tr.querySelector('.peca-padrao').value) || 0;
  
  const efic = calculateEfficiency(qtd, padrao);
  tr.querySelector('.row-efic').textContent = (efic > 0 ? efic.toFixed(1) : '0') + '%';
  tr.querySelector('.row-status').innerHTML = getStatusLabel(efic);
}

async function saveRegisto() {
  const data = document.getElementById('f-data').value;
  const hDisp = parseFloat(document.getElementById('f-hdisp').value) || 0;
  const turno = document.getElementById('f-turno').value;
  const codOper = document.getElementById('f-codoper').value;
  const codMaq = document.getElementById('f-codmaq').value;
  
  if (!data || !codOper || !codMaq) {
    showToast('Atenção: Informação de campo incompleta!', 'err');
    return;
  }
  
  const rows = document.querySelectorAll('#pecas-body tr');
  if (rows.length === 0) {
    showToast('Adicione ao menos um registro de produção!', 'err');
    return;
  }

  let totalHProd = 0;
  const registros = Array.from(rows).map(tr => {
    const qtd = parseFloat(tr.querySelector('.peca-qtd').value) || 0;
    const padrao = parseFloat(tr.querySelector('.peca-padrao').value) || 0;
    const hProd = padrao > 0 ? qtd / padrao : 0;
    totalHProd += hProd;
    
    const efic = calculateEfficiency(qtd, padrao);
    return {
      data,
      h_disponivel: hDisp,
      turno,
      cod_oper: codOper,
      cod_maq: codMaq,
      cod_peca: tr.querySelector('.peca-cod').value,
      qtd,
      tp_padrao: padrao,
      componente: tr.querySelector('.peca-comp').value,
      h_produtiva: hProd,
      eficiencia: efic,
      status: padrao === 0 ? 'SEM_PADRAO' : (efic >= 95 ? 'PADRAO' : (efic >= 80 ? 'DESVIO' : 'GARGALO'))
    };
  });
  
  const { error } = await sb.from('registros_cronoanalise').insert(registros);
  
  if (error) {
    showToast('Erro ao salvar no Registro de cronoanálise: ' + error.message, 'err');
  } else {
    showToast('Informação de campo salva com sucesso no Supabase!', 'ok');
    clearForm();
    await loadData();
    renderAll();
  }
}

function clearForm() {
  document.getElementById('pecas-body').innerHTML = '';
  addPecaRow();
}

function renderAll() {
  if (STATE.registros.length === 0) return;

  const totalProduced = STATE.registros.reduce((sum, r) => sum + r.qtd, 0);
  const totalHDisp = STATE.registros[0].h_disponivel || 8.8; 
  const totalHProd = STATE.registros.reduce((sum, r) => sum + (r.h_produtiva || 0), 0);
  const residual = Math.max(0, totalHDisp - totalHProd);
  
  const recordsWithPattern = STATE.registros.filter(r => r.tp_padrao > 0);
  const avgEfic = recordsWithPattern.length > 0 ? 
    recordsWithPattern.reduce((sum, r) => sum + r.eficiencia, 0) / recordsWithPattern.length : 0;
  
  document.getElementById('kpi-efic-global').textContent = avgEfic.toFixed(1) + '%';
  document.getElementById('kpi-qtd-total').textContent = totalProduced;
  document.getElementById('kpi-residual').textContent = residual.toFixed(2) + 'h';
  
  const gargalosCount = STATE.registros.filter(r => r.status === 'GARGALO').length;
  document.getElementById('kpi-gargalos').textContent = gargalosCount;

  // Rule 2.2: Consultive Feedback
  const parecer = document.getElementById('parecer-consultivo');
  if (STATE.registros.length > 0) {
    const worst = [...STATE.registros].sort((a,b) => a.eficiencia - b.eficiencia)[0];
    if (worst.tp_padrao === 0) {
      parecer.innerHTML = `<span style="color:var(--warn)">[ALERTA] Houve atualização no método de trabalho para este processo? Registros sem Tempo Padrão identificado.</span>`;
    } else if (worst.eficiencia < 95) {
      const desvio = (100 - worst.eficiencia).toFixed(1);
      parecer.innerHTML = `
        <div style="border-left: 4px solid var(--danger); padding-left: 12px;">
          <strong>Análise de Desvio:</strong> **${desvio}%** abaixo do **Tempo Padrão** na peça **${worst.cod_peca}**.<br>
          <strong>Causa Provável:</strong> ${worst.eficiencia < 80 ? 'Gargalo Crítico no fluxo de material ou Fadiga excessiva.' : 'Ritmo abaixo da média operacional.'}<br>
          <strong>Sugestão de Melhoria:</strong> Revalidar método de trabalho e ergonomia da estação de **${worst.componente}**.
        </div>
      `;
      if (worst.eficiencia < 80) showToast('ALERTA DE PRODUTIVIDADE: Baixa performance detectada!', 'err');
    } else {
      parecer.innerHTML = '<span style="color:var(--success)">[DENTRO DO PADRÃO] Processos operando em alta eficiência. Foco em manter o ritmo.</span>';
    }
  }
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

function confirmClear() {
  if (confirm('Deseja limpar o cache local? Os dados no Supabase não serão afetados.')) {
    localStorage.removeItem('soma-theme');
    showToast('Cache limpo!', 'ok');
  }
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
