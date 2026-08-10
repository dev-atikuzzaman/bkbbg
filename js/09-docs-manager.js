// ═══════════════════════════════════════════════════════
//  🆕 ফাইল/ডকুমেন্টস ম্যানেজার
// ═══════════════════════════════════════════════════════
let docCurrentFolder = null;
let docViewMode = localStorage.getItem('bgfcl_doc_view') || 'grid';
let docTagFilter = null;
let docSearchQuery = '';
let docSelectMode = false;  // 🆕 একাধিক নির্বাচন মোড চালু আছে কিনা
let docSelected = new Set(); // 🆕 বর্তমানে নির্বাচিত আইটেমের id-গুলো
let docDragId = null;      // PC (HTML5 DnD) — বর্তমানে ধরে থাকা আইটেমের id
let _stagedFiles = [];     // আপলোড-স্টেজিং এ থাকা ফাইলগুলো
let _touchState = null;    // মোবাইল টাচ-ড্র্যাগের অবস্থা

function docIconFor(mime){
  if(!mime) return '📄';
  if(mime.startsWith('image/')) return '🖼️';
  if(mime.startsWith('video/')) return '🎥';
  if(mime.startsWith('audio/')) return '🎵';
  if(mime==='application/pdf') return '📕';
  if(mime.includes('word')||mime.includes('document')) return '📝';
  if(mime.includes('sheet')||mime.includes('excel')||mime.includes('csv')) return '📊';
  if(mime.includes('presentation')||mime.includes('powerpoint')) return '📽️';
  if(mime.includes('zip')||mime.includes('compressed')||mime.includes('rar')) return '🗜️';
  return '📄';
}
function humanSize(bytes){
  if(bytes===null||bytes===undefined) return '';
  if(bytes<1024) return bytes+' B';
  if(bytes<1024*1024) return (bytes/1024).toFixed(1)+' KB';
  if(bytes<1024*1024*1024) return (bytes/1024/1024).toFixed(1)+' MB';
  return (bytes/1024/1024/1024).toFixed(2)+' GB';
}

function getDocChildren(){
  let list;
  if(docSearchQuery.trim()){
    const q=docSearchQuery.trim().toLowerCase();
    list = getDocs().filter(d=>d.name.toLowerCase().includes(q)); // সার্চের সময় সব ফোল্ডার জুড়ে খোঁজা হয়
  }else{
    list = getDocs().filter(d=>(d.parent_id||null)===(docCurrentFolder||null));
  }
  if(docTagFilter) list = list.filter(d=>(d.tags||[]).includes(docTagFilter));
  return list.sort((a,b)=>{
    if(a.item_type!==b.item_type) return a.item_type==='folder'?-1:1;
    return a.name.localeCompare(b.name,'bn');
  });
}
function docBreadcrumbChain(){
  const chain=[]; const all=getDocs();
  let cur=docCurrentFolder;
  while(cur){
    const node=all.find(d=>d.id===cur); if(!node) break;
    chain.unshift(node); cur=node.parent_id;
  }
  return chain;
}
function docFolderPathLabel(id){
  if(!id) return '';
  const chain=[]; let cur=getDocs().find(d=>d.id===id);
  while(cur){ chain.unshift(cur.name); cur = cur.parent_id ? getDocs().find(d=>d.id===cur.parent_id) : null; }
  return chain.join(' / ');
}
function isDocDescendant(ancestorId, checkId){
  let cur=getDocs().find(d=>d.id===checkId);
  while(cur && cur.parent_id){
    if(cur.parent_id===ancestorId) return true;
    cur=getDocs().find(d=>d.id===cur.parent_id);
  }
  return false;
}

function docNavigateTo(id){
  docCurrentFolder=id; docSearchQuery='';
  const si=document.getElementById('docSearchInput'); if(si) si.value='';
  renderDocs();
}
function setDocViewMode(mode){
  docViewMode=mode; localStorage.setItem('bgfcl_doc_view',mode); renderDocs();
}

function renderDocs(){
  renderDocBreadcrumb();
  renderDocTagBar();
  renderDocBulkBar();
  const list=getDocChildren();
  document.getElementById('docGridWrap').style.display = docViewMode==='grid' ? '' : 'none';
  document.getElementById('docListWrap').style.display = docViewMode==='list' ? '' : 'none';
  if(docViewMode==='grid') renderDocGrid(list); else renderDocListView(list);
  document.getElementById('docViewGridBtn').classList.toggle('active', docViewMode==='grid');
  document.getElementById('docViewListBtn').classList.toggle('active', docViewMode==='list');
  document.getElementById('docSelectModeBtn').classList.toggle('active', docSelectMode);
}

function renderDocBreadcrumb(){
  const box=document.getElementById('docBreadcrumb');
  const chain=docBreadcrumbChain();
  let html = `<button class="doc-crumb${!docCurrentFolder?' current':''}" data-folderid="" onclick="docNavigateTo(null)" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="docCrumbDrop(event,null)">🏠 রুট</button>`;
  chain.forEach((node,i)=>{
    html += `<span class="doc-crumb-sep">›</span>`;
    if(i===chain.length-1){
      html += `<button class="doc-crumb current" disabled>${escHtml(node.name)}</button>`;
    }else{
      html += `<button class="doc-crumb" data-folderid="${node.id}" onclick="docNavigateTo('${node.id}')" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="docCrumbDrop(event,'${node.id}')">${escHtml(node.name)}</button>`;
    }
  });
  box.innerHTML=html;
}
function renderDocTagBar(){
  const box=document.getElementById('docTagBar');
  const tags=[...new Set(getDocs().flatMap(d=>d.tags||[]))].sort((a,b)=>a.localeCompare(b,'bn'));
  if(!tags.length){ box.innerHTML=''; return; }
  let html=`<span class="doc-tag-chip${!docTagFilter?' active':''}" onclick="docTagFilter=null;renderDocs();">সব ক্যাটাগরি</span>`;
  tags.forEach(t=>{ html+=`<span class="doc-tag-chip${docTagFilter===t?' active':''}" onclick="docTagFilter='${escHtml(t)}';renderDocs();">${escHtml(t)}</span>`; });
  box.innerHTML=html;
}

