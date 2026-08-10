// ═══════════════════════════════════════════════════════
//  জনবল CRUD (MANPOWER)
// ═══════════════════════════════════════════════════════
// জনবলের ধরন (অফিসার/স্টাফ/দৈনিক শ্রমিক) অনুযায়ী কাস্টম ফিল্ডের আলাদা মডিউল-কী।
// এভাবে প্রতিটি ক্যাটাগরির কাস্টম ফিল্ড একে অন্যের থেকে সম্পূর্ণ স্বাধীন থাকে।
function mpModule(){ return 'manpower_' + (document.getElementById('mpType').value || 'daily'); }
let _mpFormCFValues = {}; // বর্তমানে খোলা জনবল ফর্মের কাস্টম ফিল্ড মান (ধরন পরিবর্তন করলেও বজায় থাকে)

function toggleManpowerFields(){
  const type=document.getElementById('mpType').value;
  document.getElementById('mpStaffFields').style.display = (type==='staff'||type==='officer') ? '' : 'none';
  document.getElementById('mpStaffFieldsTitle').textContent = type==='officer' ? '🗂️ অফিসার সংক্রান্ত অতিরিক্ত তথ্য' : '🗂️ স্টাফ সংক্রান্ত অতিরিক্ত তথ্য';
  // ধরন বদলালে সেই ক্যাটাগরির নিজস্ব কাস্টম ফিল্ডগুলো দেখানো হয় (আগে থেকে ফর্মে থাকা মান বজায় রেখে)
  const module = mpModule();
  _cfValueCache[module] = _mpFormCFValues || {};
  renderCustomFieldInputs(module, 'mpCustomFields', _cfValueCache[module]);
}

function toggleAlDateField(){
  const taken = document.getElementById('mpAlTaken').value;
  document.getElementById('mpAlDateWrap').style.display = taken==='yes' ? '' : 'none';
}

