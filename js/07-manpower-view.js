// ═══════════════════════════════════════════════════════
//  জনবল (MANPOWER)
// ═══════════════════════════════════════════════════════
function getFM(){ return getManpower().filter(m=>filterDept==='all'||m.dept===filterDept); }

function renderManpower(){
  const all = getFM();
  const officer = all.filter(m=>m.type==='officer');
  const daily = all.filter(m=>m.type==='daily');
  const staff = all.filter(m=>m.type==='staff');
  document.getElementById('sumOfficer').textContent  = officer.length;
  document.getElementById('sumDaily').textContent    = daily.length;
  document.getElementById('sumStaff').textContent    = staff.length;
  document.getElementById('sumManTotal').textContent = all.length;
  renderNameChips('namesOfficer', officer);
  renderNameChips('namesDaily', daily);
  renderNameChips('namesStaff', staff);
  renderOfficerTable(officer);
  renderStaffTable(staff);
  renderDailyTable(daily);
  renderManpowerProfileOverview();
}

// সারাংশ কার্ডের নিচে কোন শাখায় কতজন আছেন তার হিসাব (নামের বদলে)
function renderNameChips(elId, list){
  const box=document.getElementById(elId);
  if(!list.length){ box.innerHTML='<span class="snm-empty">কেউ নেই</span>'; return; }
  const counts = {};
  list.forEach(m=>{ const k=m.dept||'—'; counts[k]=(counts[k]||0)+1; });
  const deptNames = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  box.innerHTML = deptNames.map(k=>{
    const label = DEPT[k]?.name || k;
    return `<span class="snm">${escHtml(label)} - ${counts[k]} জন</span>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  ওভারভিউ প্রোফাইল কার্ড (অফিসার/স্টাফ/দৈনিক শ্রমিক কার্ডে ক্লিক করলে)
// ═══════════════════════════════════════════════════════
let _mpOverviewType = null; // null মানে বন্ধ; নাহলে 'officer' | 'staff' | 'daily'

const MP_OVERVIEW_META = {
  officer: {title:'🎖️ অফিসারদের প্রোফাইল ওভারভিউ', emptyMsg:'কোনো অফিসারের তথ্য নেই', module:'manpower_officer'},
  staff:   {title:'🧑‍💼 স্টাফদের প্রোফাইল ওভারভিউ', emptyMsg:'কোনো স্টাফের তথ্য নেই', module:'manpower_staff'},
  daily:   {title:'👷 দৈনিক শ্রমিকদের প্রোফাইল ওভারভিউ', emptyMsg:'কোনো দৈনিক শ্রমিকের তথ্য নেই', module:'manpower_daily'},
};

function toggleManpowerOverview(type){
  _mpOverviewType = (_mpOverviewType===type) ? null : type;
  renderManpowerProfileOverview();
}

function closeManpowerOverview(){
  _mpOverviewType = null;
  renderManpowerProfileOverview();
}

// কাস্টম ফিল্ডগুলোর মধ্যে "পিএফ" / "জেএস" লেবেলযুক্ত ফিল্ড খুঁজে তার মান বের করা হয়।
// নিয়ম: অফিসারের ক্ষেত্রে শুধু "পিএফ" (PF) লেবেলযুক্ত ফিল্ড দেখানো হবে, স্টাফের ক্ষেত্রে শুধু
// "জেএস" (JS) লেবেলযুক্ত ফিল্ড দেখানো হবে, দৈনিক শ্রমিকের ক্ষেত্রে এই ফিল্ড একেবারেই দরকার নেই।
function findPfJsValue(m){
  if(m.type!=='officer' && m.type!=='staff') return null;
  const defs = (getCustomDefs()[MP_OVERVIEW_META[m.type]?.module] || []);
  const match = defs.find(d=>{
    const l = (d.label||'').toLowerCase();
    if(m.type==='officer') return l.includes('পিএফ') || l.includes('pf');
    return l.includes('জেএস') || l.includes('js');
  });
  if(!match) return null;
  return (m.customFields && m.customFields[match.id]) || null;
}

function renderManpowerProfileOverview(){
  const overviewBox   = document.getElementById('manpowerProfileOverview');
  const officerTitle  = document.getElementById('officerTableTitle');
  const officerSec    = document.getElementById('officerTableSec');
  const staffTitle    = document.getElementById('staffTableTitle');
  const staffSec      = document.getElementById('staffTableSec');
  const dailyTitle    = document.getElementById('dailyTableTitle');
  const dailySec      = document.getElementById('dailyTableSec');

  if(!_mpOverviewType){
    overviewBox.style.display='none';
    [officerTitle,officerSec,staffTitle,staffSec,dailyTitle,dailySec].forEach(el=>{ if(el) el.style.display=''; });
    return;
  }

  // যে ক্যাটাগরির প্রোফাইল ওভারভিউ দেখানো হচ্ছে, শুধু সেই ক্যাটাগরির তালিকা লুকানো হয়
  const hideMap = {
    officer:[officerTitle,officerSec],
    staff:[staffTitle,staffSec],
    daily:[dailyTitle,dailySec],
  };
  [officerTitle,officerSec,staffTitle,staffSec,dailyTitle,dailySec].forEach(el=>{ if(el) el.style.display=''; });
  (hideMap[_mpOverviewType]||[]).forEach(el=>{ if(el) el.style.display='none'; });

  overviewBox.style.display='';
  document.querySelector('#manpowerProfileOverviewTitle span').textContent = MP_OVERVIEW_META[_mpOverviewType].title;

  const list = getFM().filter(m=>m.type===_mpOverviewType);
  const grid = document.getElementById('manpowerProfileGrid');
  if(!list.length){
    grid.innerHTML = `<div class="pc-empty-msg">${MP_OVERVIEW_META[_mpOverviewType].emptyMsg}</div>`;
    return;
  }
  grid.innerHTML = list.map(m=>{
    const cfg = DEPT[m.dept]||{color:'#64748B',name:m.dept};
    const pfJs = findPfJsValue(m);
    const pfJsLabel = m.type==='officer' ? 'পিএফ নং' : (m.type==='staff' ? 'জেএস নং' : null);
    const photoHtml = m.photo
      ? `<img class="pc-photo" src="${escHtml(m.photo)}"/>`
      : `<div class="pc-photo-ph">👤</div>`;
    return `
      <div class="profile-card">
        ${photoHtml}
        <div class="pc-name">${escHtml(m.name)}</div>
        <div class="pc-desig">${escHtml(m.designation)||'—'}</div>
        <div class="pc-dept" style="background:${cfg.color}22;color:${cfg.color};">${escHtml(cfg.name)}</div>
        ${pfJsLabel ? `<div class="pc-row">${pfJsLabel}: ${pfJs ? escHtml(pfJs) : '—'}</div>` : ''}
        <div class="pc-row">📞 ${escHtml(m.phone)||'—'}</div>
      </div>`;
  }).join('');
}

function cfThHtml(defs){ return defs.map(d=>`<th>${escHtml(d.label)}</th>`).join(''); }
function cfTdHtml(defs, values={}){
  return defs.map(d=>{
    const v = values && values[d.id];
    if(!v) return '<td>—</td>';
    if(d.type==='image') return `<td><img src="${escHtml(v)}" class="cf-preview-img"/></td>`;
    return `<td>${escHtml(v)}</td>`;
  }).join('');
}

function renderDailyTable(list){
  const tb=document.getElementById('dailyBody');
  const defs = getCustomDefs().manpower_daily || [];
  document.getElementById('dailyTheadRow').innerHTML =
    `<th>নাম</th><th>পদবী</th><th>ফোন</th><th>ঠিকানা</th><th>শাখা</th>${cfThHtml(defs)}<th id="dailyActCol"></th>`;
  updateActionBar();
  tb.innerHTML='';
  if(!list.length){
    tb.innerHTML=`<tr><td colspan="${6+defs.length}" style="text-align:center;padding:28px;color:#94A3B8;">কোনো দৈনিক শ্রমিকের তথ্য নেই</td></tr>`;
    return;
  }
  list.forEach(m=>{
    const cfg=DEPT[m.dept]||{color:'#64748B',name:m.dept};
    const canE=canEdit(m.dept);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><strong>${escHtml(m.name)}</strong></td>
      <td>${escHtml(m.designation)||'—'}</td>
      <td>${escHtml(m.phone)||'—'}</td>
      <td>${escHtml(m.address)||'—'}</td>
      <td><span class="tag-dept" style="background:${cfg.color}22;color:${cfg.color};">${cfg.name}</span></td>
      ${cfTdHtml(defs, m.customFields)}
      <td>${canE?`<button class="btn-ei" onclick="openAttendanceModal('${m.id}')" title="উপস্থিতি">📅</button><button class="btn-ei" onclick="openEditManpower('${m.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteManpower('${m.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
    tb.appendChild(tr);
  });
}

