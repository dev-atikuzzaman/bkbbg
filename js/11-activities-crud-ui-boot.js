// ═══════════════════════════════════════════════════════
//  কার্যক্রম CRUD (ACTIVITIES)
// ═══════════════════════════════════════════════════════
function openAddActivity(){
  document.getElementById('actId').value='';
  document.getElementById('actDept').value = currentUser?.reqDept||'field';
  document.getElementById('actDate').value = `${Y}-${String(M).padStart(2,'0')}-01`;
  document.getElementById('actDesc').value = '';
  document.getElementById('modalActivityTitle').textContent='📝 নতুন কার্যক্রম';
  _cfValueCache.activities = {};
  renderCustomFieldInputs('activities','actCustomFields',{});
  openModal('modalActivity');
}

function openEditActivity(id){
  const a=getActivities().find(x=>x.id===id); if(!a) return;
  if(!canEdit(a.dept)){ toast('⚠️ এই শাখা সম্পাদনার অনুমতি নেই'); return; }
  document.getElementById('actId').value=a.id;
  document.getElementById('actDept').value=a.dept;
  document.getElementById('actDate').value=a.date;
  document.getElementById('actDesc').value=a.description;
  document.getElementById('modalActivityTitle').textContent='✏️ কার্যক্রম সম্পাদনা';
  _cfValueCache.activities = a.customFields||{};
  renderCustomFieldInputs('activities','actCustomFields', a.customFields||{});
  openModal('modalActivity');
}

async function saveActivityForm(){
  const id=document.getElementById('actId').value;
  const dept=document.getElementById('actDept').value;
  if(!canEdit(dept)){ toast('⚠️ এই শাখা সম্পাদনার অনুমতি নেই'); return; }
  const date=document.getElementById('actDate').value;
  const description=document.getElementById('actDesc').value.trim();
  if(!date||!description){ toast('⚠️ তারিখ ও বিবরণ দিন'); return; }
  const list=getActivities();
  const idx=list.findIndex(a=>a.id===id);
  const existingCF = idx>=0 ? (list[idx].customFields||{}) : {};
  const customFields = await collectCustomFieldValues('actCustomFields', existingCF);
  const rec={id:id||crypto.randomUUID(), dept, date, description, customFields};
  const wasEdit = idx>=0;
  if(idx>=0){
    if(!canEdit(list[idx].dept)){ toast('⚠️ অনুমতি নেই'); return; }
    list[idx]=rec;
  } else {
    list.push(rec);
  }
  saveActivities(list);
  logAudit('activities', wasEdit?'update':'create', description.slice(0,60), date);
  closeModal('modalActivity');
  renderActivities();
  toast(idx>=0 ? '✅ আপডেট হয়েছে' : '✅ কার্যক্রম যোগ হয়েছে');
  if(supaOk){
    if(idx>=0) supa(CFG.TABLE_ACTIVITIES+'?id=eq.'+rec.id,'PATCH',rec).catch(notifyCloudSyncFail);
    else        supa(CFG.TABLE_ACTIVITIES,'POST',rec).catch(notifyCloudSyncFail);
  }
}

function deleteActivity(id){
  const a=getActivities().find(x=>x.id===id); if(!a) return;
  if(!canEdit(a.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  if(!confirm('এই কার্যক্রম মুছে দেবেন?')) return;
  saveActivities(getActivities().filter(x=>x.id!==id));
  logAudit('activities', 'delete', (a.description||'').slice(0,60), a.date);
  renderActivities(); toast('🗑️ মুছে গেছে');
  if(supaOk) supa(CFG.TABLE_ACTIVITIES+'?id=eq.'+id,'DELETE').catch(notifyCloudSyncFail);
}

// ═══════════════════════════════════════════════════════
//  MODAL / UI HELPERS
// ═══════════════════════════════════════════════════════
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.mo').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)closeModal(m.id);});});
function showLoader(t='লোড হচ্ছে...'){document.getElementById('loaderTxt').textContent=t;document.getElementById('loaderOv').classList.add('show');}
function hideLoader(){document.getElementById('loaderOv').classList.remove('show');}
let toastTimer=null;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
}
function dismissInstall(){
  document.getElementById('installBar').classList.remove('visible');
  localStorage.setItem('install_dismissed','1');
}

// ═══════════════════════════════════════════════════════
//  ট্যাব আবার visible হলে ক্লাউড থেকে নতুন ডেটা রিফ্রেশ করা
//  (অন্য ট্যাবে/ইনকগনিটোতে যোগ করা ডেটা ম্যানুয়াল রিলোড ছাড়াই দেখাতে সাহায্য করে)
// ═══════════════════════════════════════════════════════
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible' && currentUser && currentUser.role!=='viewer' && supaOk){
    fetchFromCloud().catch(()=>{});
  }
});

// ═══════════════════════════════════════════════════════
//  SERVICE WORKER
// ═══════════════════════════════════════════════════════
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
}

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
initApp();
restoreSession();