function renderDocGrid(list){
  const wrap=document.getElementById('docGridWrap');
  if(!list.length){
    wrap.innerHTML=`<div class="empty-st" style="grid-column:1/-1;"><div class="ei">📭</div><p>${docSearchQuery?'কিছু পাওয়া যায়নি':'এই ফোল্ডার খালি — নতুন ফোল্ডার, ফাইল বা নোট যোগ করুন'}</p></div>`;
    return;
  }
  wrap.innerHTML = list.map(d=>{
    const isFolder=d.item_type==='folder';
    const isNote=d.item_type==='note';
    const thumb = isFolder ? '📁' : isNote ? '📝' : (d.mime_type&&d.mime_type.startsWith('image/') ? `<img src="${supaStoragePublicUrl(d.storage_path)}" loading="lazy" draggable="false"/>` : docIconFor(d.mime_type));
    const meta = isFolder ? '' : isNote ? escHtml((d.note_content||'').slice(0,40)) : humanSize(d.size_bytes);
    const dragAttrs = (!docSelectMode && isFolder) ? `ondragover="docDragOver(event)" ondragleave="docDragLeave(event)" ondrop="docDrop(event,'${d.id}')"` : '';
    const checkbox = docSelectMode ? `<div class="doc-select-box${docSelected.has(d.id)?' checked':''}">${docSelected.has(d.id)?'✓':''}</div>` : `<button class="doc-card-menu-btn" onclick="event.stopPropagation();openDocCtxMenu(event,'${d.id}')">⋮</button>`;
    return `<div class="doc-card${docSelectMode?' selectable':''}" draggable="${!docSelectMode}" data-id="${d.id}" data-type="${d.item_type}"
        onclick="docCardClick('${d.id}')" ondragstart="docDragStart(event,'${d.id}')" ondragend="docDragEnd(event)" ${dragAttrs}>
        ${checkbox}
        <div class="doc-thumb">${thumb}</div>
        <div class="doc-name">${escHtml(d.name)}</div>
        ${meta?`<div class="doc-meta">${meta}</div>`:''}
      </div>`;
  }).join('');
  if(!docSelectMode) attachDocTouchHandlers();
}
function renderDocListView(list){
  const wrap=document.getElementById('docListWrap');
  if(!list.length){
    wrap.innerHTML=`<div class="empty-st"><div class="ei">📭</div><p>${docSearchQuery?'কিছু পাওয়া যায়নি':'এই ফোল্ডার খালি — নতুন ফোল্ডার, ফাইল বা নোট যোগ করুন'}</p></div>`;
    return;
  }
  wrap.innerHTML = list.map(d=>{
    const isFolder=d.item_type==='folder';
    const isNote=d.item_type==='note';
    const icon = isFolder ? '📁' : isNote ? '📝' : (d.mime_type&&d.mime_type.startsWith('image/') ? `<img src="${supaStoragePublicUrl(d.storage_path)}" loading="lazy" draggable="false"/>` : docIconFor(d.mime_type));
    const meta = isFolder ? `${getDocs().filter(x=>x.parent_id===d.id).length} আইটেম` : isNote ? escHtml((d.note_content||'').slice(0,30)) : humanSize(d.size_bytes);
    const dragAttrs = (!docSelectMode && isFolder) ? `ondragover="docDragOver(event)" ondragleave="docDragLeave(event)" ondrop="docDrop(event,'${d.id}')"` : '';
    const checkbox = docSelectMode ? `<div class="doc-select-box${docSelected.has(d.id)?' checked':''}">${docSelected.has(d.id)?'✓':''}</div>` : '';
    const menuBtn = docSelectMode ? '' : `<button class="doc-list-menu-btn" onclick="event.stopPropagation();openDocCtxMenu(event,'${d.id}')">⋮</button>`;
    return `<div class="doc-list-row${docSelectMode?' selectable':''}" draggable="${!docSelectMode}" data-id="${d.id}" data-type="${d.item_type}"
        onclick="docCardClick('${d.id}')" ondragstart="docDragStart(event,'${d.id}')" ondragend="docDragEnd(event)" ${dragAttrs}>
        ${checkbox}
        <div class="doc-list-icon">${icon}</div>
        <div class="doc-list-name">${escHtml(d.name)}</div>
        <div class="doc-list-meta">${meta}</div>
        ${menuBtn}
      </div>`;
  }).join('');
  if(!docSelectMode) attachDocTouchHandlers();
}

function docCardClick(id){
  if(docSelectMode){ toggleDocSelection(id); return; }
  const d=getDocs().find(x=>x.id===id); if(!d) return;
  if(d.item_type==='folder') docNavigateTo(id);
  else if(d.item_type==='note') openNotePreview(id);
  else openDocPreview(id);
}