function renderOfficerTable(list){
  const tb=document.getElementById('officerBody');
  const defs = getCustomDefs().manpower_officer || [];
  document.getElementById('officerTheadRow').innerHTML =
    `<th>নাম</th><th>পদবী</th><th>ফোন</th><th>ঠিকানা</th><th>শাখা</th>
     <th>শেষ CL</th><th>CL বাকি</th><th>অন্য ছুটি (তারিখ)</th><th>অন্য ছুটি বাকি</th><th>AL নেয়া হয়েছে</th><th>AL নেয়ার তারিখ</th>
     ${cfThHtml(defs)}<th id="officerActCol"></th>`;
  updateActionBar();
  tb.innerHTML='';
  if(!list.length){
    tb.innerHTML=`<tr><td colspan="${11+defs.length}" style="text-align:center;padding:28px;color:#94A3B8;">কোনো অফিসারের তথ্য নেই</td></tr>`;
    return;
  }
  list.forEach(m=>{
    const cfg=DEPT[m.dept]||{color:'#64748B',name:m.dept};
    const canE=canEdit(m.dept);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><strong>${escHtml(m.name)}</strong></td>
      <td>${escHtml(m.designation)||'—'}</td>
      <td>${escHtml(m.phone)||'—'}</td>
      <td>${escHtml(m.address)||'—'}</td>
      <td><span class="tag-dept" style="background:${cfg.color}22;color:${cfg.color};">${cfg.name}</span></td>
      <td>${m.cl_last_date||'—'}</td>
      <td>${m.cl_remaining ?? '—'}</td>
      <td>${m.other_leave_last_date||'—'}</td>
      <td>${m.other_leave_remaining ?? '—'}</td>
      <td>${m.al_taken==='yes'?'✅ হ্যাঁ':'❌ না'}</td>
      <td>${m.al_taken==='yes' ? (m.al_date||'—') : '—'}</td>
      ${cfTdHtml(defs, m.customFields)}
      <td>${canE?`<button class="btn-ei" onclick="openEditManpower('${m.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteManpower('${m.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
    tb.appendChild(tr);
  });
}

function renderStaffTable(list){
  const tb=document.getElementById('staffBody');
  const defs = getCustomDefs().manpower_staff || [];
  document.getElementById('staffTheadRow').innerHTML =
    `<th>নাম</th><th>পদবী</th><th>ফোন</th><th>ঠিকানা</th><th>শাখা</th>
     <th>শেষ CL</th><th>CL বাকি</th><th>অন্য ছুটি (তারিখ)</th><th>অন্য ছুটি বাকি</th><th>AL নেয়া হয়েছে</th><th>AL নেয়ার তারিখ</th>
     ${cfThHtml(defs)}<th id="staffActCol"></th>`;
  updateActionBar();
  tb.innerHTML='';
  if(!list.length){
    tb.innerHTML=`<tr><td colspan="${11+defs.length}" style="text-align:center;padding:28px;color:#94A3B8;">কোনো স্টাফের তথ্য নেই</td></tr>`;
    return;
  }
  list.forEach(m=>{
    const cfg=DEPT[m.dept]||{color:'#64748B',name:m.dept};
    const canE=canEdit(m.dept);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><strong>${escHtml(m.name)}</strong></td>
      <td>${escHtml(m.designation)||'—'}</td>
      <td>${escHtml(m.phone)||'—'}</td>
      <td>${escHtml(m.address)||'—'}</td>
      <td><span class="tag-dept" style="background:${cfg.color}22;color:${cfg.color};">${cfg.name}</span></td>
      <td>${m.cl_last_date||'—'}</td>
      <td>${m.cl_remaining ?? '—'}</td>
      <td>${m.other_leave_last_date||'—'}</td>
      <td>${m.other_leave_remaining ?? '—'}</td>
      <td>${m.al_taken==='yes'?'✅ হ্যাঁ':'❌ না'}</td>
      <td>${m.al_taken==='yes' ? (m.al_date||'—') : '—'}</td>
      ${cfTdHtml(defs, m.customFields)}
      <td>${canE?`<button class="btn-ei" onclick="openEditManpower('${m.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteManpower('${m.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
    tb.appendChild(tr);
  });
}

// ═══════════════════════════════════════════════════════
//  কার্যক্রম (ACTIVITIES)
// ═══════════════════════════════════════════════════════
function getFA(){
  return getActivities().filter(a=>{
    const d=new Date(a.date);
    return (d.getMonth()+1)===M && d.getFullYear()===Y && (filterDept==='all'||a.dept===filterDept);
  }).sort((a,b)=> b.date.localeCompare(a.date));
}

function renderActivities(){
  const list=getFA();
  const defs = getCustomDefs().activities || [];
  document.getElementById('actLabel').textContent = `${MN[M]} ${Y}`;
  document.getElementById('activityTheadRow').innerHTML =
    `<th>তারিখ</th><th>শাখা</th><th>বিবরণ</th>${cfThHtml(defs)}<th id="activityActCol"></th>`;
  updateActionBar();
  const tb=document.getElementById('activityBody');
  tb.innerHTML='';
  if(!list.length){
    tb.innerHTML=`<tr><td colspan="${4+defs.length}" style="text-align:center;padding:28px;color:#94A3B8;">এই মাসে কোনো কার্যক্রম যোগ করা হয়নি</td></tr>`;
    return;
  }
  list.forEach(a=>{
    const cfg=DEPT[a.dept]||{color:'#64748B',name:a.dept};
    const canE=canEdit(a.dept);
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${a.date}</td>
      <td><span class="tag-dept" style="background:${cfg.color}22;color:${cfg.color};">${cfg.name}</span></td>
      <td style="white-space:pre-wrap;">${escHtml(a.description)}</td>
      ${cfTdHtml(defs, a.customFields)}
      <td>${canE?`<button class="btn-ei" onclick="openEditActivity('${a.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteActivity('${a.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
    tb.appendChild(tr);
  });
}

