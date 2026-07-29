// ═══════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════
let Y = new Date().getFullYear(), M = new Date().getMonth()+1;
let filterDept = 'all', filterChart = 'bar';
let currentTab = 'overview'; // 'overview' | 'materials' | 'manpower' | 'activities' | 'docs'
let _pendingProfiles = []; // সুপার অ্যাডমিনের pending approval তালিকার ক্যাশ (নিরাপদ id-ভিত্তিক লুকআপের জন্য)
let chartInst = null, deferredPrompt = null;
let supaOk = false;
let currentUser = null; // {id, email, role:'super'|'admin'|'viewer'|'pending', name, dept, reqDept}
let supaSession = null;

// ═══════════════════════════════════════════════════════
//  LOCAL DATA
// ═══════════════════════════════════════════════════════
// 🆕 একীভূত লেনদেন ডেটা (stock_items + unload_logs-এর জায়গায়)
const SAMPLE_TXNS = [
  {id:'t1',dept:'field',product_name:'বল ভালভ ২ ইঞ্চি',txn_type:'in',qty:24,unit:'পিস',source:'রহিম ট্রেডিং',purpose:null,work_order:null,note:'',image_data:null,txn_date:'2025-01-05',month:1,year:2025},
  {id:'t2',dept:'plant',product_name:'লুব্রিকেটিং অয়েল SAE-40',txn_type:'in',qty:200,unit:'লিটার',source:'তোতা এন্টারপ্রাইজ',purpose:null,work_order:null,note:'',image_data:null,txn_date:'2025-01-10',month:1,year:2025},
];
function getTxns(){ return JSON.parse(localStorage.getItem('bgfcl_txns')||'null') || SAMPLE_TXNS; }
function saveTxns(d){ localStorage.setItem('bgfcl_txns',JSON.stringify(d)); }

// 🆕 ফাইল/ডকুমেন্টস (ফোল্ডার + ফাইল, একই টেবিলে গাছ-আকারে parent_id দিয়ে)
function getDocs(){ return JSON.parse(localStorage.getItem('bgfcl_docs')||'null') || []; }
function saveDocs(d){ localStorage.setItem('bgfcl_docs',JSON.stringify(d)); }

// 🆕 কার্যকলাপ ইতিহাস (অডিট লগ) — কে কখন কী করলো
function getAuditLog(){ return JSON.parse(localStorage.getItem('bgfcl_audit')||'null') || []; }
function saveAuditLog(d){ localStorage.setItem('bgfcl_audit',JSON.stringify(d)); }
function logAudit(module, action, recordLabel, details){
  const entry = {
    id: crypto.randomUUID(),
    actor_email: currentUser?.email || null,
    actor_name:  currentUser?.name  || currentUser?.email || 'অজানা',
    actor_role:  currentUser?.role  || null,
    dept:        currentUser?.reqDept || null,
    module, action, record_label: recordLabel || null, details: details || null,
    created_at: new Date().toISOString(),
  };
  const logs=getAuditLog();
  logs.unshift(entry);
  if(logs.length>500) logs.length=500; // লোকাল ক্যাশ সীমিত রাখা হচ্ছে
  saveAuditLog(logs);
  // অডিট-লগ ক্লাউডে ব্যর্থ হলেও মূল অ্যাকশন যেন কোনোভাবে আটকে না যায়, তাই silent-fail
  if(supaOk) supa(CFG.TABLE_AUDIT,'POST',entry).catch(()=>{});
}
function getManpower(){    return JSON.parse(localStorage.getItem('bgfcl_manpower')||'null')   || []; }
function getActivities(){  return JSON.parse(localStorage.getItem('bgfcl_activities')||'null') || []; }
function saveManpower(d){  localStorage.setItem('bgfcl_manpower', JSON.stringify(d)); }
function saveActivities(d){localStorage.setItem('bgfcl_activities', JSON.stringify(d)); }

