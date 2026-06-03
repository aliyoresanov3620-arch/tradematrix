// TradeMatrix Header
(function() {
  const header = document.createElement('div');
  header.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 60px;
    background: rgba(10,10,15,0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid #1a1a2e;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    z-index: 9999;
  `;
  
  header.innerHTML = `
    <div style="color:#00d4aa;font-weight:bold;font-size:18px">
      🚀 TradeMatrix
    </div>
    <div id="tm-auth-btn"></div>
  `;
  
  document.body.prepend(header);
  document.body.style.paddingTop = '60px';

  const sb = window.supabase?.createClient(
    'https://qvenslskfdhnjckzxipj.supabase.co',
    'sb_publishable_ArcsmhTCD4s1KSnYOlnyFQ_RvGqsW0P'
  );

  function renderAuth(user) {
    const btn = document.getElementById('tm-auth-btn');
    if (!btn) return;
    if (user) {
      btn.innerHTML = `
        <span style="color:#888;font-size:13px;margin-right:8px">${user.email.split('@')[0]}</span>
        <button onclick="tmLogout()" style="background:#1a1a2e;color:#ff4444;border:1px solid #ff4444;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:13px">Chiqish</button>
      `;
    } else {
      btn.innerHTML = `
        <a href="/auth.html" style="background:#00d4aa;color:#000;padding:8px 18px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px">Kirish</a>
      `;
    }
  }

  if (sb) {
    sb.auth.getSession().then(({ data }) => renderAuth(data?.session?.user));
    sb.auth.onAuthStateChange((e, session) => renderAuth(session?.user));
  }

  window.tmLogout = async function() {
    if (sb) await sb.auth.signOut();
    window.location.href = '/auth.html';
  };
})();
