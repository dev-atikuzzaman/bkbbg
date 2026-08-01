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

  // ক্রমপুঞ্জিত (cumulative) হিসাবের জন্য পুরনো->নতুন ক্রমে সাজিয়ে যোগ করা হচ্ছে
  const chronological = getGasEntries().slice().sort((a,b)=> a.entry_date.localeCompare(b.entry_date));
  let cumScm=0, cumTaka=0;
  const withCumulative = chronological.map(e=>{
    cumScm  += (+e.scm_per_day||0);
    cumTaka += (+e.amount_taka||0);
    return {...e, cum_scm:cumScm, cum_taka:cumTaka};
  });

  // এই মাসের সারাংশ (কার্ডের জন্য)
  const monthEntries = chronological.filter(e=>{
    const d=new Date(e.entry_date);
    return (d.getMonth()+1)===M && d.getFullYear()===Y;
  });
  const monthGas  = monthEntries.reduce((s,e)=>s+(+e.scm_per_day||0),0);
  const monthTaka = monthEntries.reduce((s,e)=>s+(+e.amount_taka||0),0);
  document.getElementById('finMonthGas').textContent  = fmtNum(monthGas,0);
  document.getElementById('finMonthTaka').textContent = '৳'+fmtNum(monthTaka,0);
  document.getElementById('finTotalTaka').textContent = '৳'+fmtNum(cumTaka,0);

  // টেবিলে নতুন এন্ট্রি সবার ওপরে দেখানো হয় (হিসাবটা যদিও পুরনো->নতুন ক্রমে করা হয়েছিল)
  const displayList = withCumulative.slice().reverse();
  const tb=document.getElementById('gasEntryBody');
  const canW = currentUser?.role==='super';
  tb.innerHTML='';
  if(!displayList.length){
    tb.innerHTML=`<tr><td colspan="10" style="text-align:center;padding:28px;color:#94A3B8;">এখনো কোনো গ্যাস উৎপাদন এন্ট্রি নেই</td></tr>`;
    return;
  }
  displayList.forEach(e=>{
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
    tb.appendChild(tr);
  });
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