// ── দৈনিক শ্রমিক উপস্থিতি (ATTENDANCE) ──
function getAttendance(){ return JSON.parse(localStorage.getItem('bgfcl_attendance')||'null') || {}; }
function saveAttendanceData(d){ localStorage.setItem('bgfcl_attendance', JSON.stringify(d)); }
function setAttendance(workerId, date, status){
  const att = getAttendance();
  att[workerId] = att[workerId] || {};
  att[workerId][date] = status;
  saveAttendanceData(att);
  if(supaOk) supa(CFG.TABLE_ATTENDANCE, 'POST', {id:`${workerId}_${date}`, worker_id:workerId, date, status}).catch(notifyCloudSyncFail);
}
function removeAttendance(workerId, date){
  const att = getAttendance();
  if(att[workerId]){ delete att[workerId][date]; saveAttendanceData(att); }
  if(supaOk) supa(CFG.TABLE_ATTENDANCE+'?id=eq.'+`${workerId}_${date}`, 'DELETE').catch(notifyCloudSyncFail);
}
function countPresentDays(workerId, start, end){
  const att = getAttendance()[workerId] || {};
  let count=0;
  for(const d in att){ if(att[d]==='P' && d>=start && d<=end) count++; }
  return count;
}

// ── উপস্থিতি রিপোর্ট: অতিরিক্ত কর্মদিবস, অতিরিক্ত কলাম, কোম্পানি হেডার, বিবরণ ──
function getExtraDaysMap(){ return JSON.parse(localStorage.getItem('bgfcl_extradays')||'null') || {}; }
function saveExtraDaysMap(d){ localStorage.setItem('bgfcl_extradays', JSON.stringify(d)); }
function getExtraDays(workerId, rangeKey){ const m=getExtraDaysMap(); return (m[workerId] && m[workerId][rangeKey]) || 0; }
function setExtraDays(workerId, rangeKey, val){
  const m=getExtraDaysMap(); m[workerId]=m[workerId]||{}; m[workerId][rangeKey]=val; saveExtraDaysMap(m);
}

function getReportExtraCols(){ return JSON.parse(localStorage.getItem('bgfcl_report_extracols')||'null') || []; }
function saveReportExtraCols(d){ localStorage.setItem('bgfcl_report_extracols', JSON.stringify(d)); }

function getReportExtraColVals(){ return JSON.parse(localStorage.getItem('bgfcl_report_extracol_vals')||'null') || {}; }
function saveReportExtraColVals(d){ localStorage.setItem('bgfcl_report_extracol_vals', JSON.stringify(d)); }
function getReportExtraColVal(workerId, rangeKey, colId){
  const m=getReportExtraColVals();
  return (m[workerId] && m[workerId][rangeKey] && m[workerId][rangeKey][colId]) || '';
}
function setReportExtraColVal(workerId, rangeKey, colId, val){
  const m=getReportExtraColVals();
  m[workerId]=m[workerId]||{}; m[workerId][rangeKey]=m[workerId][rangeKey]||{};
  m[workerId][rangeKey][colId]=val; saveReportExtraColVals(m);
}

function getReportHeader(){ return JSON.parse(localStorage.getItem('bgfcl_report_header')||'null') || {
  mainCompany:'বাখরাবাদ গ্যাস ফিল্ডস কোম্পানি লিমিটেড (BGFCL)',
  subCompany:'', subAddress:'', title:'দৈনিক শ্রমিক উপস্থিতি ও কর্মদিবস প্রতিবেদন'
}; }
function saveReportHeader(d){ localStorage.setItem('bgfcl_report_header', JSON.stringify(d)); }

