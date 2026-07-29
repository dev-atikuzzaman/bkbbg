// ═══════════════════════════════════════════════════════
//  CRUD
// ═══════════════════════════════════════════════════════
async function saveTxn(){
  const dept=document.getElementById('txDept').value;
  if(!canEdit(dept)){ toast('⚠️ এই শাখা সম্পাদনার অনুমতি নেই'); return; }
  const txn_type=document.getElementById('txType').value;
  const date=document.getElementById('txDate').value;
  const product_name=document.getElementById('txProduct').value.trim();
  const qty=+document.getElementById('txQty').value||0;
  if(!date||!product_name||qty<=0){ toast('⚠️ তারিখ, প্রোডাক্টের নাম ও পরিমাণ (০-এর বেশি) দিন'); return; }
  if(txn_type==='out' && !document.getElementById('txPurpose').value.trim()){
    toast('⚠️ কোন কাজে ব্যবহৃত হয়েছে তা দিন'); return;
  }
  const fileInput=document.getElementById('txImage');
  let image_data=null;
  if(fileInput.files && fileInput.files[0]){
    try{ image_data = await readFileAsDataURL(fileInput.files[0]); }catch(e){ /* ছবি ছাড়াই সংরক্ষণ হবে */ }
  }
  const customFields = await collectCustomFieldValues('txCustomFields', {});
  const d=new Date(date);
  const nt={
    id:crypto.randomUUID(), dept, product_name, txn_type,
    qty, unit:document.getElementById('txUnit').value.trim(),
    source:     txn_type==='in'  ? document.getElementById('txSource').value.trim()    : null,
    purpose:    txn_type==='out' ? document.getElementById('txPurpose').value.trim()   : null,
    work_order: txn_type==='out' ? document.getElementById('txWorkOrder').value.trim() : null,
    note: document.getElementById('txNote').value.trim(),
    image_data,
    txn_date:date, month:d.getMonth()+1, year:d.getFullYear(),
    customFields,
  };
  const txns=getTxns(); txns.push(nt); saveTxns(txns);
  logAudit('materials', 'create', nt.product_name, `${txn_type==='in'?'ইন':'আউট'} ${nt.qty}${nt.unit?' '+nt.unit:''}`);
  closeModal('modalTxn');
  ['txProduct','txQty','txUnit','txSource','txPurpose','txWorkOrder','txNote'].forEach(id=>document.getElementById(id).value='');
  fileInput.value=''; document.getElementById('txImagePreview').style.display='none';
  _cfValueCache.items = {};
  renderCustomFieldInputs('items','txCustomFields',{});
  renderAll();
  toast(txn_type==='in' ? '✅ মালামাল যুক্ত হয়েছে' : '✅ ব্যবহারের হিসাব যুক্ত হয়েছে');
  if(supaOk) supa(CFG.TABLE_TXN,'POST',nt).catch(notifyCloudSyncFail);
}

function openEditTxn(id){
  const t=getTxns().find(x=>x.id===id); if(!t) return;
  if(!canEdit(t.dept)){ toast('⚠️ এই শাখা সম্পাদনার অনুমতি নেই'); return; }
  document.getElementById('etxId').value=id;
  document.getElementById('etxDept').value=t.dept;
  document.getElementById('etxType').value=t.txn_type;
  document.getElementById('etxDate').value=t.txn_date;
  document.getElementById('etxProduct').value=t.product_name;
  document.getElementById('etxQty').value=t.qty;
  document.getElementById('etxUnit').value=t.unit||'';
  document.getElementById('etxSource').value=t.source||'';
  document.getElementById('etxPurpose').value=t.purpose||'';
  document.getElementById('etxWorkOrder').value=t.work_order||'';
  document.getElementById('etxNote').value=t.note||'';
  document.getElementById('etxImageCurrent').value = t.image_data||'';
  document.getElementById('etxImage').value='';
  const prev=document.getElementById('etxImagePreview');
  if(t.image_data){ prev.src=t.image_data; prev.style.display=''; } else { prev.style.display='none'; }
  _cfValueCache.items = t.customFields||{};
  renderCustomFieldInputs('items','etxCustomFields', t.customFields||{});
  toggleTxnType('etx');
  openModal('modalEditTxn');
}

