// ═══════════════════════════════════════════════════════
//  USER CHIP & MENU
// ═══════════════════════════════════════════════════════
const ROLE_LABEL = {
  super:{full:'সুপার এডমিন', short:'সুপার'},
  admin:{full:'শাখা এডমিন',  short:'এডমিন'},
  viewer:{full:'ভিউয়ার',     short:'ভিউয়ার'},
  pending:{full:'অনুমোদনের অপেক্ষায়', short:'পেন্ডিং'},
};
const DEPT_SHORT = {field:'ফিল্ড', plant:'পিএম', production:'প্রোডাকশন', compressor:'কম্প্রেসর', security:'সিকিউরিটি', admin:'প্রশাসন', electric:'ইলেক্ট্রিক্যাল', generator:'জেনারেটর', housing:'হাউজিং', condensate:'কনডেনসেট', firesafety:'ফায়ার সেফটি', mi_room:'এম.আই রুম', heavy_vehicle:'ভারি যান', mechanical:'মেকানিক্যাল', accounts:'একাউন্টস'};

function updateUserChip(){
  if(!currentUser) return;
  const n = currentUser.name || currentUser.email || 'ব্যবহারকারী';
  const rm = ROLE_LABEL[currentUser.role] || ROLE_LABEL.viewer;
  const deptKey = currentUser.reqDept || currentUser.dept;
  const deptFull = DEPT[deptKey]?.name || '';
  const deptShort = DEPT_SHORT[deptKey] || deptFull;
  document.getElementById('officerName').textContent = n.length>18 ? n.slice(0,18)+'…' : n;
  document.getElementById('officerRole').textContent = rm.full;
  document.getElementById('officerDept').textContent = currentUser.role==='super' ? 'সকল শাখা' : deptFull;
  document.getElementById('officerCompact').textContent = currentUser.role==='super' ? rm.short+', সকল শাখা' : `${rm.short}, ${deptShort}`;
}

function updateActionBar(){
  const r = currentUser?.role;
  const canWrite = r==='super' || r==='admin';
  document.getElementById('actionBar').style.display = canWrite ? '' : 'none';
  document.getElementById('logActCol').textContent = canWrite ? 'কার্যক্রম' : '';
  document.getElementById('actionBarManpower').style.display   = canWrite ? '' : 'none';
  document.getElementById('actionBarActivities').style.display = canWrite ? '' : 'none';
  document.getElementById('actionBarDocs').style.display       = canWrite ? '' : 'none';
  // 🆕 হিসাব — কোম্পানি-ব্যাপী আর্থিক তথ্য, তাই শাখাভিত্তিক admin না, শুধু super admin এডিট করতে পারবে
  document.getElementById('actionBarFinance').style.display     = (r==='super') ? '' : 'none';
  document.getElementById('dailyActCol').textContent    = canWrite ? 'একশন' : '';
  document.getElementById('staffActCol').textContent    = canWrite ? 'একশন' : '';
  document.getElementById('officerActCol').textContent  = canWrite ? 'একশন' : '';
  document.getElementById('activityActCol').textContent = canWrite ? 'একশন' : '';
  document.getElementById('gasEntryActCol').textContent = (r==='super') ? 'একশন' : '';
}

