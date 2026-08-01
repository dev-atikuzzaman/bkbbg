// ═══════════════════════════════════════════════════════
//  CLOUD SYNC
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
//  REALTIME — যেকোনো ডিভাইস/ট্যাব/উইন্ডো থেকে পরিবর্তন হলেই
//  সাথে সাথে সব জায়গায় আপডেট হয়ে যাবে (Supabase Realtime)
// ═══════════════════════════════════════════════════════
let realtimeClient = null;
let realtimeChannel = null;
let _rtReloadTimers = {}; // প্রতি টেবিলের জন্য আলাদা ডিবাউন্স, বারবার দ্রুত event এলে একসাথে একবারই রিফ্রেশ হবে

const RT_TABLES = [
  { name: CFG.TABLE_TXN, reload: reloadTxnsFromCloud },
  { name: CFG.TABLE_MANPOWER,   reload: reloadManpowerFromCloud },
  { name: CFG.TABLE_ACTIVITIES, reload: reloadActivitiesFromCloud },
  { name: CFG.TABLE_ATTENDANCE, reload: reloadAttendanceFromCloud },
  { name: CFG.TABLE_DOCS,       reload: reloadDocsFromCloud },
  { name: CFG.TABLE_GAS_ENTRIES, reload: reloadGasEntriesFromCloud },
  { name: CFG.TABLE_FIN_SETTINGS, reload: reloadFinSettingsFromCloud },
];

function scheduleRtReload(tableName, fn){
  clearTimeout(_rtReloadTimers[tableName]);
  _rtReloadTimers[tableName] = setTimeout(()=>{
    fn().catch(e=>console.warn('realtime reload failed for', tableName, e.message));
  }, 400); // 400ms ডিবাউন্স — একসাথে অনেক row পরিবর্তন হলেও একবারই রিফ্রেশ হবে
}

function initRealtime(){
  if(realtimeChannel) return; // ইতিমধ্যে চালু আছে
  if(typeof window.supabase==='undefined' || !window.supabase.createClient){
    console.warn('supabase-js লোড হয়নি, Realtime বন্ধ থাকবে (সাধারণ fetch-ভিত্তিক সিঙ্ক চলবে)');
    return;
  }
  if(!CFG.URL || !CFG.KEY) return;
  try{
    if(!realtimeClient){
      realtimeClient = window.supabase.createClient(CFG.URL, CFG.KEY, {
        auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
      });
    }
    realtimeChannel = realtimeClient.channel('bgfcl-realtime-sync');
    RT_TABLES.forEach(t=>{
      realtimeChannel.on('postgres_changes',
        { event:'*', schema:'public', table:t.name },
        payload=>{
          scheduleRtReload(t.name, t.reload);
          // ব্যবহারকারী যে টেবিলটা এখন দেখছেন সেটাতে পরিবর্তন হলে হালকা toast দেখানো
          const activeTable = currentTab==='materials' ? [CFG.TABLE_TXN]
                             : currentTab==='manpower'  ? [CFG.TABLE_MANPOWER,CFG.TABLE_ATTENDANCE]
                             : [CFG.TABLE_ACTIVITIES];
          if(activeTable.includes(t.name)) toast('🔄 অন্য জায়গা থেকে আপডেট হয়েছে');
        }
      );
    });
    realtimeChannel.subscribe(status=>{
      if(status==='SUBSCRIBED') console.log('✅ Realtime সংযুক্ত');
      else if(status==='CHANNEL_ERROR' || status==='TIMED_OUT') console.warn('Realtime সংযোগ সমস্যা:', status);
    });
  }catch(e){ console.warn('Realtime চালু করা যায়নি:', e.message); }
}

function stopRealtime(){
  try{ if(realtimeChannel){ realtimeClient?.removeChannel(realtimeChannel); realtimeChannel=null; } }catch(e){}
}

