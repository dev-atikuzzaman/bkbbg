// ═══════════════════════════════════════════════════════
//  🧾 হিসাব ট্যাব — ধাপ ২: গ্যাস আয়
//  (ধাপ ৩ কনডেনসেট, ধাপ ৪ ব্যয় — পরের ধাপে এই একই ফাইলে যোগ হবে)
// ═══════════════════════════════════════════════════════

// 1 MMSCFD -> SCM/day: MMSCFD মানে ১০ লক্ষ ঘনফুট/দিন; ঘনফুট->ঘনমিটার কনভার্সন CFG.FT3_TO_M3 (0.0283168)
function computeGasCalc(mmscfd, pricePerScm){
  const scmPerDay  = (+mmscfd||0) * 1000000 * CFG.FT3_TO_M3; // SCM/দিন (আসল একক)
  const mscmPerDay = scmPerDay / 1000;                        // হাজার SCM/দিন (রিপোর্টিং একক)
  const amountTaka = scmPerDay * (+pricePerScm||0);
  return { scmPerDay, mscmPerDay, amountTaka };
}
function fmtNum(n, decimals){
  if(n===null||n===undefined||isNaN(n)) return '—';
  return (+n).toLocaleString('en-US',{maximumFractionDigits: decimals??2, minimumFractionDigits:0});
}