// ═══════════════════════════════════════════════════════
//  🆕 মাল্টি-সিলেক্ট + বাল্ক অ্যাকশন
// ═══════════════════════════════════════════════════════
function toggleDocSelectMode(){
  docSelectMode = !docSelectMode;
  docSelected.clear();
  renderDocs();
}
function toggleDocSelection(id){
  if(docSelected.has(id)) docSelected.delete(id); else docSelected.add(id);
  renderDocs();
}
function renderDocBulkBar(){
  const box=document.getElementById('docBulkBar');
  if(!docSelectMode || docSelected.size===0){ box.innerHTML=''; return; }
  box.innerHTML = `<div class="doc-bulk-bar">
    <span>✅ ${docSelected.size}টি নির্বাচিত</span>
    <div class="dbb-actions">
      <button class="dbb-move" onclick="bulkMoveDocsStart()">📂 মুভ করুন</button>
      <button class="dbb-copy" onclick="bulkCopyDocsStart()">📄 কপি করুন</button>
      <button class="dbb-delete" onclick="bulkDeleteDocs()">🗑️ মুছুন</button>
      <button class="dbb-cancel" onclick="docSelected.clear();renderDocs();">✕ বাতিল</button>
    </div>
  </div>`;
}
function bulkDeleteDocs(){
  const ids=[...docSelected];
  if(!ids.length) return;
  // অনুমতি যাচাই — যেকোনো একটাতেও অনুমতি না থাকলে পুরো বাল্ক-ডিলিট আটকে দেয়া হচ্ছে
  const items = ids.map(id=>getDocs().find(x=>x.id===id)).filter(Boolean);
  const noPerm = items.find(d=>!canEdit(d.dept));
  if(noPerm){ toast(`⚠️ "${noPerm.name}"-এর জন্য অনুমতি নেই`); return; }
  // প্রতিটার (ফোল্ডার হলে ভেতরের সবকিছুসহ) সম্পূর্ণ তালিকা বের করে একত্র করা হচ্ছে
  const allVictims = new Map();
  items.forEach(d=>{ collectDocDescendants(d.id).forEach(v=>allVictims.set(v.id,v)); });
  if(!confirm(`মোট ${allVictims.size}টি আইটেম (উপ-ফোল্ডার/ফাইলসহ) মুছে দেবেন?`)) return;
  const victimIds=[...allVictims.keys()];
  const storagePaths=[...allVictims.values()].filter(v=>v.storage_path).map(v=>v.storage_path);
  saveDocs(getDocs().filter(x=>!allVictims.has(x.id)));
  logAudit('docs', 'delete', `বাল্ক ডিলিট (${victimIds.length}টি আইটেম)`, items.map(i=>i.name).slice(0,5).join(', '));
  docSelected.clear(); docSelectMode=false;
  renderDocs(); toast(`🗑️ ${victimIds.length}টি আইটেম মুছে গেছে`);
  if(storagePaths.length) supaStorageRemove(storagePaths).catch(()=>{});
  if(supaOk){ victimIds.forEach(vid=>supa(CFG.TABLE_DOCS+'?id=eq.'+vid,'DELETE').catch(()=>{})); }
}
function bulkMoveDocsStart(){
  const ids=[...docSelected];
  if(!ids.length) return;
  const items = ids.map(id=>getDocs().find(x=>x.id===id)).filter(Boolean);
  const noPerm = items.find(d=>!canEdit(d.dept));
  if(noPerm){ toast(`⚠️ "${noPerm.name}"-এর জন্য অনুমতি নেই`); return; }
  document.getElementById('moveDocId').value='__bulk__';
  document.getElementById('moveDocMode').value='bulk-move';
  document.getElementById('moveDocTitle').textContent = `📂 ${ids.length}টি আইটেম মুভ করুন — গন্তব্য বেছে নিন`;
  // যেকোনো নির্বাচিত ফোল্ডারের ভেতরে/নিজের মধ্যে মুভ ঠেকাতে সবগুলো id-ই exclude করা হচ্ছে
  renderMoveDocTreeMulti(ids);
  openModal('modalMoveDoc');
}
function bulkCopyDocsStart(){
  const ids=[...docSelected];
  if(!ids.length) return;
  const items = ids.map(id=>getDocs().find(x=>x.id===id)).filter(Boolean);
  const copyable = items.filter(d=>d.item_type==='file'||d.item_type==='note'); // ফোল্ডার কপি সাপোর্ট করা হয় না
  if(!copyable.length){ toast('⚠️ কপি করার জন্য অন্তত একটা ফাইল বা নোট নির্বাচন করুন — ফোল্ডার কপি করা যায় না'); return; }
  const noPerm = copyable.find(d=>!canEdit(d.dept));
  if(noPerm){ toast(`⚠️ "${noPerm.name}"-এর জন্য অনুমতি নেই`); return; }
  document.getElementById('moveDocId').value='__bulk__';
  document.getElementById('moveDocMode').value='bulk-copy';
  const skipped = items.length - copyable.length;
  document.getElementById('moveDocTitle').textContent = `📄 ${copyable.length}টি আইটেম কপি করুন — গন্তব্য বেছে নিন${skipped?` (${skipped}টি ফোল্ডার বাদ)`:''}`;
  renderMoveDocTreeMulti(ids);
  openModal('modalMoveDoc');
}
function renderMoveDocTreeMulti(excludeIds){
  const box=document.getElementById('moveDocTree');
  const folders=getDocs().filter(d=>d.item_type==='folder' && !excludeIds.includes(d.id) && !excludeIds.some(eid=>isDocDescendant(eid,d.id)));
  let html=`<div class="doc-tree-item"><span>🏠 রুট</span><button class="doc-tree-btn" onclick="confirmBulkMove(null)">এখানে</button></div>`;
  folders.forEach(f=>{
    html+=`<div class="doc-tree-item"><span>📁 ${escHtml(docFolderPathLabel(f.id))}</span><button class="doc-tree-btn" onclick="confirmBulkMove('${f.id}')">এখানে</button></div>`;
  });
  box.innerHTML=html;
}
async function confirmBulkMove(targetFolderId){
  const ids=[...docSelected];
  const mode=document.getElementById('moveDocMode').value;
  closeModal('modalMoveDoc');
  if(mode==='bulk-copy'){
    const copyable = ids.map(id=>getDocs().find(x=>x.id===id)).filter(d=>d && (d.item_type==='file'||d.item_type==='note'));
    toast(`⏳ ${copyable.length}টি আইটেম কপি হচ্ছে...`);
    for(const f of copyable) await copyDocItem(f.id, targetFolderId);
    docSelected.clear(); docSelectMode=false;
    renderDocs(); toast(`✅ ${copyable.length}টি আইটেম কপি হয়েছে`);
  }else{
    ids.forEach(id=>moveDocItem(id, targetFolderId));
    docSelected.clear(); docSelectMode=false;
    renderDocs(); toast(`✅ ${ids.length}টি আইটেম সরানো হয়েছে`);
  }
}

