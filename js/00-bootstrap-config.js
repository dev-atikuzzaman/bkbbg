
// ═══════════════════════════════════════════════════════
//  GLOBAL SAFETY NET — never allow a blank/white screen
// ═══════════════════════════════════════════════════════
window.addEventListener('error', function(ev){
  console.error('Unhandled error:', ev.error || ev.message);
  const authEl = document.getElementById('authScreen');
  const appEl  = document.getElementById('appShell');
  const authVisible = authEl && getComputedStyle(authEl).display !== 'none';
  const appVisible  = appEl  && getComputedStyle(appEl).display  !== 'none';
  if(!authVisible && !appVisible){
    // Both hidden = white screen. Recover into whichever screen makes sense.
    if(typeof currentUser !== 'undefined' && currentUser){
      appEl.style.display='block';
    } else {
      authEl.style.display='flex';
    }
  }
});
window.addEventListener('unhandledrejection', function(ev){
  console.error('Unhandled promise rejection:', ev.reason);
});

// ═══════════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════════
const CFG = {
  SUPER_ADMIN_EMAIL: 'atikuzzaman53@gmail.com',
  TABLE_TXN:    'stock_transactions', // 🆕 একীভূত লেনদেন টেবিল (stock_items + unload_logs-এর জায়গায়)
  TABLE_PROF:   'profiles',
  TABLE_MANPOWER: 'manpower',
  TABLE_ACTIVITIES: 'activities',
  TABLE_ATTENDANCE: 'attendance',
  TABLE_DOCS: 'doc_items',              // 🆕 ফাইল/ডকুমেন্টস ট্যাব
  TABLE_AUDIT: 'audit_log',             // 🆕 কার্যকলাপ ইতিহাস
  TABLE_ERRORLOG: 'error_log',          // 🆕 এরর ট্র্যাকিং
  TABLE_BACKUPS: 'backup_snapshots',    // 🆕 অটোমেটিক ডেইলি ব্যাকআপ (ভিউ-অনলি, শুধু pg_cron লেখে)
  TABLE_FIN_SETTINGS: 'finance_settings',     // 🆕 হিসাব ট্যাব — গ্যাসের দাম ইত্যাদি সেটিংস
  TABLE_GAS_ENTRIES: 'finance_gas_entries',   // 🆕 হিসাব ট্যাব — দৈনিক গ্যাস উৎপাদন/আয়
  FT3_TO_M3: 0.0283168, // 🆕 আদর্শ কনভার্সন ফ্যাক্টর: 1 ঘনফুট = 0.0283168 ঘনমিটার (1 MMSCFD ≈ 28,316.85 SCM/day)
  SENTRY_DSN: '', // ঐচ্ছিক — sentry.io থেকে ফ্রি অ্যাকাউন্ট বানিয়ে DSN বসালে উন্নত এরর-ট্র্যাকিং চালু হবে
  STORAGE_BUCKET: 'documents',          // 🆕 Supabase Storage বাকেট (ফাইলের বাইট এখানে)
  MAX_VIDEO_SECONDS: 60,                // 🆕 ভিডিওর সর্বোচ্চ দৈর্ঘ্য
  URL: 'https://tqixslcjpeqbsoumnblo.supabase.co',
  KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxaXhzbGNqcGVxYnNvdW1uYmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MTgzMjQsImV4cCI6MjA5OTA5NDMyNH0.0Sv4-WMsxK4kFDXUL5b1LF6LGNYR0ti5niAEmzHWb8M',
};

