// ═══════════════════════════════════════════════════════════════
//  auth.js — Módulo de Autenticação e RBAC — SOMA MODULAR v2.2
// ═══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://ccytzaruxdbtqqblpciq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IowVi8PFf6gDSzjpC8EgQA_sFzzkvsv';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Perfis de cor e label por role ───────────────────────────
const ROLE_META = {
  programador: { color: '#00f2c3', label: '⚡ Programador', level: 1 },
  coordenador:  { color: '#4d94ff', label: '🎯 Coordenador',  level: 2 },
  alimentador:  { color: '#ffd700', label: '📋 Alimentador',  level: 3 }
};

// ─── Objeto Global de Autenticação ────────────────────────────
const AUTH = {
  user:    null,
  profile: null,

  get role()      { return this.profile?.role || null; },
  get name()      { return this.profile?.display_name || this.user?.email || ''; },
  get roleColor() { return ROLE_META[this.role]?.color || '#8b949e'; },
  get roleLabel() { return ROLE_META[this.role]?.label || 'Usuário'; },
  get level()     { return ROLE_META[this.role]?.level || 99; },

  isProgramador()    { return this.role === 'programador'; },
  isCoordenador()    { return this.role === 'coordenador'; },
  isAlimentador()    { return this.role === 'alimentador'; },
  isMinCoordenador() { return this.level <= 2; },

  // ── Inicializa: verifica sessão e redireciona se não logado ──
  async init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    await this._loadProfile(session.user);

    // Listener para expiração de sessão
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.href = 'login.html';
    });

    return true;
  },

  async _loadProfile(user) {
    this.user = user;
    const { data } = await sb.from('user_profiles').select('*').eq('id', user.id).single();
    if (!data) {
      // Fallback: usar localStorage (preenchido no login.html)
      this.profile = {
        role: localStorage.getItem('soma-role') || 'alimentador',
        display_name: localStorage.getItem('soma-name') || user.email
      };
    } else {
      this.profile = data;
      localStorage.setItem('soma-role', data.role);
      localStorage.setItem('soma-name', data.display_name);
    }
  },

  async logout() {
    await sb.auth.signOut();
    localStorage.removeItem('soma-role');
    localStorage.removeItem('soma-name');
    window.location.href = 'login.html';
  },

  // ── Aplica RBAC ao DOM completo ────────────────────────────────
  applyRBAC() {
    const role = this.role;

    // 1. Barra de perfil no sidebar
    this._renderUserBadge();

    // 2. Abas de navegação: "Últimas Alterações" só para programador
    const navAudit = document.getElementById('nav-auditoria');
    if (navAudit) navAudit.style.display = this.isProgramador() ? 'flex' : 'none';

    // 3. Programador: tudo visível — sai cedo
    if (this.isProgramador()) return;

    // ── COORDENADOR ──────────────────────────────────────────────
    if (this.isCoordenador()) {
      // Leitura: Digitador — ocultar botão Salvar e linhas de ação
      _hideEl('btn-salvar-registro');
      _hideEl('btn-add-peca');
      _hideEl('btn-add-parada');
      // Configurações: pode tudo — não ocultar
      return;
    }

    // ── ALIMENTADOR ──────────────────────────────────────────────
    if (this.isAlimentador()) {
      // Dashboard: somente leitura — OK
      // Base de Dados: somente leitura — ocultar coluna "Ação"
      _hideEls('[data-rbac="delete-btn"]');
      // Configurações: ocultar Operadores e Setores
      _hideEl('config-operadores-section');
      _hideEl('config-setores-section');
      // Ocultar botões de configuração de operadores/setores
      _hideEl('btn-add-oper');
      _hideEl('btn-add-set');
      // Análise Paradas/Particular: somente leitura — OK
    }
  },

  // ── Renderiza badge de usuário no sidebar ─────────────────────
  _renderUserBadge() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;
    const existing = document.getElementById('user-badge-wrap');
    if (existing) existing.remove();

    const wrap = document.createElement('div');
    wrap.id = 'user-badge-wrap';
    wrap.style.cssText = `
      margin-bottom: 12px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid ${this.roleColor}33;
      background: ${this.roleColor}0d;
      display: flex; flex-direction: column; gap: 4px;
    `;
    wrap.innerHTML = `
      <div style="font-size:11px;color:${this.roleColor};font-weight:700;letter-spacing:1px;">${this.roleLabel}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.name}</div>
      <button onclick="AUTH.logout()" style="
        margin-top:6px;background:transparent;border:1px solid rgba(255,77,109,0.3);
        border-radius:8px;padding:5px 10px;font-size:11px;color:#ff4d6d;
        cursor:pointer;font-family:var(--font-body);transition:all 0.2s;
      " onmouseover="this.style.background='rgba(255,77,109,0.12)'" onmouseout="this.style.background='transparent'">
        ↩ Sair
      </button>
    `;
    footer.prepend(wrap);
  }
};

// ── Helpers ───────────────────────────────────────────────────
function _hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
function _hideEls(selector) {
  document.querySelectorAll(selector).forEach(el => el.style.display = 'none');
}

// Expõe AUTH globalmente
window.AUTH = AUTH;