// ── কনটেক্সট মেনু (⋮) ──
function openDocCtxMenu(evt, id){
  const d=getDocs().find(x=>x.id===id); if(!d) return;
  const menu=document.getElementById('docCtxMenu');
  const isFolder=d.item_type==='folder';
  const isFile=d.item_type==='file';
  const isNote=d.item_type==='note';
  let html='';
  html+=`<button class="doc-ctx-item" onclick="closeDocCtxMenu();openRenameDoc('${id}')">✏️ এডিট / রিনেম</button>`;
  html+=`<button class="doc-ctx-item" onclick="closeDocCtxMenu();openMoveDoc('${id}','move')">📂 মুভ করুন</button>`;
  if(isFile||isNote) html+=`<button class="doc-ctx-item" onclick="closeDocCtxMenu();openMoveDoc('${id}','copy')">📄 কপি করুন</button>`;
  if(isFile) html+=`<button class="doc-ctx-item" onclick="closeDocCtxMenu();window.open(supaStoragePublicUrl('${d.storage_path}'),'_blank')">⬇️ ডাউনলোড</button>`;
  html+=`<button class="doc-ctx-item" onclick="closeDocCtxMenu();openDocDetails('${id}')">ℹ️ বিস্তারিত</button>`;
  html+=`<button class="doc-ctx-item danger" onclick="closeDocCtxMenu();deleteDocItem('${id}')">🗑️ মুছুন</button>`;
  menu.innerHTML=html;
  const x = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const y = evt.touches ? evt.touches[0].clientY : evt.clientY;
  menu.style.left = Math.min(x, window.innerWidth-190)+'px';
  menu.style.top  = Math.min(y, window.innerHeight-230)+'px';
  menu.style.display='block';
  setTimeout(()=>document.addEventListener('click',closeDocCtxMenuOnce),0);
}
function closeDocCtxMenu(){ document.getElementById('docCtxMenu').style.display='none'; }
function closeDocCtxMenuOnce(){ closeDocCtxMenu(); document.removeEventListener('click',closeDocCtxMenuOnce); }