function resetManpowerForm(){
  document.getElementById('mpId').value='';
  document.getElementById('mpType').value='daily';
  ['mpName','mpDesig','mpPhone','mpAddress','mpClDate','mpOtherDate','mpAlDate'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('mpClRemain').value='';
  document.getElementById('mpOtherRemain').value='';
  document.getElementById('mpAlTaken').value='no';
  toggleManpowerFields();
  toggleAlDateField();
}

function openAddManpower(){
  resetManpowerForm();
  document.getElementById('mpDept').value = currentUser?.reqDept||'field';
  document.getElementById('modalManpowerTitle').textContent='👷 নতুন জনবল যোগ';
  _mpFormCFValues = {};
  _cfValueCache[mpModule()] = {};
  renderCustomFieldInputs(mpModule(),'mpCustomFields',{});
  openModal('modalManpower');
}

function openEditManpower(id){
  const m=getManpower().find(x=>x.id===id); if(!m) return;
  if(!canEdit(m.dept)){ toast('⚠️ এই শাখা সম্পাদনার অনুমতি নেই'); return; }
  document.getElementById('mpId').value=m.id;
  document.getElementById('mpDept').value=m.dept;
  document.getElementById('mpType').value=m.type;
  document.getElementById('mpName').value=m.name;
  document.getElementById('mpDesig').value=m.designation||'';
  document.getElementById('mpPhone').value=m.phone||'';
  document.getElementById('mpAddress').value=m.address||'';
  document.getElementById('mpClDate').value=m.cl_last_date||'';
  document.getElementById('mpClRemain').value=m.cl_remaining ?? '';
  document.getElementById('mpOtherDate').value=m.other_leave_last_date||'';
  document.getElementById('mpOtherRemain').value=m.other_leave_remaining ?? '';
  document.getElementById('mpAlTaken').value=m.al_taken||'no';
  document.getElementById('mpAlDate').value=m.al_date||'';
  document.getElementById('modalManpowerTitle').textContent='✏️ জনবল সম্পাদনা';
  toggleAlDateField();
  _mpFormCFValues = m.customFields||{};
  _cfValueCache[mpModule()] = _mpFormCFValues;
  toggleManpowerFields(); // এটি mpModule() অনুযায়ী সঠিক কাস্টম ফিল্ডসেট রেন্ডার করবে
  openModal('modalManpower');
}

async function saveManpowerForm(){
  const id=document.getElementById('mpId').value;
  const dept=document.getElementById('mpDept').value;
  if(!canEdit(dept)){ toast('⚠️ এই শাখা সম্পাদনার অনুমতি নেই'); return; }
  const name=document.getElementById('mpName').value.trim();
  if(!name){ toast('⚠️ নাম দিন'); return; }
  const type=document.getElementById('mpType').value;
  const list=getManpower();
  const idx=list.findIndex(m=>m.id===id);
  const existingCF = idx>=0 ? (list[idx].customFields||{}) : {};
  const customFields = await collectCustomFieldValues('mpCustomFields', existingCF);
  const rec={
    id: id || crypto.randomUUID(),
    dept, type, name,
    designation: document.getElementById('mpDesig').value.trim(),
    phone: document.getElementById('mpPhone').value.trim(),
    address: document.getElementById('mpAddress').value.trim(),
    cl_last_date:null, cl_remaining:0, other_leave_last_date:null, other_leave_remaining:0, al_taken:'no', al_date:null,
    customFields,
  };
  if(type==='staff'||type==='officer'){
    rec.cl_last_date = document.getElementById('mpClDate').value || null;
    rec.cl_remaining = +document.getElementById('mpClRemain').value || 0;
    rec.other_leave_last_date = document.getElementById('mpOtherDate').value || null;
    rec.other_leave_remaining = +document.getElementById('mpOtherRemain').value || 0;
    rec.al_taken = document.getElementById('mpAlTaken').value;
    rec.al_date = rec.al_taken==='yes' ? (document.getElementById('mpAlDate').value || null) : null;
  }
  const wasEdit = idx>=0;
  if(idx>=0){
    if(!canEdit(list[idx].dept)){ toast('⚠️ অনুমতি নেই'); return; }
    list[idx]=rec;
  } else {
    list.push(rec);
  }
  saveManpower(list);
  const typeLabel = type==='officer'?'অফিসার':type==='staff'?'স্টাফ':'দৈনিক শ্রমিক';
  logAudit('manpower', wasEdit?'update':'create', name, typeLabel);
  closeModal('modalManpower');
  resetManpowerForm();
  renderManpower();
  toast(idx>=0 ? '✅ আপডেট হয়েছে (লোকালি)' : '✅ জনবল যোগ হয়েছে (লোকালি)');
  if(supaOk){
    try{
      if(idx>=0) await supa(CFG.TABLE_MANPOWER+'?id=eq.'+rec.id,'PATCH',rec);
      else        await supa(CFG.TABLE_MANPOWER,'POST',rec);
      toast('☁️ ক্লাউডে সিঙ্ক সম্পন্ন');
    }catch(e){ notifyCloudSyncFail(e); }
  } else {
    toast('⚠️ ক্লাউড সংযোগ নেই — শুধু এই ডিভাইসেই সংরক্ষিত আছে');
  }
}

function deleteManpower(id){
  const m=getManpower().find(x=>x.id===id); if(!m) return;
  if(!canEdit(m.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  if(!confirm('এই জনবলের তথ্য মুছে দেবেন?')) return;
  saveManpower(getManpower().filter(x=>x.id!==id));
  logAudit('manpower', 'delete', m.name, m.type==='officer'?'অফিসার':m.type==='staff'?'স্টাফ':'দৈনিক শ্রমিক');
  renderManpower(); toast('🗑️ মুছে গেছে');
  if(supaOk) supa(CFG.TABLE_MANPOWER+'?id=eq.'+id,'DELETE').catch(notifyCloudSyncFail);
}

// ═══════════════════════════════════════════════════════
//  দৈনিক শ্রমিক উপস্থিতি (ATTENDANCE) মার্কিং
// ═══════════════════════════════════════════════════════
function openAttendanceModal(workerId){
  const m=getManpower().find(x=>x.id===workerId); if(!m) return;
  if(!canEdit(m.dept)){ toast('⚠️ এই শাখা সম্পাদনার অনুমতি নেই'); return; }
  document.getElementById('attWorkerId').value = workerId;
  document.getElementById('attWorkerName').textContent = m.name;
  document.getElementById('attDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('attPresent').value = 'yes';
  renderAttendanceRecent(workerId);
  openModal('modalAttendance');
}

function saveAttendanceEntry(){
  const workerId = document.getElementById('attWorkerId').value;
  const date = document.getElementById('attDate').value;
  if(!date){ toast('⚠️ তারিখ দিন'); return; }
  const status = document.getElementById('attPresent').value==='yes' ? 'P' : 'A';
  setAttendance(workerId, date, status);
  renderAttendanceRecent(workerId);
  toast('✅ উপস্থিতি সংরক্ষিত হয়েছে');
}

function renderAttendanceRecent(workerId){
  const att = getAttendance()[workerId] || {};
  const dates = Object.keys(att).sort().reverse().slice(0,15);
  const box = document.getElementById('attRecentList');
  if(!dates.length){
    box.innerHTML = `<p style="font-size:12px;color:#94A3B8;text-align:center;padding:8px;">কোনো এন্ট্রি নেই</p>`;
    return;
  }
  box.innerHTML = dates.map(d=>`
    <div class="cf-row">
      <div style="font-size:13px;">${d} — <strong style="color:${att[d]==='P'?'#10B981':'#EF4444'};">${att[d]}</strong></div>
      <button class="btn-di" onclick="deleteAttendanceEntry('${workerId}','${d}')" title="মুছুন">🗑️</button>
    </div>`).join('');
}

function deleteAttendanceEntry(workerId, date){
  removeAttendance(workerId, date);
  renderAttendanceRecent(workerId);
  toast('🗑️ মুছে গেছে');
}

// ═══════════════════════════════════════════════════════
//  উপস্থিতি রিপোর্ট বিল্ডার (১৫-দিনের কর্মদিবস + প্রিন্ট)
// ═══════════════════════════════════════════════════════
function currentRangeKey(){
  const s=document.getElementById('repStart').value;
  const e=document.getElementById('repEnd').value;
  return `${s}_${e}`;
}

function openAttendanceReport(){
  const hdr = getReportHeader();
  document.getElementById('repMainCompany').value = hdr.mainCompany;
  document.getElementById('repSubCompany').value  = hdr.subCompany;
  document.getElementById('repSubAddress').value   = hdr.subAddress;
  document.getElementById('repTitle').value        = hdr.title;
  document.getElementById('repDept').value = (currentUser?.role==='super') ? 'all' : (currentUser?.reqDept||'all');

  const today = new Date();
  const y=today.getFullYear(), mo=today.getMonth();
  const dim = new Date(y, mo+1, 0).getDate(); // মাসের শেষ তারিখ
  const startDefault = `${y}-${String(mo+1).padStart(2,'0')}-01`;
  const endDefault    = `${y}-${String(mo+1).padStart(2,'0')}-${String(Math.min(15,dim)).padStart(2,'0')}`;
  document.getElementById('repStart').value = startDefault;
  document.getElementById('repEnd').value   = endDefault;

  document.getElementById('repDesc').value = getReportDesc(document.getElementById('repDept').value, `${startDefault}_${endDefault}`);
  renderReportColChips();
  renderReportTable();
  openModal('modalAttendanceReport');
}

function onReportContextChange(){
  const dept = document.getElementById('repDept').value;
  document.getElementById('repDesc').value = getReportDesc(dept, currentRangeKey());
  renderReportTable();
}

function saveReportHeaderFromForm(){
  saveReportHeader({
    mainCompany: document.getElementById('repMainCompany').value,
    subCompany:  document.getElementById('repSubCompany').value,
    subAddress:  document.getElementById('repSubAddress').value,
    title:       document.getElementById('repTitle').value,
  });
}

function renderReportColChips(){
  const cols = getReportExtraCols();
  const box = document.getElementById('repColChips');
  box.innerHTML = cols.length ? cols.map(c=>`
    <span style="background:#F1F5F9;border-radius:20px;padding:5px 10px;font-size:12px;display:inline-flex;align-items:center;gap:6px;">
      ${escHtml(c.label)} <span style="cursor:pointer;color:#EF4444;font-weight:700;" onclick="removeReportColumn('${c.id}')">✕</span>
    </span>`).join('') : `<span style="font-size:12px;color:#94A3B8;">কোনো অতিরিক্ত কলাম নেই</span>`;
}

function addReportColumn(){
  const label = document.getElementById('repNewColLabel').value.trim();
  if(!label){ toast('⚠️ কলামের নাম দিন'); return; }
  const cols = getReportExtraCols();
  cols.push({id:crypto.randomUUID(), label});
  saveReportExtraCols(cols);
  document.getElementById('repNewColLabel').value='';
  renderReportColChips();
  renderReportTable();
  toast('✅ কলাম যোগ হয়েছে');
}

function removeReportColumn(id){
  if(!confirm('এই কলামটি সরিয়ে দেবেন?')) return;
  saveReportExtraCols(getReportExtraCols().filter(c=>c.id!==id));
  renderReportColChips();
  renderReportTable();
}

function renderReportTable(){
  const dept  = document.getElementById('repDept').value;
  const start = document.getElementById('repStart').value;
  const end   = document.getElementById('repEnd').value;
  if(!start || !end) return;
  const rangeKey = `${start}_${end}`;
  const extraCols = getReportExtraCols();
  const workers = getManpower().filter(w=>w.type==='daily' && (dept==='all'||w.dept===dept));

  document.getElementById('repTheadRow').innerHTML =
    `<th>দৈনিক শ্রমিকের নাম</th><th>সাধারণ কর্মদিবস</th><th>অতিরিক্ত কর্মদিবস</th>${extraCols.map(c=>`<th>${c.label}</th>`).join('')}<th>মোট কর্মদিবস</th>`;

  const tbody = document.getElementById('repTbody');
  if(!workers.length){
    tbody.innerHTML = `<tr><td colspan="${4+extraCols.length}" style="text-align:center;padding:20px;color:#94A3B8;">এই শাখায় কোনো দৈনিক শ্রমিক নেই</td></tr>`;
    return;
  }
  tbody.innerHTML = workers.map(w=>{
    const regular = countPresentDays(w.id, start, end);
    const extra = getExtraDays(w.id, rangeKey);
    const total = regular + (+extra||0);
    const extraTds = extraCols.map(c=>{
      const v = getReportExtraColVal(w.id, rangeKey, c.id);
      return `<td><input type="text" data-worker="${w.id}" data-col="${c.id}" value="${v}" onchange="onReportColInput(this)" style="width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:4px 6px;font-family:var(--f);font-size:12px;"/></td>`;
    }).join('');
    return `<tr>
      <td><strong>${escHtml(w.name)}</strong></td>
      <td style="text-align:center;">${regular}</td>
      <td><input type="number" min="0" data-worker="${w.id}" value="${extra}" onchange="onExtraDaysInput(this)" style="width:64px;border:1px solid #E2E8F0;border-radius:6px;padding:4px 6px;font-family:var(--f);font-size:12px;"/></td>
      ${extraTds}
      <td style="text-align:center;font-weight:700;" id="repTotal_${w.id}">${total}</td>
    </tr>`;
  }).join('');
}

function onExtraDaysInput(el){
  const workerId = el.dataset.worker;
  const rangeKey = currentRangeKey();
  const val = +el.value || 0;
  setExtraDays(workerId, rangeKey, val);
  const start=document.getElementById('repStart').value, end=document.getElementById('repEnd').value;
  const regular = countPresentDays(workerId, start, end);
  const totalEl = document.getElementById('repTotal_'+workerId);
  if(totalEl) totalEl.textContent = regular + val;
}

function onReportColInput(el){
  setReportExtraColVal(el.dataset.worker, currentRangeKey(), el.dataset.col, el.value);
}

function fmtDateDisplay(dateStr){
  if(!dateStr) return '';
  const [y,mo,d] = dateStr.split('-').map(Number);
  return `${d} ${MN[mo]} ${y}`;
}

function buildReportPrintHTML(){
  const hdr = getReportHeader();
  const dept = document.getElementById('repDept').value;
  const deptLabel = dept==='all' ? 'সকল শাখা' : (DEPT[dept]?.name || dept);
  const start = document.getElementById('repStart').value;
  const end   = document.getElementById('repEnd').value;
  const rangeKey = `${start}_${end}`;
  const desc = document.getElementById('repDesc').value;
  const extraCols = getReportExtraCols();
  const workers = getManpower().filter(w=>w.type==='daily' && (dept==='all'||w.dept===dept));

  const rowsHtml = workers.map(w=>{
    const regular = countPresentDays(w.id, start, end);
    const extra = getExtraDays(w.id, rangeKey);
    const total = regular + (+extra||0);
    const extraTds = extraCols.map(c=>`<td>${escHtml(getReportExtraColVal(w.id, rangeKey, c.id))||'—'}</td>`).join('');
    return `<tr><td>${escHtml(w.name)}</td><td style="text-align:center;">${regular}</td><td style="text-align:center;">${extra}</td>${extraTds}<td style="text-align:center;font-weight:700;">${total}</td></tr>`;
  }).join('') || `<tr><td colspan="${4+extraCols.length}" style="text-align:center;padding:16px;">কোনো তথ্য নেই</td></tr>`;

  document.getElementById('reportPrintArea').innerHTML = `
    <div class="rp-header">
      <h1>${escHtml(hdr.mainCompany)}</h1>
      ${hdr.subCompany?`<h2>${escHtml(hdr.subCompany)}</h2>`:''}
      ${hdr.subAddress?`<p class="rp-address">${escHtml(hdr.subAddress)}</p>`:''}
      <div class="rp-title">${escHtml(hdr.title)}</div>
    </div>
    <div class="rp-meta">
      <div>সময়কাল: ${fmtDateDisplay(start)} — ${fmtDateDisplay(end)}</div>
      <div>শাখা: ${deptLabel}</div>
    </div>
    <table class="rp-table">
      <thead><tr>
        <th>দৈনিক শ্রমিকের নাম</th><th>সাধারণ কর্মদিবস</th><th>অতিরিক্ত কর্মদিবস</th>
        ${extraCols.map(c=>`<th>${escHtml(c.label)}</th>`).join('')}
        <th>মোট কর্মদিবস</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    ${desc ? `<div class="rp-desc"><strong>কাজের বিবরণ:</strong><p>${escHtml(desc).replace(/\n/g,'<br>')}</p></div>` : ''}
    <div class="rp-sign">
      <div><span>কাজ তদারককারীর স্বাক্ষর</span><span class="rp-dots">..........................</span></div>
      <div><span>কাজ সুপারিশকারীর স্বাক্ষর</span><span class="rp-dots">..........................</span></div>
      <div><span>কাজ অনুমোদনকারীর স্বাক্ষর</span><span class="rp-dots">..........................</span></div>
    </div>
  `;
}

function printAttendanceReport(){
  buildReportPrintHTML();
  document.body.classList.add('report-print-mode');
  window.print();
}
window.addEventListener('afterprint', ()=>{ document.body.classList.remove('report-print-mode'); });