async function reloadTxnsFromCloud(){
  const txns = await supa(CFG.TABLE_TXN+'?order=txn_date.desc');
  if(txns?.length) saveTxns(txns);
  if(currentTab==='materials') renderAll();
}
async function reloadDocsFromCloud(){
  const docs = await supa(CFG.TABLE_DOCS+'?order=created_at.desc');
  if(docs) saveDocs(docs);
  if(currentTab==='docs') renderDocs();
}
async function reloadGasEntriesFromCloud(){
  const rows = await supa(CFG.TABLE_GAS_ENTRIES+'?order=entry_date.desc');
  if(rows) saveGasEntries(rows);
  if(currentTab==='finance') renderFinance();
}
async function reloadFinSettingsFromCloud(){
  const rows = await supa(CFG.TABLE_FIN_SETTINGS+'?select=*');
  if(rows) saveFinSettings(rows);
  if(currentTab==='finance') renderFinance();
}
async function reloadManpowerFromCloud(){
  const manpower = await supa(CFG.TABLE_MANPOWER+'?order=name');
  if(manpower?.length) saveManpower(manpower);
  if(currentTab==='manpower') renderManpower();
}
async function reloadActivitiesFromCloud(){
  const activities = await supa(CFG.TABLE_ACTIVITIES+'?order=date.desc');
  if(activities?.length) saveActivities(activities);
  if(currentTab==='activities') renderActivities();
}
async function reloadAttendanceFromCloud(){
  const attendance = await supa(CFG.TABLE_ATTENDANCE+'?order=date');
  if(attendance?.length){
    const att = {};
    attendance.forEach(r=>{ att[r.worker_id]=att[r.worker_id]||{}; att[r.worker_id][r.date]=r.status; });
    saveAttendanceData(att);
  }
  if(currentTab==='manpower') renderManpower();
}