function renderFinance(){
  const price = getGasPrice();
  document.getElementById('finGasPrice').textContent = price!=null ? `৳${fmtNum(price,4)}` : 'সেট করা হয়নি';
  document.getElementById('gasLogLabel').textContent = `${MN[M]} ${Y}`;
  document.getElementById('finTotalMonthLabel').textContent = `${MN[M]} ${Y}`;

  // ── গ্যাস: ক্রমপুঞ্জিত (cumulative) হিসাবের জন্য পুরনো->নতুন ক্রমে সাজিয়ে যোগ করা হচ্ছে ──
  const chronological = getGasEntries().slice().sort((a,b)=> a.entry_date.localeCompare(b.entry_date));
  let cumScm=0, cumTaka=0;
  const withCumulative = chronological.map(e=>{
    cumScm  += (+e.scm_per_day||0);
    cumTaka += (+e.amount_taka||0);
    return {...e, cum_scm:cumScm, cum_taka:cumTaka};
  });
  const monthGasEntries = chronological.filter(e=>{
    const d=new Date(e.entry_date);
    return (d.getMonth()+1)===M && d.getFullYear()===Y;
  });
  const monthGas  = monthGasEntries.reduce((s,e)=>s+(+e.scm_per_day||0),0);
  const monthGasTaka = monthGasEntries.reduce((s,e)=>s+(+e.amount_taka||0),0);
  document.getElementById('finMonthGas').textContent  = fmtNum(monthGas,0);
  document.getElementById('finMonthTaka').textContent = '৳'+fmtNum(monthGasTaka,0);
  document.getElementById('finTotalTaka').textContent = '৳'+fmtNum(cumTaka,0);

  const gasDisplayList = withCumulative.slice().reverse(); // নতুন এন্ট্রি ওপরে
  const gasTb=document.getElementById('gasEntryBody');
  const canW = currentUser?.role==='super';
  gasTb.innerHTML='';
  if(!gasDisplayList.length){
    gasTb.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:28px;color:#94A3B8;">এখনো কোনো গ্যাস উৎপাদন এন্ট্রি নেই</td></tr>`;
  }else{
    gasDisplayList.forEach(e=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${e.entry_date}</td>
        <td>${fmtNum(e.mmscfd,4)}</td>
        <td>${fmtNum(e.mscm_per_day,2)}</td>
        <td>${fmtNum(e.scm_per_day,0)}</td>
        <td>৳${fmtNum(e.price_per_scm,4)}</td>
        <td><strong>৳${fmtNum(e.amount_taka,0)}</strong></td>
        <td>${fmtNum(e.cum_scm,0)}</td>
        <td><strong>৳${fmtNum(e.cum_taka,0)}</strong></td>
        <td style="font-size:12px;">${escHtml(e.entered_by_name||'—')}</td>
        <td>${canW?`<button class="btn-ei" onclick="openEditGasEntry('${e.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteGasEntry('${e.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
      gasTb.appendChild(tr);
    });
  }

  // ── কনডেনসেট: মাসিক এন্ট্রি (একটা মাসে একটাই) ──
  const condAll = getCondensateEntries().slice().sort((a,b)=> (a.entry_year*12+a.entry_month) - (b.entry_year*12+b.entry_month));
  const condTotalTaka = condAll.reduce((s,c)=>s+(+c.income_taka||0),0);
  const condMonthEntry = condAll.find(c=>c.entry_year===Y && c.entry_month===M);
  const condMonthBbl  = condMonthEntry ? (+condMonthEntry.light_condensate_bbl||0)+(+condMonthEntry.heavy_condensate_bbl||0) : 0;
  const condMonthTaka = condMonthEntry ? (+condMonthEntry.income_taka||0) : 0;
  document.getElementById('condMonthBbl').textContent  = fmtNum(condMonthBbl,2);
  document.getElementById('condMonthTaka').textContent = '৳'+fmtNum(condMonthTaka,0);
  document.getElementById('condTotalTaka').textContent = '৳'+fmtNum(condTotalTaka,0);

  // ── মোট আয় (নির্বাচিত মাস) = গ্যাস + কনডেনসেট ──
  document.getElementById('finCombinedMonthIncome').textContent = '৳'+fmtNum(monthGasTaka+condMonthTaka,0);

  const condDefs = getCustomDefs().condensate || [];
  document.getElementById('condTheadRow').innerHTML =
    `<th>মাস</th><th>লাইট কনডেনসেট (bbl)</th><th>হেভি কনডেনসেট (bbl)</th><th>আয় (৳)</th>
     ${cfThHtml(condDefs)}<th>এন্ট্রিকারী</th><th id="condEntryActCol">${canW?'একশন':''}</th>`;
  const condTb=document.getElementById('condEntryBody');
  condTb.innerHTML='';
  if(!condAll.length){
    condTb.innerHTML=`<tr><td colspan="${6+condDefs.length}" style="text-align:center;padding:28px;color:#94A3B8;">এখনো কোনো কনডেনসেট এন্ট্রি নেই</td></tr>`;
  }else{
    condAll.slice().reverse().forEach(c=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${MN[c.entry_month]} ${c.entry_year}</td>
        <td>${fmtNum(c.light_condensate_bbl,2)}</td>
        <td>${fmtNum(c.heavy_condensate_bbl,2)}</td>
        <td><strong>৳${fmtNum(c.income_taka,0)}</strong></td>
        ${cfTdHtml(condDefs, c.custom_fields)}
        <td style="font-size:12px;">${escHtml(c.entered_by_name||'—')}</td>
        <td>${canW?`<button class="btn-ei" onclick="openEditCondensateEntry('${c.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteCondensateEntry('${c.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
      condTb.appendChild(tr);
    });
  }

  // ── ব্যয় (খরচ): বিভাগ-ফিল্টার (ওপরের গ্লোবাল filterDept) অনুযায়ী ──
  const allExpenses = getExpenseEntries().filter(e=> filterDept==='all' || e.dept===filterDept)
    .slice().sort((a,b)=> b.expense_date.localeCompare(a.expense_date));
  document.getElementById('expLogLabel').textContent = filterDept==='all' ? 'সকল শাখা' : (DEPT[filterDept]?.name||filterDept);
  const monthExpenses = allExpenses.filter(e=>{
    const d=new Date(e.expense_date);
    return (d.getMonth()+1)===M && d.getFullYear()===Y;
  });
  const monthExpTaka = monthExpenses.reduce((s,e)=>s+(+e.amount_taka||0),0);
  const totalExpTaka = allExpenses.reduce((s,e)=>s+(+e.amount_taka||0),0);
  document.getElementById('expMonthTaka').textContent = '৳'+fmtNum(monthExpTaka,0);
  document.getElementById('expTotalTaka').textContent = '৳'+fmtNum(totalExpTaka,0);

  const expTb=document.getElementById('expEntryBody');
  expTb.innerHTML='';
  if(!allExpenses.length){
    expTb.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:28px;color:#94A3B8;">এখনো কোনো খরচের এন্ট্রি নেই</td></tr>`;
  }else{
    allExpenses.forEach(e=>{
      const cfg=DEPT[e.dept]||{color:'#64748B',name:e.dept};
      const canEditThis = canEdit(e.dept);
      const bills = e.bill_paths||[];
      const billCell = bills.length
        ? bills.map(p=>`<img src="${supaStoragePublicUrl(p)}" style="width:32px;height:32px;object-fit:cover;border-radius:5px;cursor:pointer;margin-right:3px;" onclick="openBillPreview('${supaStoragePublicUrl(p)}')"/>`).join('')
        : '—';
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td>${e.expense_date}</td>
        <td><span class="tag-dept" style="background:${cfg.color}22;color:${cfg.color};">${cfg.name}</span></td>
        <td>${escHtml(e.description)}</td>
        <td><strong>৳${fmtNum(e.amount_taka,0)}</strong></td>
        <td>${billCell}</td>
        <td style="font-size:12px;">${escHtml(e.entered_by_name||'—')}</td>
        <td>${canEditThis?`<button class="btn-ei" onclick="openEditExpenseEntry('${e.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteExpenseEntry('${e.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
      expTb.appendChild(tr);
    });
  }
}

// ── গ্যাসের দাম সেট করা ──
function openSetGasPrice(){
  if(currentUser?.role!=='super'){ toast('⚠️ শুধু সুপার অ্যাডমিন দাম বদলাতে পারবেন'); return; }
  const price = getGasPrice();
  document.getElementById('gasPriceInput').value = price!=null ? price : '';
  openModal('modalGasPrice');
}
async function saveGasPrice(){
  const val = +document.getElementById('gasPriceInput').value;
  if(!val || val<=0){ toast('⚠️ সঠিক দাম দিন'); return; }
  const settings = getFinSettings();
  const idx = settings.findIndex(s=>s.key==='gas_price_per_scm');
  const row = {
    key:'gas_price_per_scm', value_numeric: val, value_text:null,
    updated_by_name: currentUser?.name||currentUser?.email||'অজানা',
    updated_by_email: currentUser?.email||null,
    updated_at: new Date().toISOString(),
  };
  if(idx>=0) settings[idx]=row; else settings.push(row);
  saveFinSettings(settings);
  logAudit('finance', 'update', 'গ্যাসের দাম', `৳${val}/SCM`);
  closeModal('modalGasPrice');
  renderFinance();
  toast('✅ গ্যাসের দাম সংরক্ষণ হয়েছে');
  if(supaOk){
    // finance_settings-এ key প্রাইমারি-কী, তাই upsert-স্টাইলে PATCH/POST — আগে থাকলে আপডেট, না থাকলে নতুন
    try{
      const exists = await supa(CFG.TABLE_FIN_SETTINGS+'?key=eq.gas_price_per_scm');
      if(exists && exists.length) await supa(CFG.TABLE_FIN_SETTINGS+'?key=eq.gas_price_per_scm','PATCH',row);
      else await supa(CFG.TABLE_FIN_SETTINGS,'POST',row);
    }catch(e){ notifyCloudSyncFail(e); }
  }
}

// ── দৈনিক এন্ট্রি ──
function previewGasCalc(){
  const mmscfd = +document.getElementById('gasEntryMmscfd').value||0;
  const price = getGasPrice();
  const box = document.getElementById('gasEntryPreview');
  if(!price){ box.textContent='⚠️ আগে গ্যাসের দাম সেট করুন'; return; }
  const { scmPerDay, mscmPerDay, amountTaka } = computeGasCalc(mmscfd, price);
  box.innerHTML = `📐 ${fmtNum(mscmPerDay,2)} MSCM/দিন = ${fmtNum(scmPerDay,0)} SCM/দিন × ৳${fmtNum(price,4)} = <strong>৳${fmtNum(amountTaka,0)}</strong>`;
}
function openAddGasEntry(){
  if(currentUser?.role!=='super'){ toast('⚠️ শুধু সুপার অ্যাডমিন এন্ট্রি যোগ করতে পারবেন'); return; }
  if(!getGasPrice()){ toast('⚠️ প্রথমে "⛽ গ্যাসের দাম সেট করুন" দিয়ে দাম বসান'); return; }
  document.getElementById('gasEntryModalTitle').textContent='➕ দৈনিক উৎপাদন এন্ট্রি';
  document.getElementById('gasEntryId').value='';
  document.getElementById('gasEntryDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('gasEntryMmscfd').value='';
  document.getElementById('gasEntryNote').value='';
  document.getElementById('gasEntryPreview').textContent='';
  openModal('modalGasEntry');
}
function openEditGasEntry(id){
  if(currentUser?.role!=='super'){ toast('⚠️ অনুমতি নেই'); return; }
  const e = getGasEntries().find(x=>x.id===id); if(!e) return;
  document.getElementById('gasEntryModalTitle').textContent='✏️ এন্ট্রি সম্পাদনা';
  document.getElementById('gasEntryId').value=id;
  document.getElementById('gasEntryDate').value=e.entry_date;
  document.getElementById('gasEntryMmscfd').value=e.mmscfd;
  document.getElementById('gasEntryNote').value=e.note||'';
  previewGasCalc();
  openModal('modalGasEntry');
}
async function saveGasEntry(){
  const id = document.getElementById('gasEntryId').value;
  const date = document.getElementById('gasEntryDate').value;
  const mmscfd = +document.getElementById('gasEntryMmscfd').value;
  if(!date || !mmscfd || mmscfd<=0){ toast('⚠️ তারিখ ও সঠিক MMSCFD মান দিন'); return; }
  const price = getGasPrice();
  if(!price){ toast('⚠️ আগে গ্যাসের দাম সেট করুন'); return; }
  const entries = getGasEntries();
  const dupIdx = entries.findIndex(x=>x.entry_date===date && x.id!==id);
  if(dupIdx>=0){ toast('⚠️ এই তারিখে ইতিমধ্যে একটা এন্ট্রি আছে — বরং সেটা এডিট করুন'); return; }
  const { scmPerDay, mscmPerDay, amountTaka } = computeGasCalc(mmscfd, price);
  const note = document.getElementById('gasEntryNote').value.trim();
  const now = new Date().toISOString();
  const idx = entries.findIndex(x=>x.id===id);
  const wasEdit = idx>=0;
  const rec = {
    id: id || crypto.randomUUID(),
    entry_date: date, mmscfd, mscm_per_day: mscmPerDay, scm_per_day: scmPerDay,
    price_per_scm: price, amount_taka: amountTaka, note,
    entered_by_name: currentUser?.name||currentUser?.email||'অজানা',
    entered_by_email: currentUser?.email||null,
    created_at: wasEdit ? entries[idx].created_at : now,
    updated_at: now,
  };
  if(wasEdit) entries[idx]=rec; else entries.push(rec);
  saveGasEntries(entries);
  logAudit('finance', wasEdit?'update':'create', `গ্যাস এন্ট্রি ${date}`, `${fmtNum(mmscfd,4)} MMSCFD → ৳${fmtNum(amountTaka,0)}`);
  closeModal('modalGasEntry');
  renderFinance();
  toast(wasEdit ? '✅ আপডেট হয়েছে' : '✅ এন্ট্রি যোগ হয়েছে');
  if(supaOk){
    if(wasEdit) supa(CFG.TABLE_GAS_ENTRIES+'?id=eq.'+rec.id,'PATCH',rec).catch(notifyCloudSyncFail);
    else supa(CFG.TABLE_GAS_ENTRIES,'POST',rec).catch(notifyCloudSyncFail);
  }
}
function deleteGasEntry(id){
  if(currentUser?.role!=='super'){ toast('⚠️ অনুমতি নেই'); return; }
  const e = getGasEntries().find(x=>x.id===id); if(!e) return;
  if(!confirm(`${e.entry_date}-এর এন্ট্রি মুছে দেবেন?`)) return;
  saveGasEntries(getGasEntries().filter(x=>x.id!==id));
  logAudit('finance', 'delete', `গ্যাস এন্ট্রি ${e.entry_date}`, `${fmtNum(e.mmscfd,4)} MMSCFD`);
  renderFinance();
  toast('🗑️ মুছে গেছে');
  if(supaOk) supa(CFG.TABLE_GAS_ENTRIES+'?id=eq.'+id,'DELETE').catch(notifyCloudSyncFail);
}

// ═══════════════════════════════════════════════════════
//  🧾 হিসাব ট্যাব — ধাপ ৩: কনডেনসেট আয়
//  (একটা মাসে একটাই এন্ট্রি — বর্তমানে নির্বাচিত মাস/বছর অনুযায়ী)
// ═══════════════════════════════════════════════════════
function openCondensateEntry(){
  if(currentUser?.role!=='super'){ toast('⚠️ শুধু সুপার অ্যাডমিন এন্ট্রি যোগ/সম্পাদনা করতে পারবেন'); return; }
  const existing = getCondensateEntries().find(c=>c.entry_year===Y && c.entry_month===M);
  document.getElementById('condMonthLabel').textContent = `${MN[M]} ${Y}`;
  document.getElementById('condEntryYear').value = Y;
  document.getElementById('condEntryMonth').value = M;
  if(existing){
    document.getElementById('condModalTitle').textContent = '✏️ কনডেনসেট এন্ট্রি সম্পাদনা';
    document.getElementById('condEntryId').value = existing.id;
    document.getElementById('condLightBbl').value = existing.light_condensate_bbl ?? '';
    document.getElementById('condHeavyBbl').value = existing.heavy_condensate_bbl ?? '';
    document.getElementById('condIncomeTaka').value = existing.income_taka ?? '';
    document.getElementById('condNote').value = existing.note || '';
    _cfValueCache.condensate = existing.custom_fields || {};
    renderCustomFieldInputs('condensate','cdCustomFields', existing.custom_fields||{});
  }else{
    document.getElementById('condModalTitle').textContent = '➕ কনডেনসেট এন্ট্রি';
    document.getElementById('condEntryId').value = '';
    document.getElementById('condLightBbl').value = '';
    document.getElementById('condHeavyBbl').value = '';
    document.getElementById('condIncomeTaka').value = '';
    document.getElementById('condNote').value = '';
    _cfValueCache.condensate = {};
    renderCustomFieldInputs('condensate','cdCustomFields', {});
  }
  openModal('modalCondensateEntry');
}
function openEditCondensateEntry(id){
  if(currentUser?.role!=='super'){ toast('⚠️ অনুমতি নেই'); return; }
  const c = getCondensateEntries().find(x=>x.id===id); if(!c) return;
  document.getElementById('condModalTitle').textContent = '✏️ কনডেনসেট এন্ট্রি সম্পাদনা';
  document.getElementById('condEntryId').value = c.id;
  document.getElementById('condEntryYear').value = c.entry_year;
  document.getElementById('condEntryMonth').value = c.entry_month;
  document.getElementById('condMonthLabel').textContent = `${MN[c.entry_month]} ${c.entry_year}`;
  document.getElementById('condLightBbl').value = c.light_condensate_bbl ?? '';
  document.getElementById('condHeavyBbl').value = c.heavy_condensate_bbl ?? '';
  document.getElementById('condIncomeTaka').value = c.income_taka ?? '';
  document.getElementById('condNote').value = c.note || '';
  _cfValueCache.condensate = c.custom_fields || {};
  renderCustomFieldInputs('condensate','cdCustomFields', c.custom_fields||{});
  openModal('modalCondensateEntry');
}
async function saveCondensateEntry(){
  const id = document.getElementById('condEntryId').value;
  const year = +document.getElementById('condEntryYear').value;
  const month = +document.getElementById('condEntryMonth').value;
  const income = +document.getElementById('condIncomeTaka').value;
  if(!income || income<0){ toast('⚠️ কনডেনসেট থেকে মোট আয়ের সঠিক পরিমাণ দিন'); return; }
  const light = document.getElementById('condLightBbl').value ? +document.getElementById('condLightBbl').value : null;
  const heavy = document.getElementById('condHeavyBbl').value ? +document.getElementById('condHeavyBbl').value : null;
  const note = document.getElementById('condNote').value.trim();
  const customFields = await collectCustomFieldValues('cdCustomFields', {});
  const entries = getCondensateEntries();
  const idx = entries.findIndex(x=>x.id===id);
  const wasEdit = idx>=0;
  const now = new Date().toISOString();
  const rec = {
    id: id || crypto.randomUUID(),
    entry_year: year, entry_month: month,
    light_condensate_bbl: light, heavy_condensate_bbl: heavy,
    income_taka: income, note, custom_fields: customFields,
    entered_by_name: currentUser?.name||currentUser?.email||'অজানা',
    entered_by_email: currentUser?.email||null,
    created_at: wasEdit ? entries[idx].created_at : now,
    updated_at: now,
  };
  if(wasEdit) entries[idx]=rec; else entries.push(rec);
  saveCondensateEntries(entries);
  logAudit('finance', wasEdit?'update':'create', `কনডেনসেট এন্ট্রি ${MN[month]} ${year}`, `৳${fmtNum(income,0)}`);
  closeModal('modalCondensateEntry');
  renderFinance();
  toast(wasEdit ? '✅ আপডেট হয়েছে' : '✅ এন্ট্রি যোগ হয়েছে');
  if(supaOk){
    if(wasEdit) supa(CFG.TABLE_CONDENSATE_ENTRIES+'?id=eq.'+rec.id,'PATCH',rec).catch(notifyCloudSyncFail);
    else supa(CFG.TABLE_CONDENSATE_ENTRIES,'POST',rec).catch(notifyCloudSyncFail);
  }
}
function deleteCondensateEntry(id){
  if(currentUser?.role!=='super'){ toast('⚠️ অনুমতি নেই'); return; }
  const c = getCondensateEntries().find(x=>x.id===id); if(!c) return;
  if(!confirm(`${MN[c.entry_month]} ${c.entry_year}-এর কনডেনসেট এন্ট্রি মুছে দেবেন?`)) return;
  saveCondensateEntries(getCondensateEntries().filter(x=>x.id!==id));
  logAudit('finance', 'delete', `কনডেনসেট এন্ট্রি ${MN[c.entry_month]} ${c.entry_year}`, `৳${fmtNum(c.income_taka,0)}`);
  renderFinance();
  toast('🗑️ মুছে গেছে');
  if(supaOk) supa(CFG.TABLE_CONDENSATE_ENTRIES+'?id=eq.'+id,'DELETE').catch(notifyCloudSyncFail);
}

// ═══════════════════════════════════════════════════════
//  🧾 হিসাব ট্যাব — ধাপ ৪: ব্যয় (খরচ) — শাখাভিত্তিক, বিলের ছবিসহ
//  (ছবি Supabase Storage-এ যায়, একই বাকেট যেটা ফাইল/ডকুমেন্টস ট্যাব
//  ব্যবহার করে — supaStorageUpload/Remove/PublicUrl পুনঃব্যবহার করা হয়েছে)
// ═══════════════════════════════════════════════════════
let _expStagedFiles = [];   // নতুন সিলেক্ট করা কিন্তু এখনো আপলোড হয়নি এমন ফাইল
let _expExistingBills = []; // এডিট মোডে আগে থেকে থাকা বিলের path (রিমুভ বাটনে বাদ দেয়া যায়)

function previewExpenseBills(event){
  const files = Array.from(event.target.files||[]);
  _expStagedFiles = _expStagedFiles.concat(files); // একাধিকবার ফাইল-পিকার খুললেও আগের সিলেকশন হারাবে না
  event.target.value='';
  renderExpenseBillPreviewArea();
}
function renderExpenseBillPreviewArea(){
  const box = document.getElementById('expBillPreview');
  let html = '';
  _expExistingBills.forEach((path,i)=>{
    html += `<div style="position:relative;"><img src="${supaStoragePublicUrl(path)}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;"/><button type="button" onclick="removeExistingBill(${i})" style="position:absolute;top:-6px;right:-6px;background:#DC2626;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;">✕</button></div>`;
  });
  _expStagedFiles.forEach((f,i)=>{
    html += `<div style="position:relative;"><img src="${URL.createObjectURL(f)}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;"/><button type="button" onclick="removeStagedBill(${i})" style="position:absolute;top:-6px;right:-6px;background:#DC2626;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;">✕</button></div>`;
  });
  box.innerHTML = html || '<p style="font-size:11px;color:var(--muted);">কোনো বিল যোগ করা হয়নি</p>';
}
function removeExistingBill(i){ _expExistingBills.splice(i,1); renderExpenseBillPreviewArea(); }
function removeStagedBill(i){ _expStagedFiles.splice(i,1); renderExpenseBillPreviewArea(); }
function openBillPreview(url){
  document.getElementById('billPreviewImg').src = url;
  openModal('modalBillPreview');
}

function openAddExpense(){
  document.getElementById('expModalTitle').textContent='➕ খরচ যোগ করুন';
  document.getElementById('expEntryId').value='';
  document.getElementById('expDept').value = currentUser?.role==='super' ? 'field' : (currentUser?.reqDept||'field');
  document.getElementById('expDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('expDesc').value='';
  document.getElementById('expAmount').value='';
  document.getElementById('expNote').value='';
  document.getElementById('expBillInput').value='';
  _expStagedFiles=[]; _expExistingBills=[];
  renderExpenseBillPreviewArea();
  openModal('modalExpenseEntry');
}
function openEditExpenseEntry(id){
  const e = getExpenseEntries().find(x=>x.id===id); if(!e) return;
  if(!canEdit(e.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  document.getElementById('expModalTitle').textContent='✏️ খরচ সম্পাদনা';
  document.getElementById('expEntryId').value=id;
  document.getElementById('expDept').value=e.dept;
  document.getElementById('expDate').value=e.expense_date;
  document.getElementById('expDesc').value=e.description;
  document.getElementById('expAmount').value=e.amount_taka;
  document.getElementById('expNote').value=e.note||'';
  document.getElementById('expBillInput').value='';
  _expStagedFiles=[];
  _expExistingBills=(e.bill_paths||[]).slice();
  renderExpenseBillPreviewArea();
  openModal('modalExpenseEntry');
}
async function saveExpenseEntry(){
  const id = document.getElementById('expEntryId').value;
  const dept = document.getElementById('expDept').value;
  if(!canEdit(dept)){ toast('⚠️ এই শাখায় খরচ যোগ করার অনুমতি নেই'); return; }
  const date = document.getElementById('expDate').value;
  const desc = document.getElementById('expDesc').value.trim();
  const amount = +document.getElementById('expAmount').value;
  if(!date || !desc || !amount || amount<=0){ toast('⚠️ তারিখ, বিবরণ ও সঠিক পরিমাণ দিন'); return; }
  const note = document.getElementById('expNote').value.trim();

  toast('⏳ সংরক্ষণ হচ্ছে...');
  const newPaths = [];
  for(const file of _expStagedFiles){
    try{
      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const path = `expense-bills/${dept}/${crypto.randomUUID()}${ext}`;
      await supaStorageUpload(path, file);
      newPaths.push(path);
    }catch(e){ toast(`❌ ${file.name} আপলোড ব্যর্থ: ${e.message}`); }
  }
  const finalPaths = [..._expExistingBills, ...newPaths];

  const entries = getExpenseEntries();
  const idx = entries.findIndex(x=>x.id===id);
  const wasEdit = idx>=0;
  const now = new Date().toISOString();
  if(wasEdit){
    // এডিটে যেসব পুরনো বিল রিমুভ বাটনে বাদ দেয়া হয়েছে, সেগুলো Storage থেকেও মুছে দেয়া হচ্ছে
    const oldPaths = entries[idx].bill_paths||[];
    const removedPaths = oldPaths.filter(p=>!_expExistingBills.includes(p));
    if(removedPaths.length) supaStorageRemove(removedPaths).catch(()=>{});
  }
  const rec = {
    id: id || crypto.randomUUID(),
    dept, expense_date: date, description: desc, amount_taka: amount,
    bill_paths: finalPaths, note,
    entered_by_name: currentUser?.name||currentUser?.email||'অজানা',
    entered_by_email: currentUser?.email||null,
    created_at: wasEdit ? entries[idx].created_at : now,
    updated_at: now,
  };
  if(wasEdit) entries[idx]=rec; else entries.push(rec);
  saveExpenseEntries(entries);
  logAudit('finance', wasEdit?'update':'create', `খরচ: ${desc}`, `৳${fmtNum(amount,0)} (${DEPT[dept]?.name||dept})`);
  closeModal('modalExpenseEntry');
  renderFinance();
  toast(wasEdit ? '✅ আপডেট হয়েছে' : '✅ খরচ যোগ হয়েছে');
  if(supaOk){
    if(wasEdit) supa(CFG.TABLE_EXPENSE_ENTRIES+'?id=eq.'+rec.id,'PATCH',rec).catch(notifyCloudSyncFail);
    else supa(CFG.TABLE_EXPENSE_ENTRIES,'POST',rec).catch(notifyCloudSyncFail);
  }
}
function deleteExpenseEntry(id){
  const e = getExpenseEntries().find(x=>x.id===id); if(!e) return;
  if(!canEdit(e.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  if(!confirm(`"${e.description}" (৳${fmtNum(e.amount_taka,0)}) খরচের এন্ট্রি মুছে দেবেন?`)) return;
  saveExpenseEntries(getExpenseEntries().filter(x=>x.id!==id));
  logAudit('finance', 'delete', `খরচ: ${e.description}`, `৳${fmtNum(e.amount_taka,0)}`);
  renderFinance();
  toast('🗑️ মুছে গেছে');
  if(e.bill_paths?.length) supaStorageRemove(e.bill_paths).catch(()=>{});
  if(supaOk) supa(CFG.TABLE_EXPENSE_ENTRIES+'?id=eq.'+id,'DELETE').catch(notifyCloudSyncFail);
}