// ═══════════════════════════════════════════════════════
//  🆕 এরর ট্র্যাকিং — কোনো জাভাস্ক্রিপ্ট এরর/ক্র্যাশ হলে স্বয়ংক্রিয়ভাবে
//  ডাটাবেজে জমা হয়ে যায় (ব্যবহারকারীকে স্ক্রিনশট পাঠাতে হয় না)।
//  raw fetch() ব্যবহার করা হয়েছে ইচ্ছাকৃতভাবে — supa()/অন্য হেল্পার
//  ফাংশন নিজেই যদি ভেঙে পড়ে (যেই বাগটা ধরার কথা), তাহলেও যেন এই
//  লগিং পাথ কাজ করে, তাই সম্পূর্ণ স্বাধীন ও সরলভাবে লেখা।
// ═══════════════════════════════════════════════════════
let _lastLoggedError = ''; // একই এরর বারবার (লুপে) লগ হয়ে স্প্যাম হওয়া ঠেকানোর জন্য
function logClientError(message, stack, sourceInfo){
  try{
    const msg = String(message||'').slice(0,500);
    const key = msg+'|'+String(sourceInfo||'');
    if(key === _lastLoggedError) return; // পরপর একই এরর হলে দ্বিতীয়বার আর পাঠানো হচ্ছে না
    _lastLoggedError = key;
    const entry = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      actor_email: (typeof currentUser!=='undefined' && currentUser?.email) || null,
      actor_name:  (typeof currentUser!=='undefined' && (currentUser?.name||currentUser?.email)) || null,
      message: msg,
      stack: String(stack||'').slice(0,2000),
      url: String(sourceInfo||location.href),
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
    };
    // অফলাইনেও ইতিহাস হারাবে না — লোকাল ক্যাশে রাখা হচ্ছে
    try{
      const logs = JSON.parse(localStorage.getItem('bgfcl_errors')||'[]');
      logs.unshift(entry); if(logs.length>200) logs.length=200;
      localStorage.setItem('bgfcl_errors', JSON.stringify(logs));
    }catch(_e){}
    fetch(CFG.URL+'/rest/v1/'+CFG.TABLE_ERRORLOG, {
      method:'POST',
      headers:{'apikey':CFG.KEY,'Authorization':'Bearer '+CFG.KEY,'Content-Type':'application/json','Prefer':'return=minimal'},
      body: JSON.stringify(entry),
    }).catch(()=>{});
    // ঐচ্ছিক Sentry — DSN বসানো থাকলে সেখানেও পাঠানো হবে
    if(window.Sentry) window.Sentry.captureException(new Error(msg));
  }catch(_e){ /* এরর লগ করতে গিয়ে নিজেই এরর হলে চুপচাপ থেমে যাওয়া হচ্ছে — ইনফাইনাইট লুপ এড়াতে */ }
}
window.addEventListener('error', function(e){
  logClientError(e.message, e.error?.stack, (e.filename||'')+':'+(e.lineno||''));
});
window.addEventListener('unhandledrejection', function(e){
  const r=e.reason;
  logClientError('Unhandled Promise Rejection: '+(r?.message||r), r?.stack, '');
});
// ঐচ্ছিক Sentry ইন্টিগ্রেশন — CFG.SENTRY_DSN খালি থাকলে কিছুই লোড হবে না,
// অ্যাপ স্বাভাবিকভাবে চলবে (উপরের internal error_log-ই একাই যথেষ্ট)
if(CFG.SENTRY_DSN){
  const _sc=document.createElement('script');
  _sc.src='https://browser.sentry-cdn.com/7.120.3/bundle.tracing.min.js';
  _sc.crossOrigin='anonymous';
  _sc.onload=function(){
    window.Sentry.init({ dsn: CFG.SENTRY_DSN, tracesSampleRate: 0.2 });
    if(typeof currentUser!=='undefined' && currentUser?.email) window.Sentry.setUser({email:currentUser.email});
  };
  document.head.appendChild(_sc);
}

const DEPT = {
  field:      {name:'ফিল্ড মেইনটেন্যান্স',  icon:'🔧', color:'#3B82F6', bg:'#DBEAFE'},
  plant:      {name:'প্লান্ট মেইনটেন্যান্স', icon:'🏭', color:'#10B981', bg:'#D1FAE5'},
  production: {name:'প্রোডাকশন',              icon:'⚗️', color:'#8B5CF6', bg:'#EDE9FE'},
  compressor: {name:'কম্প্রেসর',              icon:'💨', color:'#F97316', bg:'#FFEDD5'},
  security:   {name:'সিকিউরিটি',              icon:'🛡️', color:'#EF4444', bg:'#FEE2E2'},
  admin:      {name:'প্রশাসন',                icon:'📋', color:'#F4A300', bg:'#FEF3C7'},
  electric:   {name:'ইলেক্ট্রিক্যাল',                icon:'⚡', color:'#14B8A6', bg:'#CCFBF1'},
  generator:  {name:'জেনারেটর',               icon:'🔋', color:'#0EA5E9', bg:'#E0F2FE'},
  housing:    {name:'হাউজিং',                 icon:'🏠', color:'#84CC16', bg:'#ECFCCB'},
  condensate: {name:'কনডেনসেট প্রসেসিং',      icon:'💧', color:'#06B6D4', bg:'#CFFAFE'},
  firesafety: {name:'ফায়ার সেফটি',            icon:'🧯', color:'#DC2626', bg:'#FEE2E2'},
  mi_room:    {name:'এম. আই রুম',              icon:'🎛️', color:'#7C3AED', bg:'#EDE9FE'},
  heavy_vehicle: {name:'ভারি যান',            icon:'🚛', color:'#78716C', bg:'#F5F5F4'},
  mechanical: {name:'মেকানিক্যাল',            icon:'⚙️', color:'#475569', bg:'#F1F5F9'},
  accounts:   {name:'একাউন্টস',               icon:'🧾', color:'#059669', bg:'#D1FAE5'},
};
const MN = ['','জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
const AUDIT_ACTION_LABEL={create:'✅ তৈরি',update:'✏️ আপডেট',delete:'🗑️ মুছেছে',move:'📂 সরিয়েছে',copy:'📄 কপি করেছে',upload:'⬆️ আপলোড',rename:'✏️ রিনেম'};
const AUDIT_MODULE_LABEL={materials:'📦 মালামাল',manpower:'👷 জনবল',activities:'📝 কার্যক্রম',docs:'📁 ফাইল',finance:'🧾 হিসাব'};