function getReportDescMap(){ return JSON.parse(localStorage.getItem('bgfcl_report_desc')||'null') || {}; }
function saveReportDescMap(d){ localStorage.setItem('bgfcl_report_desc', JSON.stringify(d)); }
function getReportDesc(dept, rangeKey){ const m=getReportDescMap(); return (m[dept] && m[dept][rangeKey]) || ''; }
function setReportDesc(dept, rangeKey, text){
  const m=getReportDescMap(); m[dept]=m[dept]||{}; m[dept][rangeKey]=text; saveReportDescMap(m);
}

// ── কাস্টম ফিল্ড (মালামাল/জনবল/কার্যক্রম — সব মডিউলে) ──
function getCustomDefs(){ return JSON.parse(localStorage.getItem('bgfcl_customfields')||'null') || {items:[],manpower:[],activities:[]}; }
function saveCustomDefs(d){ localStorage.setItem('bgfcl_customfields', JSON.stringify(d)); }
let _cfValueCache = {items:{}, manpower:{}, activities:{}}; // বর্তমানে খোলা ফর্মের কাস্টম ফিল্ড মান (ইমেজের জন্য দরকার)
// নিরাপত্তা: ব্যবহারকারীর টাইপ করা যেকোনো টেক্সট HTML-এ বসানোর আগে escape করা
// আবশ্যক, নাহলে কেউ নাম/বিবরণ ফিল্ডে script বসিয়ে অন্যদের ব্রাউজারে চালাতে পারবে (stored XSS)
function escHtml(s){
  if(s===null || s===undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// নিরাপত্তা/নির্ভরযোগ্যতা: ক্লাউডে সেভ ব্যর্থ হলে ব্যবহারকারীকে জানানো হয়,
// যাতে ডেটা "নীরবে" শুধু লোকালে আটকে না থেকে পরে বিভ্রান্তি তৈরি না করে।
// (লোকাল কপি ঠিকই থাকবে — শুধু ক্লাউড সিঙ্ক নিয়ে সতর্ক করা হচ্ছে।)
function notifyCloudSyncFail(e){
  const reason = (e?.message || String(e) || 'অজানা কারণ').slice(0,120);
  console.warn('ক্লাউড সিঙ্ক ব্যর্থ:', reason);
  toast('⚠️ ক্লাউড সিঙ্ক ব্যর্থ: '+reason);
}

function readFileAsDataURL(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=()=>rej(new Error('ফাইল পড়া যায়নি'));
    r.readAsDataURL(file);
  });
}

function openCustomFieldManager(module, refreshTargetId){
  document.getElementById('cfModule').value = module;
  document.getElementById('cfRefreshTarget').value = refreshTargetId;
  document.getElementById('cfLabel').value='';
  document.getElementById('cfOptions').value='';
  document.getElementById('cfType').value='text';
  toggleCfOptionsField();
  renderCfDefList();
  openModal('modalCustomField');
}

function toggleCfOptionsField(){
  document.getElementById('cfOptionsWrap').style.display = document.getElementById('cfType').value==='dropdown' ? '' : 'none';
}

function renderCfDefList(){
  const module = document.getElementById('cfModule').value;
  const defs = getCustomDefs()[module] || [];
  const box = document.getElementById('cfDefList');
  if(!defs.length){
    box.innerHTML = `<p style="font-size:12px;color:#94A3B8;text-align:center;padding:8px;">এখনো কোনো কাস্টম ফিল্ড যোগ করা হয়নি</p>`;
    return;
  }
  const typeLabel = {text:'টেক্সট', dropdown:'ড্রপডাউন', image:'ইমেজ'};
  box.innerHTML = defs.map(d=>`
    <div class="cf-row">
      <div style="font-size:13px;"><strong>${escHtml(d.label)}</strong> <span style="color:#94A3B8;font-size:11px;">(${typeLabel[d.type]||d.type})</span></div>
      <button class="btn-di" onclick="deleteCustomFieldDef('${module}','${d.id}')" title="মুছুন">🗑️</button>
    </div>`).join('');
}

