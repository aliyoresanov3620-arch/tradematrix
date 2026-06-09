// ============================================================
// TradeMatrix Pro — Supabase Helper v1.0
// ============================================================

const SUPABASE_URL = 'https://qvenslskfdhnjckzxipj.supabase.co';
const SUPABASE_ANON = 'sb_publishable_ArcsmhTCD4s1KSnYOlnyFQ_RvGqsW0P';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

window.TM = {
  user: null,
  profile: null,
  plan: 'free',
  planLimits: {
    free:  { maxTrades: 50,  ai: false, news: false, export: false },
    pro:   { maxTrades: -1,  ai: true,  news: true,  export: true  },
    elite: { maxTrades: -1,  ai: true,  news: true,  export: true  },
  },
};

async function tmInit() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/auth.html'; return; }
  TM.user = session.user;
  await loadUserProfile();
  await loadAccountSettings();
  await loadTradesFromSupabase();
  updateNavUI();
}

async function loadUserProfile() {
  const { data } = await sb
    .from('profiles')
    .select('*, subscriptions(plan, status, expires_at)')
    .eq('id', TM.user.id)
    .single();
  if (!data) return;
  TM.profile = data;
  const activeSub = (data.subscriptions || []).find(s =>
    s.status === 'active' && (!s.expires_at || new Date(s.expires_at) > new Date())
  );
  TM.plan = activeSub ? activeSub.plan : 'free';
}

function tmCanUse(feature) {
  return !!(TM.planLimits[TM.plan] || TM.planLimits.free)[feature];
}

function tmCanAddTrade() {
  const max = (TM.planLimits[TM.plan] || TM.planLimits.free).maxTrades;
  if (max === -1) return true;
  return (window.trades || []).length < max;
}

function tmShowUpgrade(reason) {
  const modal = document.getElementById('upgrade-modal');
  if (modal) {
    const el = document.getElementById('upgrade-reason');
    if (el) el.textContent = reason || 'Bu funksiya Pro rejasida mavjud.';
    modal.style.display = 'flex';
  } else {
    alert('⭐ Upgrade kerak!\n\n' + (reason || 'Pro rejaga o\'ting.'));
  }
}

async function loadTradesFromSupabase() {
  const { data, error } = await sb
    .from('trades')
    .select('*')
    .eq('user_id', TM.user.id)
    .order('created_at', { ascending: false });
  if (error) { console.error(error.message); return; }
  window.trades = (data || []).map(normalizeTradeFromDB);
  if (typeof updateStats === 'function') updateStats();
  if (typeof renderJournal === 'function') renderJournal();
}

function normalizeTradeFromDB(t) {
  return {
    id: t.id, _dbId: t.id,
    pair: t.pair || '', type: t.type || 'LONG',
    result: t.result || '', net: parseFloat(t.net) || 0,
    gross: parseFloat(t.gross) || 0, commission: parseFloat(t.commission) || 0,
    rr: t.rr || '—', tf: t.tf || '',
    open: t.open_time, close: t.close_time,
    entry: t.entry, sl: t.sl, tp: t.tp, exit: t.exit_price,
    size: t.size, notes: t.notes || '', tags: t.tags || [],
    screenshot: t.screenshot_url || '', created_at: t.created_at,
  };
}

function normalizeTradeForDB(t) {
  return {
    user_id: TM.user.id,
    pair: t.pair || '', type: t.type || 'LONG', result: t.result || null,
    net: parseFloat(t.net) || 0, gross: parseFloat(t.gross) || null,
    commission: parseFloat(t.commission) || 0, rr: t.rr || null, tf: t.tf || null,
    open_time: t.open || null, close_time: t.close || null,
    entry: parseFloat(t.entry) || null, sl: parseFloat(t.sl) || null,
    tp: parseFloat(t.tp) || null, exit_price: parseFloat(t.exit) || null,
    size: parseFloat(t.size) || null, notes: t.notes || null,
    tags: t.tags || [], screenshot_url: t.screenshot || null,
  };
}

async function tmAddTrade(tradeData) {
  if (!tmCanAddTrade()) {
    tmShowUpgrade('Free rejada 50 ta savdo limiti. Pro ga o\'ting!');
    return null;
  }
  const { data, error } = await sb.from('trades').insert(normalizeTradeForDB(tradeData)).select().single();
  if (error) { showToast('❌ Saqlanmadi: ' + error.message, 'error'); return null; }
  const normalized = normalizeTradeFromDB(data);
  if (window.trades) window.trades.unshift(normalized);
  showToast('✅ Savdo saqlandi!', 'success');
  return normalized;
}

async function tmUpdateTrade(dbId, tradeData) {
  const { data, error } = await sb.from('trades').update(normalizeTradeForDB(tradeData)).eq('id', dbId).eq('user_id', TM.user.id).select().single();
  if (error) { showToast('❌ Yangilashda xato', 'error'); return null; }
  const idx = (window.trades || []).findIndex(t => t._dbId === dbId);
  if (idx !== -1) window.trades[idx] = normalizeTradeFromDB(data);
  showToast('✅ Yangilandi!', 'success');
  return normalizeTradeFromDB(data);
}