// ── নতুন ফোল্ডার ──
async function createFolder(){
  const name=document.getElementById('folderName').value.trim();
  if(!name){ toast('⚠️ ফোল্ডারের নাম দিন'); return; }
  const tags=document.getElementById('folderTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const customFields = await collectCustomFieldValues('folderCustomFields', {});
  const dept=currentUser?.reqDept||'field';
  const now=new Date().toISOString();
  const nf={id:crypto.randomUUID(),dept,parent_id:docCurrentFolder,item_type:'folder',name,tags,storage_path:null,mime_type:null,size_bytes:null,duration_seconds:null,custom_fields:customFields,created_at:now,updated_at:now};
  const docs=getDocs(); docs.push(nf); saveDocs(docs);
  logAudit('docs', 'create', name, 'ফোল্ডার তৈরি');
  closeModal('modalNewFolder');
  document.getElementById('folderName').value=''; document.getElementById('folderTags').value='';
  _cfValueCache.docs = {};
  renderCustomFieldInputs('docs','folderCustomFields',{});
  renderDocs(); toast('✅ ফোল্ডার তৈরি হয়েছে');
  if(supaOk) supa(CFG.TABLE_DOCS,'POST',nf).catch(notifyCloudSyncFail);
}

// ── আপলোড ──
function getVideoDuration(file){
  return new Promise((resolve,reject)=>{
    const v=document.createElement('video'); v.preload='metadata';
    v.onloadedmetadata=()=>{ URL.revokeObjectURL(v.src); resolve(v.duration); };
    v.onerror=()=>{ URL.revokeObjectURL(v.src); reject(new Error('video read fail')); };
    v.src=URL.createObjectURL(file);
  });
}
async function stageUploadFiles(fileList){
  _stagedFiles = Array.from(fileList);
  const box=document.getElementById('uploadFileList');
  box.innerHTML='⏳ ফাইল পরীক্ষা করা হচ্ছে...';
  const rows=[];
  for(const f of _stagedFiles){
    let warn='';
    if(f.type && f.type.startsWith('video/')){
      try{
        const dur=await getVideoDuration(f);
        f._duration=dur;
        if(dur > CFG.MAX_VIDEO_SECONDS){ warn=` ⚠️ ${Math.round(dur)}সে — ১ মিনিটের বেশি, বাদ যাবে`; f._skip=true; }
      }catch(e){ /* দৈর্ঘ্য না পেলেও আপলোড চলবে */ }
    }
    rows.push(`<div class="doc-upload-row"><span class="dur">${docIconFor(f.type)} ${escHtml(f.name)}${warn}</span><span class="sz">${humanSize(f.size)}</span></div>`);
  }
  box.innerHTML = rows.join('') || '<p style="color:var(--muted);font-size:12px;">কোনো ফাইল নির্বাচিত হয়নি</p>';
  document.getElementById('uploadTags').value='';
  _cfValueCache.docs = {};
  renderCustomFieldInputs('docs','uploadCustomFields',{});
  openModal('modalUploadStage');
}
async function startUpload(){
  const validFiles=_stagedFiles.filter(f=>!f._skip);
  if(!validFiles.length){ toast('⚠️ আপলোডযোগ্য কোনো ফাইল নেই'); return; }
  const tags=document.getElementById('uploadTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const customFields = await collectCustomFieldValues('uploadCustomFields', {});
  const dept=currentUser?.reqDept||'field';
  closeModal('modalUploadStage');
  toast(`⏳ ${validFiles.length}টি ফাইল আপলোড হচ্ছে...`);
  const docs=getDocs();
  for(const f of validFiles){
    try{
      const ext=f.name.includes('.') ? f.name.slice(f.name.lastIndexOf('.')) : '';
      const storagePath=`${dept}/${crypto.randomUUID()}${ext}`;
      await supaStorageUpload(storagePath, f);
      const now=new Date().toISOString();
      const nd={id:crypto.randomUUID(),dept,parent_id:docCurrentFolder,item_type:'file',name:f.name,tags,
        storage_path:storagePath, mime_type:f.type||'application/octet-stream', size_bytes:f.size,
        duration_seconds: f._duration?Math.round(f._duration):null, custom_fields:customFields, created_at:now, updated_at:now};
      docs.push(nd);
      logAudit('docs', 'upload', f.name, humanSize(f.size));
      if(supaOk) await supa(CFG.TABLE_DOCS,'POST',nd).catch(notifyCloudSyncFail);
    }catch(e){ toast(`❌ ${f.name} আপলোড ব্যর্থ: ${e.message}`); }
  }
  saveDocs(docs);
  document.getElementById('docFileInput').value='';
  _cfValueCache.docs = {};
  renderCustomFieldInputs('docs','uploadCustomFields',{});
  renderDocs(); toast('✅ আপলোড সম্পন্ন');
}

// ── রিনেম ──
function openRenameDoc(id){
  const d=getDocs().find(x=>x.id===id); if(!d) return;
  if(!canEdit(d.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  document.getElementById('renameDocId').value=id;
  document.getElementById('renameDocName').value=d.name;
  document.getElementById('renameDocTags').value=(d.tags||[]).join(', ');
  const noteWrap=document.getElementById('renameNoteContentWrap');
  if(d.item_type==='note'){
    noteWrap.style.display='';
    document.getElementById('renameNoteContent').value = d.note_content||'';
  }else{
    noteWrap.style.display='none';
  }
  _cfValueCache.docs = d.custom_fields || {};
  renderCustomFieldInputs('docs','renameCustomFields', d.custom_fields||{});
  openModal('modalRenameDoc');
}
async function confirmRenameDoc(){
  const id=document.getElementById('renameDocId').value;
  const docs=getDocs(); const idx=docs.findIndex(x=>x.id===id); if(idx<0) return;
  const name=document.getElementById('renameDocName').value.trim();
  if(!name){ toast('⚠️ নাম দিন'); return; }
  const tags=document.getElementById('renameDocTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const customFields = await collectCustomFieldValues('renameCustomFields', docs[idx].custom_fields||{});
  const oldName = docs[idx].name;
  const patch = {name, tags, custom_fields:customFields, updated_at:new Date().toISOString()};
  if(docs[idx].item_type==='note'){
    patch.note_content = document.getElementById('renameNoteContent').value;
  }
  docs[idx]={...docs[idx],...patch};
  saveDocs(docs);
  logAudit('docs', 'rename', name, oldName!==name ? `আগের নাম: ${oldName}` : null);
  closeModal('modalRenameDoc');
  renderDocs(); toast('✅ আপডেট হয়েছে');
  if(supaOk) supa(CFG.TABLE_DOCS+'?id=eq.'+id,'PATCH',patch).catch(notifyCloudSyncFail);
}

// ── মুভ / কপি ──
function openMoveDoc(id, mode){
  const d=getDocs().find(x=>x.id===id); if(!d) return;
  if(!canEdit(d.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  document.getElementById('moveDocId').value=id;
  document.getElementById('moveDocMode').value=mode;
  document.getElementById('moveDocTitle').textContent = mode==='copy' ? '📄 কপি করুন — গন্তব্য বেছে নিন' : '📂 মুভ করুন — গন্তব্য বেছে নিন';
  renderMoveDocTree(id, mode);
  openModal('modalMoveDoc');
}
function renderMoveDocTree(excludeId, mode){
  const box=document.getElementById('moveDocTree');
  const folders=getDocs().filter(d=>d.item_type==='folder' && (mode==='copy' || (d.id!==excludeId && !isDocDescendant(excludeId,d.id))));
  let html=`<div class="doc-tree-item"><span>🏠 রুট</span><button class="doc-tree-btn" onclick="confirmMoveDoc(null)">এখানে</button></div>`;
  folders.forEach(f=>{
    html+=`<div class="doc-tree-item"><span>📁 ${escHtml(docFolderPathLabel(f.id))}</span><button class="doc-tree-btn" onclick="confirmMoveDoc('${f.id}')">এখানে</button></div>`;
  });
  box.innerHTML=html;
}
async function confirmMoveDoc(targetFolderId){
  const id=document.getElementById('moveDocId').value;
  const mode=document.getElementById('moveDocMode').value;
  closeModal('modalMoveDoc');
  if(mode==='copy') await copyDocItem(id, targetFolderId);
  else moveDocItem(id, targetFolderId);
}
function moveDocItem(id, targetFolderId){
  if(id===targetFolderId) return;
  if(targetFolderId && isDocDescendant(id, targetFolderId)){ toast('⚠️ কোনো ফোল্ডার নিজের সাব-ফোল্ডারে সরানো যায় না'); return; }
  const docs=getDocs(); const idx=docs.findIndex(x=>x.id===id); if(idx<0) return;
  if(!canEdit(docs[idx].dept)){ toast('⚠️ অনুমতি নেই'); return; }
  if((docs[idx].parent_id||null)===(targetFolderId||null)) return;
  docs[idx]={...docs[idx],parent_id:targetFolderId,updated_at:new Date().toISOString()};
  saveDocs(docs);
  logAudit('docs', 'move', docs[idx].name, `নতুন অবস্থান: ${docFolderPathLabel(targetFolderId)||'রুট'}`);
  renderDocs(); toast('✅ সরানো হয়েছে');
  if(supaOk) supa(CFG.TABLE_DOCS+'?id=eq.'+id,'PATCH',{parent_id:targetFolderId,updated_at:docs[idx].updated_at}).catch(notifyCloudSyncFail);
}
async function copyDocItem(id, targetFolderId){
  const d=getDocs().find(x=>x.id===id); if(!d || (d.item_type!=='file' && d.item_type!=='note')) return;
  toast('⏳ কপি হচ্ছে...');
  try{
    const now=new Date().toISOString();
    let nd;
    if(d.item_type==='note'){
      // নোট — কোনো Storage অপারেশন লাগে না, শুধু ডেটা কপি
      nd={...d,id:crypto.randomUUID(),parent_id:targetFolderId,created_at:now,updated_at:now};
    }else{
      const ext=d.storage_path.includes('.') ? d.storage_path.slice(d.storage_path.lastIndexOf('.')) : '';
      const newPath=`${d.dept}/${crypto.randomUUID()}${ext}`;
      await supaStorageCopy(d.storage_path, newPath);
      nd={...d,id:crypto.randomUUID(),parent_id:targetFolderId,storage_path:newPath,created_at:now,updated_at:now};
    }
    const docs=getDocs(); docs.push(nd); saveDocs(docs);
    logAudit('docs', 'copy', nd.name, `গন্তব্য: ${docFolderPathLabel(targetFolderId)||'রুট'}`);
    renderDocs(); toast('✅ কপি হয়েছে');
    if(supaOk) supa(CFG.TABLE_DOCS,'POST',nd).catch(notifyCloudSyncFail);
  }catch(e){ toast('❌ কপি ব্যর্থ: '+e.message); }
}

// ── ডিলিট (ফোল্ডার হলে ভেতরের সব কিছুসহ) ──
function collectDocDescendants(id){
  const all=getDocs(); const result=[]; const queue=[id];
  while(queue.length){
    const cur=queue.shift();
    const node=all.find(d=>d.id===cur);
    if(node) result.push(node);
    all.filter(d=>d.parent_id===cur).forEach(c=>queue.push(c.id));
  }
  return result;
}
function deleteDocItem(id){
  const d=getDocs().find(x=>x.id===id); if(!d) return;
  if(!canEdit(d.dept)){ toast('⚠️ অনুমতি নেই'); return; }
  const victims=collectDocDescendants(id);
  const msg = d.item_type==='folder'
    ? `এই ফোল্ডার ও এর ভেতরের সব কিছু (মোট ${victims.length}টি আইটেম) মুছে দেবেন?`
    : d.item_type==='note' ? 'এই নোটটি মুছে দেবেন?' : 'এই ফাইলটি মুছে দেবেন?';
  if(!confirm(msg)) return;
  const victimIds=new Set(victims.map(v=>v.id));
  const storagePaths=victims.filter(v=>v.storage_path).map(v=>v.storage_path);
  saveDocs(getDocs().filter(x=>!victimIds.has(x.id)));
  logAudit('docs', 'delete', d.name, d.item_type==='folder' ? `ফোল্ডার (ভেতরে ${victims.length-1}টি আইটেমসহ)` : 'ফাইল');
  renderDocs(); toast('🗑️ মুছে গেছে');
  if(storagePaths.length) supaStorageRemove(storagePaths).catch(()=>{});
  if(supaOk){ victimIds.forEach(vid=>supa(CFG.TABLE_DOCS+'?id=eq.'+vid,'DELETE').catch(()=>{})); }
}

// ── ডিটেইলস ──
function openDocDetails(id){
  const d=getDocs().find(x=>x.id===id); if(!d) return;
  const box=document.getElementById('docDetailsBody');
  const typeLabel = d.item_type==='folder' ? 'ফোল্ডার' : d.item_type==='note' ? 'নোট' : (d.mime_type||'—');
  const rows=[
    ['নাম', d.name],
    ['ধরন', typeLabel],
    ['শাখা', DEPT[d.dept]?.name||d.dept],
    ['ক্যাটাগরি ট্যাগ', (d.tags||[]).join(', ')||'—'],
    ['অবস্থান', docFolderPathLabel(d.parent_id)||'রুট'],
  ];
  if(d.item_type==='file'){
    rows.push(['সাইজ', humanSize(d.size_bytes)]);
    if(d.duration_seconds) rows.push(['দৈর্ঘ্য', d.duration_seconds+' সেকেন্ড']);
  }
  rows.push(['তৈরি হয়েছে', d.created_at ? new Date(d.created_at).toLocaleString('bn-BD') : '—']);
  const cfDefs = getCustomDefs().docs || [];
  const cfRows = cfDefs.filter(def=>d.custom_fields && d.custom_fields[def.id]).map(def=>[def.label, d.custom_fields[def.id]]);
  let cfHtml = '';
  cfRows.forEach(([k,v])=>{
    if(String(v).startsWith('data:image')) cfHtml += `<div style="padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;"><span style="color:var(--muted);">${escHtml(k)}</span><br/><img src="${v}" class="cf-preview-img" style="margin-top:6px;"/></div>`;
    else cfHtml += `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;"><span style="color:var(--muted);flex-shrink:0;">${escHtml(k)}</span><span style="font-weight:600;text-align:right;word-break:break-word;">${escHtml(String(v))}</span></div>`;
  });
  const noteHtml = d.item_type==='note'
    ? `<div style="padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:13px;"><span style="color:var(--muted);">নোট</span><p style="margin-top:6px;white-space:pre-wrap;">${escHtml(d.note_content||'—')}</p></div>`
    : '';
  box.innerHTML = rows.map(([k,v])=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13px;"><span style="color:var(--muted);flex-shrink:0;">${k}</span><span style="font-weight:600;text-align:right;word-break:break-word;">${escHtml(String(v))}</span></div>`).join('')
    + noteHtml
    + cfHtml
    + (d.item_type==='file' ? `<a href="${supaStoragePublicUrl(d.storage_path)}" target="_blank" class="btn-sub" style="display:block;text-align:center;text-decoration:none;margin-top:14px;">⬇️ ডাউনলোড / নতুন ট্যাবে খুলুন</a>` : '');
  openModal('modalDocDetails');
}

// ── প্রিভিউ ──
function openDocPreview(id){
  const d=getDocs().find(x=>x.id===id); if(!d || d.item_type!=='file') return;
  document.getElementById('docPreviewTitle').textContent=d.name;
  const box=document.getElementById('docPreviewBody');
  const url=supaStoragePublicUrl(d.storage_path);
  if(d.mime_type?.startsWith('image/')) box.innerHTML=`<img src="${url}" style="max-width:100%;max-height:65vh;border-radius:8px;"/>`;
  else if(d.mime_type?.startsWith('video/')) box.innerHTML=`<video src="${url}" controls style="max-width:100%;max-height:65vh;border-radius:8px;"></video>`;
  else if(d.mime_type?.startsWith('audio/')) box.innerHTML=`<div style="font-size:48px;">🎵</div><audio src="${url}" controls style="width:100%;margin-top:10px;"></audio>`;
  else if(d.mime_type==='application/pdf') box.innerHTML=`<div style="font-size:48px;">📕</div><a href="${url}" target="_blank" class="btn-sub" style="display:block;text-align:center;text-decoration:none;margin-top:10px;">PDF নতুন ট্যাবে খুলুন</a>`;
  else box.innerHTML=`<div style="font-size:48px;">${docIconFor(d.mime_type)}</div><a href="${url}" target="_blank" class="btn-sub" style="display:block;text-align:center;text-decoration:none;margin-top:10px;">ফাইল খুলুন / ডাউনলোড</a>`;
  openModal('modalDocPreview');
}

// ═══════════════════════════════════════════════════════
//  📝 নোট — ফাইল আপলোড ছাড়াই সরাসরি টেক্সট নোট রাখার সুবিধা
// ═══════════════════════════════════════════════════════
function openNotePreview(id){
  const d=getDocs().find(x=>x.id===id); if(!d || d.item_type!=='note') return;
  document.getElementById('docPreviewTitle').textContent=d.name;
  const box=document.getElementById('docPreviewBody');
  const cfDefs = getCustomDefs().docs || [];
  const cfRows = cfDefs.filter(def=>d.custom_fields && d.custom_fields[def.id]).map(def=>[def.label, d.custom_fields[def.id]]);
  let cfHtml = cfRows.length ? '<div style="text-align:left;margin-top:14px;border-top:1px solid #F1F5F9;padding-top:10px;">' : '';
  cfRows.forEach(([k,v])=>{
    if(String(v).startsWith('data:image')) cfHtml += `<div style="padding:6px 0;font-size:12px;"><span style="color:var(--muted);">${escHtml(k)}</span><br/><img src="${v}" class="cf-preview-img" style="margin-top:4px;"/></div>`;
    else cfHtml += `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-size:12px;"><span style="color:var(--muted);">${escHtml(k)}</span><span style="font-weight:600;">${escHtml(String(v))}</span></div>`;
  });
  if(cfRows.length) cfHtml += '</div>';
  const tagsHtml = (d.tags||[]).length ? `<div style="margin-top:10px;">${d.tags.map(t=>`<span class="doc-tag-chip" style="cursor:default;">${escHtml(t)}</span>`).join(' ')}</div>` : '';
  box.innerHTML = `<div style="text-align:left;white-space:pre-wrap;font-size:14px;line-height:1.7;">${escHtml(d.note_content||'(খালি নোট)')}</div>${tagsHtml}${cfHtml}
    <button class="btn-sub" style="margin-top:16px;" onclick="closeModal('modalDocPreview');openRenameDoc('${id}')">✏️ এডিট করুন</button>`;
  openModal('modalDocPreview');
}
function openAddNote(){
  document.getElementById('noteTitle').value='';
  document.getElementById('noteContent').value='';
  document.getElementById('noteTags').value='';
  _cfValueCache.docs = {};
  renderCustomFieldInputs('docs','noteCustomFields',{});
  openModal('modalNoteEntry');
}
async function saveNote(){
  const title = document.getElementById('noteTitle').value.trim();
  if(!title){ toast('⚠️ শিরোনাম দিন'); return; }
  const content = document.getElementById('noteContent').value;
  const tags = document.getElementById('noteTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const customFields = await collectCustomFieldValues('noteCustomFields', {});
  const dept = currentUser?.reqDept||'field';
  const now = new Date().toISOString();
  const nn = {id:crypto.randomUUID(), dept, parent_id:docCurrentFolder, item_type:'note', name:title, tags,
    storage_path:null, mime_type:null, size_bytes:null, duration_seconds:null, note_content:content,
    custom_fields:customFields, created_at:now, updated_at:now};
  const docs=getDocs(); docs.push(nn); saveDocs(docs);
  logAudit('docs', 'create', title, 'নোট তৈরি');
  closeModal('modalNoteEntry');
  renderDocs(); toast('✅ নোট যোগ হয়েছে');
  if(supaOk) supa(CFG.TABLE_DOCS,'POST',nn).catch(notifyCloudSyncFail);
}

// ── ড্র্যাগ & ড্রপ (পিসি — HTML5 নেটিভ) ──
function docDragStart(evt,id){ docDragId=id; evt.dataTransfer.effectAllowed='move'; evt.dataTransfer.setData('text/plain',id); evt.currentTarget.classList.add('dragging'); }
function docDragEnd(evt){ evt.currentTarget.classList.remove('dragging'); docDragId=null; }
function docDragOver(evt){ evt.preventDefault(); evt.currentTarget.classList.add('drag-over'); }
function docDragLeave(evt){ evt.currentTarget.classList.remove('drag-over'); }
function docDrop(evt,targetFolderId){
  evt.preventDefault(); evt.currentTarget.classList.remove('drag-over');
  const id=docDragId || evt.dataTransfer.getData('text/plain');
  if(!id || id===targetFolderId) return;
  moveDocItem(id, targetFolderId);
}
function docCrumbDrop(evt,folderId){
  evt.preventDefault(); evt.currentTarget.classList.remove('drag-over');
  const id=docDragId || evt.dataTransfer.getData('text/plain');
  if(!id) return;
  moveDocItem(id, folderId);
}

// ── ড্র্যাগ & ড্রপ (মোবাইল — লম্বা-চাপ দিয়ে টাচ-ড্র্যাগ) ──
function attachDocTouchHandlers(){
  document.querySelectorAll('.doc-card, .doc-list-row').forEach(el=>{
    el.addEventListener('touchstart', docTouchStart, {passive:true});
    el.addEventListener('touchmove',  docTouchMove,  {passive:false});
    el.addEventListener('touchend',   docTouchEnd);
  });
}
function docFindDropTarget(x,y){
  const under=document.elementFromPoint(x,y);
  return under?.closest('.doc-card[data-type="folder"], .doc-list-row[data-type="folder"], .doc-crumb[data-folderid]');
}
function docTouchStart(evt){
  const el=evt.currentTarget, id=el.dataset.id, t=evt.touches[0];
  _touchState={id, el, startX:t.clientX, startY:t.clientY, longPressFired:false, moved:false};
  _touchState.timer=setTimeout(()=>{
    if(!_touchState || _touchState.moved) return;
    _touchState.longPressFired=true;
    el.classList.add('dragging');
    if(navigator.vibrate) navigator.vibrate(30);
    const ghost=document.getElementById('docDragGhost');
    const name=getDocs().find(d=>d.id===id)?.name||'';
    ghost.textContent='📦 '+name;
    ghost.style.left=(t.clientX-40)+'px'; ghost.style.top=(t.clientY-20)+'px';
    ghost.style.display='block';
  }, 350);
}
function docTouchMove(evt){
  if(!_touchState) return;
  const t=evt.touches[0];
  if(Math.abs(t.clientX-_touchState.startX)>10 || Math.abs(t.clientY-_touchState.startY)>10) _touchState.moved=true;
  if(_touchState.longPressFired){
    evt.preventDefault();
    const ghost=document.getElementById('docDragGhost');
    ghost.style.left=(t.clientX-40)+'px'; ghost.style.top=(t.clientY-20)+'px';
    document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    ghost.style.display='none';
    const dropEl=docFindDropTarget(t.clientX,t.clientY);
    ghost.style.display='block';
    if(dropEl && dropEl.dataset.id!==_touchState.id) dropEl.classList.add('drag-over');
  }
}
function docTouchEnd(evt){
  if(!_touchState) return;
  clearTimeout(_touchState.timer);
  document.getElementById('docDragGhost').style.display='none';
  if(_touchState.longPressFired){
    const t=evt.changedTouches[0];
    const dropEl=docFindDropTarget(t.clientX,t.clientY);
    document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));
    _touchState.el.classList.remove('dragging');
    if(dropEl){
      const targetId = dropEl.classList.contains('doc-crumb') ? (dropEl.dataset.folderid||null) : dropEl.dataset.id;
      if(targetId !== _touchState.id) moveDocItem(_touchState.id, targetId);
    }
  }
  _touchState=null;
}