async function updateTxn(){
  const id=document.getElementById('etxId').value;
  const txns=getTxns();
  const idx=txns.findIndex(x=>x.id===id); if(idx<0) return;
  if(!canEdit(txns[idx].dept)){ toast('⚠️ অনুমতি নেই'); return; }
  const txn_type=document.getElementById('etxType').value;
  const date=document.getElementById('etxDate').value;
  const product_name=document.getElementById('etxProduct').value.trim();
  const qty=+document.getElementById('etxQty').value||0;
  if(!date||!product_name||qty<=0){ toast('⚠️ তারিখ, প্রোডাক্টের নাম ও পরিমাণ (০-এর বেশি) দিন'); return; }
  if(txn_type==='out' && !document.getElementById('etxPurpose').value.trim()){
    toast('⚠️ কোন কাজে ব্যবহৃত হয়েছে তা দিন'); return;
  }
  const fileInput=document.getElementById('etxImage');
  let image_data = document.getElementById('etxImageCurrent').value || null;
  if(fileInput.files && fileInput.files[0]){
    try{ image_data = await readFileAsDataURL(fileInput.files[0]); }catch(e){ /* পুরনো ছবিই থেকে যাবে */ }
  }
  const customFields = await collectCustomFieldValues('etxCustomFields', txns[idx].customFields||{});
  const d=new Date(date);
  txns[idx]={...txns[idx],
    dept:document.getElementById('etxDept').value,
    txn_type, product_name, qty,
    unit:document.getElementById('etxUnit').value.trim(),
    source:     txn_type==='in'  ? document.getElementById('etxSource').value.trim()    : null,
    purpose:    txn_type==='out' ? document.getElementById('etxPurpose').value.trim()   : null,
    work_order: txn_type==='out' ? document.getElementById('etxWorkOrder').value.trim() : null,
    note: document.getElementById('etxNote').value.trim(),
    image_data,
    txn_date:date, month:d.getMonth()+1, year:d.getFullYear(),
    customFields,
  };
  saveTxns(txns);
  logAudit('materials', 'update', txns[idx].product_name, `${txn_type==='in'?'ইন':'আউট'} ${txns[idx].qty}${txns[idx].unit?' '+txns[idx].unit:''}`);
  closeModal('modalEditTxn');
  renderAll(); toast('✅ আপডেট হয়েছে');
  if(supaOk) supa(CFG.TABLE_TXN+'?id=eq.'+id,'PATCH',txns[idx]).catch(notifyCloudSyncFail);
}

function deleteTxn(id){
  const t=getTxns().find(x=>x.id===id); if(!t) return;
  if(!canEdit(t.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  if(!confirm('এই লেনদেন মুছে দেবেন? (এতে প্রোডাক্টের বর্তমান স্টক হিসাবও বদলে যাবে)')) return;
  saveTxns(getTxns().filter(x=>x.id!==id));
  logAudit('materials', 'delete', t.product_name, `${t.txn_type==='in'?'ইন':'আউট'} ${t.qty}${t.unit?' '+t.unit:''}`);
  renderAll(); toast('🗑️ মুছে গেছে');
  if(supaOk) supa(CFG.TABLE_TXN+'?id=eq.'+id,'DELETE').catch(notifyCloudSyncFail);
}

// ধরন (ইন/আউট) অনুযায়ী ফর্মের প্রাসঙ্গিক অংশ দেখানো/লুকানো — prefix: 'tx' (নতুন) | 'etx' (এডিট)
function toggleTxnType(prefix){
  prefix = prefix || 'tx';
  const type = document.getElementById(prefix+'Type').value;
  document.getElementById(prefix+'InWrap').style.display  = type==='in'  ? '' : 'none';
  document.getElementById(prefix+'OutWrap').style.display = type==='out' ? '' : 'none';
}

// ছবি সিলেক্ট করলে সাথে সাথে প্রিভিউ দেখানো — prefix: 'tx' | 'etx'
function previewTxnImage(prefix){
  const fileInput=document.getElementById(prefix+'Image');
  const prev=document.getElementById(prefix+'ImagePreview');
  if(fileInput.files && fileInput.files[0]){
    readFileAsDataURL(fileInput.files[0]).then(url=>{ prev.src=url; prev.style.display=''; }).catch(()=>{});
  }
}

// প্রোডাক্টের নাম টাইপ করার সময় আগের প্রোডাক্টের তালিকা সাজেশনে দেখানোর জন্য datalist রিফ্রেশ
function refreshProductDatalist(){
  const dl=document.getElementById('txProductList');
  if(!dl) return;
  const names=[...new Set(getTxns().map(t=>t.product_name))].sort((a,b)=>a.localeCompare(b,'bn'));
  dl.innerHTML = names.map(n=>`<option value="${escHtml(n)}"></option>`).join('');
}