function addCustomFieldDef(){
  const module = document.getElementById('cfModule').value;
  const label  = document.getElementById('cfLabel').value.trim();
  if(!label){ toast('⚠️ ফিল্ডের নাম দিন'); return; }
  const type = document.getElementById('cfType').value;
  const def = {id:crypto.randomUUID(), label, type};
  if(type==='dropdown'){
    const opts = document.getElementById('cfOptions').value.split(',').map(s=>s.trim()).filter(Boolean);
    if(!opts.length){ toast('⚠️ অপশনগুলো কমা দিয়ে আলাদা করে লিখুন'); return; }
    def.options = opts;
  }
  const defs = getCustomDefs();
  defs[module] = defs[module] || [];
  defs[module].push(def);
  saveCustomDefs(defs);
  document.getElementById('cfLabel').value='';
  document.getElementById('cfOptions').value='';
  renderCfDefList();
  refreshOpenFormCustomFields();
  renderCurrentTab(); // নতুন ফিল্ড টেবিলের কলামেও যোগ হোক
  toast('✅ কাস্টম ফিল্ড যোগ হয়েছে');
}

function deleteCustomFieldDef(module, id){
  if(!confirm('এই কাস্টম ফিল্ডটি ফর্ম থেকে সরিয়ে দেবেন? (আগের এন্ট্রিতে থাকা ডেটা মুছে যাবে না, শুধু আর দেখানো হবে না)')) return;
  const defs = getCustomDefs();
  defs[module] = (defs[module]||[]).filter(d=>d.id!==id);
  saveCustomDefs(defs);
  renderCfDefList();
  refreshOpenFormCustomFields();
  renderCurrentTab();
  toast('🗑️ মুছে গেছে');
}

function refreshOpenFormCustomFields(){
  const module = document.getElementById('cfModule').value;
  const target = document.getElementById('cfRefreshTarget').value;
  if(!target) return;
  renderCustomFieldInputs(module, target, _cfValueCache[module]||{});
}

function renderCustomFieldInputs(module, containerId, values={}){
  const defs = getCustomDefs()[module] || [];
  const box = document.getElementById(containerId);
  if(!box) return;
  if(!defs.length){ box.innerHTML=''; return; }
  box.innerHTML = defs.map(d=>{
    const val = values[d.id];
    if(d.type==='dropdown'){
      const opts = (d.options||[]).map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
      return `<div class="fg"><label>${d.label}</label><select data-cf-id="${d.id}"><option value="">-- নির্বাচন করুন --</option>${opts}</select></div>`;
    }
    if(d.type==='image'){
      const preview = val ? `<img src="${val}" class="cf-preview-img"/>` : '';
      return `<div class="fg"><label>${d.label}</label>
        <div style="display:flex;align-items:center;gap:8px;">
          ${preview}
          <input type="file" accept="image/*" data-cf-id="${d.id}" data-cf-type="image" style="flex:1;"/>
        </div>
        <input type="hidden" data-cf-id="${d.id}-current" value="${val||''}"/>
      </div>`;
    }
    return `<div class="fg"><label>${d.label}</label><input type="text" data-cf-id="${d.id}" value="${val||''}"/></div>`;
  }).join('');
}

async function collectCustomFieldValues(containerId, existingValues={}){
  const box = document.getElementById(containerId);
  const result = {...existingValues};
  if(!box) return result;
  const inputs = box.querySelectorAll('[data-cf-id]:not([data-cf-id$="-current"])');
  for(const el of inputs){
    const id = el.dataset.cfId;
    if(el.dataset.cfType==='image'){
      if(el.files && el.files[0]){
        try{ result[id] = await readFileAsDataURL(el.files[0]); }catch(e){ /* keep old value */ }
      }
      // ফাইল না বদলালে existingValues এর মানই থেকে যাবে (উপরের spread থেকে)
    } else {
      result[id] = el.value;
    }
  }
  return result;
}
if(!localStorage.getItem('bgfcl_txns')) saveTxns(SAMPLE_TXNS);