async function tmDeleteTrade(dbId) {
  const { error } = await sb.from('trades').delete().eq('id', dbId).eq('user_id', TM.user.id);
  if (error) { showToast('❌ O\'chirishda xato', 'error'); return false; }
  window.trades = (window.trades || []).filter(t => t._dbId !== dbId);
  showToast('🗑️ O\'chirildi', 'info');
  return true;
}

async function loadAccountSettings() {
  const { data } = await sb.from('account_settings').select('*').eq('user_id', TM.user.id).single();
  if (!data) return;
  const acc = {
    broker: data.broker || '', name: data.account_name || 'Mening hisobim',
    type: data.account_type || 'Demo', currency: data.currency || 'USD',
    init: parseFloat(data.initial_balance) || 0, goal: parseFloat(data.goal) || 1000,
    theme: data.theme || 'dark', lang: data.language || 'uz', fontSize: data.font_size || 'medium',
  };
  localStorage.setItem('tm_account', JSON.stringify(acc));
}

async function tmSaveAccountSettings(settings) {
  await sb.from('account_settings').upsert({
    user_id: TM.user.id, broker: settings.broker || '',
    account_name: settings.name || '', account_type: settings.type || 'Demo',
    currency: settings.currency || 'USD', initial_balance: parseFloat(settings.init) || 0,
    goal: parseFloat(settings.goal) || 1000, theme: settings.theme || 'dark',
    language: settings.lang || 'uz', font_size: settings.fontSize || 'medium',
    updated_at: new Date().toISOString(),
  });
  localStorage.setItem('tm_account', JSON.stringify(settings));
}

async function tmLogout() {
  await sb.auth.signOut();
  localStorage.clear();
  window.location.href = '/auth.html';
}

function updateNavUI() {
  if (!TM.profile) return;
  const name = TM.profile.full_name || TM.user.email.split('@')[0];
  const initial = name.charAt(0).toUpperCase();
  const planLabel = { free: 'Free', pro: 'Pro ⭐', elite: 'Elite 💎' }[TM.plan] || 'Free';
  document.querySelectorAll('.avatar, .sidebar-avatar').forEach(el => el.textContent = initial);
  document.querySelectorAll('.sidebar-uname').forEach(el => el.textContent = name);
  document.querySelectorAll('.sidebar-plan').forEach(el => {
    el.textContent = planLabel;
    el.style.color = TM.plan === 'elite' ? '#f59e0b' : TM.plan === 'pro' ? '#7c3aed' : '#666';
  });
  if (TM.plan === 'free') applyFreeRestrictions();
}

function applyFreeRestrictions() {
  document.querySelectorAll('[data-pro-feature]').forEach(el => {
    el.style.opacity = '0.4';
    el.style.cursor = 'not-allowed';
    el.title = '⭐ Pro rejada mavjud';
    el.onclick = e => { e.preventDefault(); e.stopPropagation(); tmShowUpgrade('Bu funksiya Pro rejasida mavjud.'); };
  });
}

function showToast(msg, type = 'success') {
  const existing = document.getElementById('tm-toast');
  if (existing) existing.remove();
  const colors = {
    success: { bg: 'rgba(0,212,170,0.15)', border: 'rgba(0,212,170,0.3)', color: '#00d4aa' },
    error:   { bg: 'rgba(255,68,68,0.15)',  border: 'rgba(255,68,68,0.3)',  color: '#ff4444' },
    info:    { bg: 'rgba(124,58,237,0.15)', border: 'rgba(124,58,237,0.3)', color: '#a78bfa' },
  };
  const c = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.id = 'tm-toast';
  toast.textContent = msg;
  toast.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${c.bg};border:1px solid ${c.border};color:${c.color};padding:10px 18px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,0.4);`;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2800);
}

function injectUpgradeModal() {
  if (document.getElementById('upgrade-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'upgrade-modal';
  modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);';
  modal.innerHTML = `<div style="background:#0d0d1a;border:1px solid rgba(124,58,237,0.3);border-radius:20px;padding:28px;max-width:360px;width:100%;text-align:center">
    <div style="font-size:36px;margin-bottom:12px">⭐</div>
    <div style="font-size:18px;font-weight:700;margin-bottom:8px">Pro rejaga o'ting</div>
    <div id="upgrade-reason" style="font-size:13px;color:#888;margin-bottom:22px;line-height:1.6"></div>
    <a href="/pricing.html" style="display:block;padding:12px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border-radius:11px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:10px">Narxlarni ko'rish →</a>
    <button onclick="document.getElementById('upgrade-modal').style.display='none'" style="width:100%;padding:10px;background:transparent;border:1px solid rgba(255,255,255,0.1);color:#888;border-radius:10px;cursor:pointer;font-size:13px">Keyinroq</button>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
}

document.addEventListener('DOMContentLoaded', () => {
  injectUpgradeModal();
  tmInit();
});