function showUserMenu(){
  const u = currentUser;
  const r = u?.role;
  const deptName = DEPT[u?.dept]?.name || '—';
  const reqDeptName = DEPT[u?.reqDept]?.name || '—';
  let html = `
    <div style="text-align:center;margin-bottom:16px;">
      <div style="width:60px;height:60px;border-radius:50%;background:${r==='super'?'#F4A300':r==='admin'?'#3B82F6':'#64748B'};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:white;margin:0 auto 10px;">${escHtml((u?.name||'?')[0]?.toUpperCase())}</div>
      <strong style="font-size:15px;">${escHtml(u?.name)||'অজ্ঞাত'}</strong><br/>
      <span style="font-size:12px;color:#64748B;">${escHtml(u?.email)}</span>
    </div>
    <div style="background:#F8FAFC;border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#64748B;">ভূমিকা</span><strong>${r==='super'?'👑 সুপার অ্যাডমিন':r==='admin'?'🔑 শাখা অ্যাডমিন':r==='pending'?'⏳ পেন্ডিং':'👁️ ভিউয়ার'}</strong></div>
      ${r!=='viewer'&&r!=='pending'?`<div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">শাখা</span><strong>${r==='super'?'সকল শাখা':reqDeptName}</strong></div>`:''}
    </div>
  `;
  html+=`<button onclick="closeModal('modalUser');openDisplaySettings();" style="width:100%;background:#F1F5F9;border:1px solid var(--border);border-radius:9px;padding:10px;font-family:var(--f);font-size:13px;color:var(--navy);font-weight:600;cursor:pointer;margin-bottom:8px;">🔤 ফন্ট ও ডিসপ্লে</button>`;
  html+=`<button onclick="closeModal('modalUser');startOnboarding();" style="width:100%;background:#F1F5F9;border:1px solid var(--border);border-radius:9px;padding:10px;font-family:var(--f);font-size:13px;color:var(--navy);font-weight:600;cursor:pointer;margin-bottom:8px;">❓ টিউটোরিয়াল আবার দেখুন</button>`;
  if(r==='super'||r==='admin'){
    html+=`<button onclick="closeModal('modalUser');openAuditLog();" style="width:100%;background:#F1F5F9;border:1px solid var(--border);border-radius:9px;padding:10px;font-family:var(--f);font-size:13px;color:var(--navy);font-weight:600;cursor:pointer;margin-bottom:8px;">🕓 কার্যকলাপ লগ (অডিট)</button>`;
    html+=`<button onclick="closeModal('modalUser');openErrorLog();" style="width:100%;background:#F1F5F9;border:1px solid var(--border);border-radius:9px;padding:10px;font-family:var(--f);font-size:13px;color:var(--navy);font-weight:600;cursor:pointer;margin-bottom:8px;">🐞 এরর লগ</button>`;
  }
  if(r==='super'){
    html+=`<button onclick="closeModal('modalUser');openBackupList();" style="width:100%;background:#F1F5F9;border:1px solid var(--border);border-radius:9px;padding:10px;font-family:var(--f);font-size:13px;color:var(--navy);font-weight:600;cursor:pointer;margin-bottom:8px;">🗄️ ব্যাকআপ তালিকা</button>`;
  }
  html+=`<button onclick="doLogout()" style="width:100%;background:var(--red-l);border:1px solid #FECACA;border-radius:9px;padding:10px;font-family:var(--f);font-size:13px;color:#DC2626;font-weight:600;cursor:pointer;">🚪 লগআউট</button>`;
  document.getElementById('userMenuBody').innerHTML=html;
  openModal('modalUser');
}

function doLogout(){
  if(supaSession && CFG.URL){
    fetch(CFG.URL+'/auth/v1/logout',{method:'POST',headers:{'apikey':CFG.KEY,'Authorization':'Bearer '+supaSession.access_token}}).catch(()=>{});
  }
  stopRealtime();
  localStorage.removeItem('bgfcl_user');
  localStorage.removeItem('supa_session');
  currentUser=null; supaSession=null;
  closeModal('modalUser');
  document.getElementById('appShell').style.display='none';
  document.getElementById('authScreen').style.display='flex';
  document.getElementById('authTabs').style.display='';
  switchAuthTab('login');
  toast('✅ লগআউট হয়েছে');
}

// ═══════════════════════════════════════════════════════
//  🆕 কার্যকলাপ লগ (অডিট) — ভিউয়ার
// ═══════════════════════════════════════════════════════
let _auditFilter='all';
// 🆕 সার্ভার-সাইড পেজিনেশন — audit_log সময়ের সাথে অনেক বড় হতে পারে,
// তাই একসাথে সবটা না এনে পাতায় পাতায় (৫০টা করে) আনা হয়। auditViewerRows
// শুধু এই মোডাল-ভিউয়ারের জন্য — localStorage ক্যাশ (getAuditLog, যেটা
// ওভারভিউ ড্যাশবোর্ডের "সাম্প্রতিক কার্যকলাপ" ফিডে ব্যবহার হয়) এখানে
// প্রভাবিত হয় না, শুধু un-filtered প্রথম পাতা দিয়ে সেটা রিফ্রেশ করা হয়।
let auditPage = 0;
const AUDIT_PAGE_SIZE = 50;
let auditHasMore = true;
let auditLoading = false;
let auditViewerRows = [];

async function openAuditLog(){
  openModal('modalAuditLog');
  auditPage = 0; auditHasMore = true; auditViewerRows = [];
  renderAuditModuleFilter();
  await loadAuditPage(true);
}
function setAuditFilter(k){
  _auditFilter = k;
  renderAuditModuleFilter();
  auditPage = 0; auditHasMore = true; auditViewerRows = [];
  loadAuditPage(true);
}
async function loadAuditPage(replace){
  if(auditLoading || (!replace && !auditHasMore)) return;
  auditLoading = true;
  const box=document.getElementById('auditLogList');
  if(replace) box.innerHTML='⏳ লোড হচ্ছে...';
  else{ const btn=document.getElementById('auditLoadMoreBtn'); if(btn){ btn.textContent='⏳ লোড হচ্ছে...'; btn.disabled=true; } }
  try{
    let q = CFG.TABLE_AUDIT+`?order=created_at.desc&limit=${AUDIT_PAGE_SIZE}&offset=${auditPage*AUDIT_PAGE_SIZE}`;
    if(_auditFilter!=='all') q += `&module=eq.${_auditFilter}`;
    const rows = (await supa(q)) || [];
    auditViewerRows = replace ? rows : [...auditViewerRows, ...rows];
    auditHasMore = rows.length===AUDIT_PAGE_SIZE;
    auditPage++;
    if(replace && _auditFilter==='all') saveAuditLog(rows); // ওভারভিউ ফিডের জন্য সবচেয়ে নতুন পাতাটা ক্যাশে রাখা হচ্ছে
  }catch(e){
    if(replace) box.innerHTML=`<div class="empty-st"><div class="ei">⚠️</div><p>লোড করা যায়নি — ইন্টারনেট চেক করুন</p></div>`;
    auditLoading=false; return;
  }
  renderAuditLogList();
  auditLoading=false;
}
function renderAuditModuleFilter(){
  const box=document.getElementById('auditModuleFilter');
  const modules=[['all','সব'],['materials','📦 মালামাল'],['manpower','👷 জনবল'],['activities','📝 কার্যক্রম'],['docs','📁 ফাইল'],['finance','🧾 হিসাব']];
  box.innerHTML = modules.map(([k,l])=>`<span class="doc-tag-chip${_auditFilter===k?' active':''}" onclick="setAuditFilter('${k}')">${l}</span>`).join('');
}
function renderAuditLogList(){
  const box=document.getElementById('auditLogList');
  const logs=auditViewerRows;
  if(!logs.length){ box.innerHTML=`<div class="empty-st"><div class="ei">🕓</div><p>কোনো কার্যকলাপ পাওয়া যায়নি</p></div>`; return; }
  const actionLabel=AUDIT_ACTION_LABEL, moduleLabel=AUDIT_MODULE_LABEL;
  let html = logs.map(l=>{
    const when = l.created_at ? new Date(l.created_at).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}) : '';
    return `<div style="padding:10px 4px;border-bottom:1px solid #F1F5F9;font-size:12px;">
      <div style="display:flex;justify-content:space-between;gap:8px;">
        <strong style="color:var(--navy);">${actionLabel[l.action]||l.action} — ${escHtml(l.record_label||'')}</strong>
        <span style="color:var(--muted);white-space:nowrap;flex-shrink:0;">${when}</span>
      </div>
      <div style="color:var(--muted);margin-top:2px;">${moduleLabel[l.module]||l.module} · ${escHtml(l.actor_name||'অজানা')}${l.details?' · '+escHtml(l.details):''}</div>
    </div>`;
  }).join('');
  if(auditHasMore){
    html += `<button id="auditLoadMoreBtn" onclick="loadAuditPage(false)" style="width:100%;padding:10px;margin-top:10px;background:#F1F5F9;border:1px solid var(--border);border-radius:9px;font-family:var(--f);font-size:12px;font-weight:600;color:var(--navy);cursor:pointer;">⬇️ আরও লোড করুন</button>`;
  }else if(logs.length>AUDIT_PAGE_SIZE){
    html += `<p style="text-align:center;font-size:11px;color:var(--muted);padding:10px;">— সবকিছু দেখানো হয়ে গেছে —</p>`;
  }
  box.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  🆕 এরর লগ — ভিউয়ার (এখানেও একই পেজিনেশন প্যাটার্ন)
// ═══════════════════════════════════════════════════════
let errorPage = 0;
const ERROR_PAGE_SIZE = 50;
let errorHasMore = true;
let errorLoading = false;
let errorViewerRows = [];

async function openErrorLog(){
  openModal('modalErrorLog');
  errorPage=0; errorHasMore=true; errorViewerRows=[];
  await loadErrorPage(true);
}
async function loadErrorPage(replace){
  if(errorLoading || (!replace && !errorHasMore)) return;
  errorLoading = true;
  const box=document.getElementById('errorLogList');
  if(replace) box.innerHTML='⏳ লোড হচ্ছে...';
  else{ const btn=document.getElementById('errorLoadMoreBtn'); if(btn){ btn.textContent='⏳ লোড হচ্ছে...'; btn.disabled=true; } }
  try{
    const q = CFG.TABLE_ERRORLOG+`?order=created_at.desc&limit=${ERROR_PAGE_SIZE}&offset=${errorPage*ERROR_PAGE_SIZE}`;
    const rows = (await supa(q)) || [];
    errorViewerRows = replace ? rows : [...errorViewerRows, ...rows];
    errorHasMore = rows.length===ERROR_PAGE_SIZE;
    errorPage++;
  }catch(e){
    // ক্লাউড থেকে আনা না গেলে (প্রথম পাতায়) লোকাল ক্যাশ দিয়ে দেখানো হচ্ছে
    if(replace){
      errorViewerRows = JSON.parse(localStorage.getItem('bgfcl_errors')||'[]');
      errorHasMore = false;
    }else{ errorLoading=false; return; }
  }
  renderErrorLogList();
  errorLoading=false;
}
function renderErrorLogList(){
  const box=document.getElementById('errorLogList');
  const logs=errorViewerRows;
  if(!logs.length){ box.innerHTML=`<div class="empty-st"><div class="ei">✅</div><p>কোনো এরর পাওয়া যায়নি — সব ঠিকঠাক চলছে</p></div>`; return; }
  let html = logs.map(l=>{
    const when = l.created_at ? new Date(l.created_at).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}) : '';
    return `<div style="padding:10px 4px;border-bottom:1px solid #F1F5F9;font-size:12px;">
      <div style="display:flex;justify-content:space-between;gap:8px;">
        <strong style="color:#DC2626;word-break:break-word;">${escHtml(l.message||'')}</strong>
        <span style="color:var(--muted);white-space:nowrap;flex-shrink:0;">${when}</span>
      </div>
      <div style="color:var(--muted);margin-top:2px;">${escHtml(l.actor_name||'অজানা')} · ${escHtml(l.url||'')}</div>
    </div>`;
  }).join('');
  if(errorHasMore){
    html += `<button id="errorLoadMoreBtn" onclick="loadErrorPage(false)" style="width:100%;padding:10px;margin-top:10px;background:#F1F5F9;border:1px solid var(--border);border-radius:9px;font-family:var(--f);font-size:12px;font-weight:600;color:var(--navy);cursor:pointer;">⬇️ আরও লোড করুন</button>`;
  }else if(logs.length>ERROR_PAGE_SIZE){
    html += `<p style="text-align:center;font-size:11px;color:var(--muted);padding:10px;">— সবকিছু দেখানো হয়ে গেছে —</p>`;
  }
  box.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  🆕 ব্যাকআপ তালিকা — ভিউয়ার (ডাউনলোড-অনলি, সরাসরি রিস্টোর বাটন
//  ইচ্ছাকৃতভাবে রাখা হয়নি — ভুলবশত লাইভ ডেটা ওভাররাইট হওয়ার ঝুঁকি
//  এড়াতে; দরকার হলে ডাউনলোড করা JSON ফাইল ম্যানুয়ালি রিভিউ করে নেয়া
//  উচিত)
// ═══════════════════════════════════════════════════════
let _backupCache=[];
async function openBackupList(){
  openModal('modalBackupList');
  const box=document.getElementById('backupListBody');
  box.innerHTML='⏳ লোড হচ্ছে...';
  try{
    const rows = await supa(CFG.TABLE_BACKUPS+'?order=snapshot_date.desc&select=id,snapshot_date,created_at');
    _backupCache = rows||[];
  }catch(e){ box.innerHTML=`<div class="empty-st"><div class="ei">⚠️</div><p>ব্যাকআপ তালিকা আনা যায়নি — ইন্টারনেট চেক করুন</p></div>`; return; }
  if(!_backupCache.length){ box.innerHTML=`<div class="empty-st"><div class="ei">🗄️</div><p>এখনো কোনো ব্যাকআপ নেয়া হয়নি (SQL সেটআপ ঠিকভাবে রান হয়েছে কিনা যাচাই করুন)</p></div>`; return; }
  box.innerHTML = _backupCache.map(b=>{
    const dateLabel = new Date(b.snapshot_date).toLocaleDateString('bn-BD',{year:'numeric',month:'long',day:'numeric'});
    return `<div class="doc-tree-item"><span>📅 ${dateLabel}</span><button class="doc-tree-btn" onclick="downloadBackupSnapshot('${b.snapshot_date}')">⬇️ ডাউনলোড</button></div>`;
  }).join('');
}
async function downloadBackupSnapshot(snapshotDate){
  toast('⏳ ব্যাকআপ প্রস্তুত হচ্ছে...');
  try{
    const rows = await supa(CFG.TABLE_BACKUPS+'?snapshot_date=eq.'+snapshotDate);
    const snap = rows?.[0]; if(!snap){ toast('❌ পাওয়া যায়নি'); return; }
    const blob = new Blob([JSON.stringify(snap,null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`BGFCL_backup_${snapshotDate}.json`;
    a.click();
    toast('✅ ডাউনলোড হয়েছে');
  }catch(e){ toast('❌ ডাউনলোড ব্যর্থ: '+e.message); }
}

// ═══════════════════════════════════════════════════════
//  PENDING APPROVALS
// ═══════════════════════════════════════════════════════
async function loadPendingApprovals(){
  if(currentUser?.role!=='super') return;
  if(!supaOk) return;
  try{
    const list = await supa(CFG.TABLE_PROF+'?status=eq.pending&order=created_at.asc');
    _pendingProfiles = list; // নিরাপত্তা: onclick অ্যাট্রিবিউটে ইমেইল/নাম সরাসরি না বসিয়ে id দিয়ে এখান থেকে পরে লুকআপ করা হয়
    const banner = document.getElementById('pendingBanner');
    const plist  = document.getElementById('pendingList');
    document.getElementById('pendingCount').textContent = list.length;
    if(!list.length){ banner.style.display='none'; return; }
    banner.style.display='block';
    plist.innerHTML = list.map(p=>`
      <div class="pending-card">
        <div class="pending-info">
          <strong>${escHtml(p.name)} — ${escHtml(p.designation)}</strong>
          <span>${escHtml(DEPT[p.req_dept]?.name||p.req_dept)} শাখার অ্যাডমিন · ${escHtml(p.email)}</span>
        </div>
        <button class="btn-approve" onclick="approveUser('${p.id}')">✅ অনুমোদন</button>
        <button class="btn-reject"  onclick="rejectUser('${p.id}')">❌ বাতিল</button>
      </div>`).join('');
  }catch(e){ console.log('pending load error',e); }
}

async function approveUser(id){
  const p = _pendingProfiles.find(x=>x.id===id); if(!p) return;
  showLoader('অনুমোদন করা হচ্ছে...');
  try{
    await supa(CFG.TABLE_PROF+'?id=eq.'+id,'PATCH',{role:'admin',status:'approved',req_dept:p.req_dept});
    // Notify via mailto
    const sub = encodeURIComponent(`[BGFCL Inventory] আপনার অ্যাডমিন অনুরোধ অনুমোদিত হয়েছে`);
    const body= encodeURIComponent(`${p.name},\n\nআপনার ${DEPT[p.req_dept]?.name||p.req_dept} শাখার অ্যাডমিন অনুরোধ অনুমোদিত হয়েছে।\nএখন অ্যাপে লগইন করুন।`);
    window.open(`mailto:${p.email}?subject=${sub}&body=${body}`,'_blank');
    hideLoader();
    toast('✅ অনুমোদন সম্পন্ন');
    loadPendingApprovals();
  }catch(e){ hideLoader(); toast('❌ ব্যর্থ: '+e.message); }
}

async function rejectUser(id){
  const p = _pendingProfiles.find(x=>x.id===id); if(!p) return;
  if(!confirm(`${p.name} এর অনুরোধ বাতিল করবেন?`)) return;
  showLoader('বাতিল করা হচ্ছে...');
  try{
    await supa(CFG.TABLE_PROF+'?id=eq.'+id,'PATCH',{status:'rejected'});
    hideLoader(); toast('🗑️ অনুরোধ বাতিল করা হয়েছে');
    loadPendingApprovals();
  }catch(e){ hideLoader(); toast('❌ ব্যর্থ: '+e.message); }
}