async function fetchFromCloud(){
  try{
    const txns = await supa(CFG.TABLE_TXN+'?order=txn_date.desc');
    if(txns?.length) saveTxns(txns);
  }catch(e){ /* transactions cloud fetch failed, keep local */ }
  // মালামাল ছাড়া অন্য টেবিলগুলো (manpower/activities) supabase_setup.sql আপডেট না করা পর্যন্ত
  // নাও থাকতে পারে, তাই আলাদাভাবে try/catch করা হলো যেন একটির অভাবে বাকিগুলো আটকে না যায়
  //
  // গুরুত্বপূর্ণ: cloud থেকে খালি লিস্ট (০টি এন্ট্রি) এলে তা দিয়ে লোকাল ডেটা
  // ওভাররাইট করা হয় না (`?.length` চেক — খালি অ্যারে হলে বাদ)। কারণ ক্লাউডে
  // insert ব্যর্থ হলেও (যেমন টেবিলে কোনো কলাম মিসিং থাকলে) SELECT সবসময় সফল
  // হয়ে খালি লিস্ট ফেরত দেয় — আগে `Array.isArray()` চেক থাকায় এটি ভুলবশত
  // "নতুন যোগ করা তথ্য মুছে যাওয়া" বাগ তৈরি করছিল।
  try{
    const manpower = await supa(CFG.TABLE_MANPOWER+'?order=name');
    if(manpower?.length) saveManpower(manpower);
  }catch(e){ console.warn('manpower cloud sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
  try{
    const activities = await supa(CFG.TABLE_ACTIVITIES+'?order=date.desc');
    if(activities?.length) saveActivities(activities);
  }catch(e){ console.warn('activities cloud sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
  try{
    const attendance = await supa(CFG.TABLE_ATTENDANCE+'?order=date');
    if(attendance?.length){
      const att = {};
      attendance.forEach(r=>{ att[r.worker_id]=att[r.worker_id]||{}; att[r.worker_id][r.date]=r.status; });
      saveAttendanceData(att);
    }
  }catch(e){ console.warn('attendance cloud sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
  try{
    const docs = await supa(CFG.TABLE_DOCS+'?order=created_at.desc');
    if(docs) saveDocs(docs); // খালি তালিকাও বৈধ (নতুন ফিচার, sample data নেই)
  }catch(e){ console.warn('doc_items cloud sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
  try{
    const gasRows = await supa(CFG.TABLE_GAS_ENTRIES+'?order=entry_date.desc');
    if(gasRows) saveGasEntries(gasRows);
  }catch(e){ console.warn('finance_gas_entries cloud sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
  try{
    const finRows = await supa(CFG.TABLE_FIN_SETTINGS+'?select=*');
    if(finRows) saveFinSettings(finRows);
  }catch(e){ console.warn('finance_settings cloud sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
  renderCurrentTab();
}

async function syncNow(){
  if(!supaOk){ toast('⚠️ ক্লাউড সংযোগ নেই — ইন্টারনেট চেক করুন'); checkSupaConn(); return; }
  showLoader('ক্লাউডে সিঙ্ক হচ্ছে...');
  try{
    const txns = getTxns();
    await supa(CFG.TABLE_TXN,'DELETE',null);
    for(const t of txns) await supa(CFG.TABLE_TXN,'POST',t).catch(()=>{});
    try{
      const manpower = getManpower();
      await supa(CFG.TABLE_MANPOWER,'DELETE',null);
      for(const m of manpower) await supa(CFG.TABLE_MANPOWER,'POST',m).catch(()=>{});
    }catch(e){ console.warn('manpower sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
    try{
      const activities = getActivities();
      await supa(CFG.TABLE_ACTIVITIES,'DELETE',null);
      for(const a of activities) await supa(CFG.TABLE_ACTIVITIES,'POST',a).catch(()=>{});
    }catch(e){ console.warn('activities sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
    try{
      const att = getAttendance();
      const flat = [];
      for(const workerId in att){ for(const date in att[workerId]){ flat.push({id:`${workerId}_${date}`, worker_id:workerId, date, status:att[workerId][date]}); } }
      await supa(CFG.TABLE_ATTENDANCE,'DELETE',null);
      for(const r of flat) await supa(CFG.TABLE_ATTENDANCE,'POST',r).catch(()=>{});
    }catch(e){ console.warn('attendance sync skipped (টেবিল তৈরি করা লাগবে):', e.message); }
    hideLoader(); toast('✅ ক্লাউডে সিঙ্ক সম্পন্ন');
  }catch(e){ hideLoader(); toast('❌ সিঙ্ক ব্যর্থ: '+(e.message||'')); }
}

// ═══════════════════════════════════════════════════════
//  PERMISSION CHECK
// ═══════════════════════════════════════════════════════
function canEdit(dept){
  const r = currentUser?.role;
  if(r==='super') return true;
  if(r==='admin' && currentUser.reqDept===dept) return true;
  return false;
}

// ═══════════════════════════════════════════════════════
//  EXPORT / IMPORT
// ═══════════════════════════════════════════════════════
function exportJSON(){
  const blob = new Blob([JSON.stringify({txns:getTxns(),manpower:getManpower(),activities:getActivities(),at:new Date().toISOString()},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`bgfcl_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); toast('✅ Export হচ্ছে...');
}
function importJSON(e){
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      if(d.txns)       saveTxns(d.txns);
      if(d.manpower)   saveManpower(d.manpower);
      if(d.activities) saveActivities(d.activities);
      renderCurrentTab(); toast('✅ Import সফল');
    }catch{ toast('❌ ফাইল পড়তে সমস্যা'); }
  };
  rd.readAsText(f); e.target.value='';
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
function initApp(){
  // 🆕 DEPT অবজেক্ট থেকে শাখা-ফিল্টার বাটন স্বয়ংক্রিয়ভাবে বসানো হচ্ছে
  // (নতুন শাখা যোগ হলে শুধু DEPT অবজেক্ট বদলালেই এখানে আপনাআপনি চলে আসবে)
  const df=document.getElementById('deptFilter');
  Object.keys(DEPT).forEach(k=>{
    const b=document.createElement('button');
    b.className='filter-btn'; b.dataset.dept=k;
    b.textContent = `${DEPT[k].icon} ${DEPT[k].name}`;
    df.appendChild(b);
  });
  // 🆕 সংরক্ষিত ফন্ট/সাইজ/জুম পছন্দ প্রয়োগ করা হচ্ছে
  try{ initDisplayPrefs(); }catch(e){ console.error('initDisplayPrefs failed:',e); }

  const sel=document.getElementById('yearSel');
  for(let y=2023;y<=2030;y++){
    const o=document.createElement('option');
    o.value=y;o.textContent=y;if(y===Y)o.selected=true;
    sel.appendChild(o);
  }
  document.getElementById('monthSel').value=M;
  document.getElementById('yearSel').addEventListener('change',e=>{Y=+e.target.value;renderCurrentTab();});
  document.getElementById('monthSel').addEventListener('change',e=>{M=+e.target.value;renderCurrentTab();});
  document.getElementById('deptFilter').addEventListener('click',e=>{
    const b=e.target.closest('.filter-btn');if(!b)return;
    document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); filterDept=b.dataset.dept; renderCurrentTab();
  });
  document.querySelectorAll('.chart-tab').forEach(t=>{
    t.addEventListener('click',()=>{
      document.querySelectorAll('.chart-tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active'); filterChart=t.dataset.chart; renderChart();
    });
  });
  document.getElementById('mainTabs').addEventListener('click',e=>{
    const b=e.target.closest('.main-tab'); if(!b) return;
    switchMainTab(b.dataset.tab);
  });
  document.getElementById('btnAddTxn').addEventListener('click',()=>{
    document.getElementById('txDept').value = currentUser?.reqDept||'field';
    document.getElementById('txType').value = 'in';
    document.getElementById('txDate').value = new Date().toISOString().slice(0,10);
    ['txProduct','txQty','txUnit','txSource','txPurpose','txWorkOrder','txNote'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('txImage').value='';
    document.getElementById('txImagePreview').style.display='none';
    _cfValueCache.items = {};
    renderCustomFieldInputs('items','txCustomFields',{});
    refreshProductDatalist();
    toggleTxnType('tx');
    openModal('modalTxn');
  });
  document.getElementById('btnAddManpower').addEventListener('click', openAddManpower);
  document.getElementById('btnAddActivity').addEventListener('click', openAddActivity);
  // 🆕 ফাইল/ডকুমেন্টস
  document.getElementById('btnNewFolder').addEventListener('click',()=>{
    document.getElementById('folderName').value='';
    document.getElementById('folderTags').value='';
    openModal('modalNewFolder');
  });
  document.getElementById('docFileInput').addEventListener('change',function(){
    if(this.files && this.files.length) stageUploadFiles(this.files);
  });
  // 🆕 হিসাব
  document.getElementById('btnSetGasPrice').addEventListener('click', openSetGasPrice);
  document.getElementById('btnAddGasEntry').addEventListener('click', openAddGasEntry);
  // PWA install
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault(); deferredPrompt=e;
    if(!localStorage.getItem('install_dismissed'))
      setTimeout(()=>document.getElementById('installBar').classList.add('visible'),2500);
  });
  document.getElementById('btnInstall').addEventListener('click',async()=>{
    if(!deferredPrompt){toast('ব্রাউজার মেনু থেকে "Add to Home Screen" ব্যবহার করুন');return;}
    deferredPrompt.prompt();
    const{outcome}=await deferredPrompt.userChoice;
    if(outcome==='accepted') toast('✅ ইনস্টল হচ্ছে...');
    deferredPrompt=null;
    document.getElementById('installBar').classList.remove('visible');
  });
  window.addEventListener('appinstalled',()=>toast('✅ অ্যাপ ইনস্টল সম্পন্ন!'));
}

