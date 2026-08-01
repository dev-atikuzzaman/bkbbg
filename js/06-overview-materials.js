// ═══════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════
// এই মাসে যত লেনদেন হয়েছে — লেনদেন লগ টেবিলের জন্য (কালানুক্রমিক, নতুন আগে)
function getFT(){
  return getTxns()
    .filter(t=>t.month==M&&t.year==Y&&(filterDept==='all'||t.dept===filterDept))
    .sort((a,b)=> (b.txn_date||'').localeCompare(a.txn_date||''));
}
// নির্বাচিত মাস পর্যন্ত (cumulative) প্রতিটা প্রোডাক্টের বর্তমান স্টক —
// dept + product_name অনুযায়ী গ্রুপ করে সব 'in' যোগ ও সব 'out' বিয়োগ করে বের করা হয়
function getCurrentStock(deptFilter){
  deptFilter = deptFilter===undefined ? filterDept : deptFilter;
  const upto = getTxns().filter(t=> (t.year<Y) || (t.year==Y && t.month<=M) )
                        .filter(t=> deptFilter==='all'||t.dept===deptFilter);
  const map={};
  upto.forEach(t=>{
    const key=t.dept+'||'+t.product_name;
    if(!map[key]) map[key]={dept:t.dept, product_name:t.product_name, unit:t.unit||'', qty:0, lastDate:t.txn_date};
    map[key].qty += (t.txn_type==='in' ? +t.qty : -t.qty);
    if(t.unit) map[key].unit = t.unit;
    if((t.txn_date||'') > (map[key].lastDate||'')) map[key].lastDate = t.txn_date;
  });
  return Object.values(map).sort((a,b)=> a.product_name.localeCompare(b.product_name,'bn'));
}

// ═══════════════════════════════════════════════════════
//  MAIN TAB SWITCHING (মালামাল / জনবল / কার্যক্রম)
// ═══════════════════════════════════════════════════════
function switchMainTab(tab){
  currentTab = tab;
  document.querySelectorAll('.main-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  document.getElementById('page-overview').style.display    = tab==='overview'   ? '' : 'none';
  document.getElementById('page-materials').style.display   = tab==='materials'  ? '' : 'none';
  document.getElementById('page-manpower').style.display    = tab==='manpower'   ? '' : 'none';
  document.getElementById('page-activities').style.display  = tab==='activities' ? '' : 'none';
  document.getElementById('page-docs').style.display        = tab==='docs'       ? '' : 'none';
  document.getElementById('page-finance').style.display     = tab==='finance'    ? '' : 'none';
  // বছর/মাস ফিল্টার মালামাল, ওভারভিউ, কার্যক্রম ও হিসাব ট্যাবের জন্য প্রাসঙ্গিক
  document.getElementById('controlsRow').style.display = (tab==='manpower'||tab==='docs') ? 'none' : '';
  const tabLabel = tab==='overview'?'ওভারভিউ':tab==='materials'?'মালামাল':tab==='manpower'?'জনবল':tab==='docs'?'ফাইল/ডকুমেন্টস':tab==='finance'?'হিসাব':'কার্যক্রম';
  document.getElementById('printBannerTab').textContent = tabLabel;
  document.getElementById('printBannerDate').textContent = 'তারিখ: ' + new Date().toLocaleDateString('bn-BD');
  renderCurrentTab();
}

function printCurrentTab(){
  // মোবাইল ব্রাউজারে <canvas> প্রায়ই প্রিন্টে ফাঁকা দেখায়, তাই প্রিন্টের ঠিক
  // আগে চার্টটিকে ছবিতে রূপান্তর করে #chartPrintImg-এ বসানো হচ্ছে (শুধু মালামাল ট্যাবে প্রযোজ্য)
  if(currentTab==='materials'){
    try{
      const canvas = document.getElementById('mainChart');
      const img = document.getElementById('chartPrintImg');
      if(canvas && canvas.width>0 && canvas.height>0){
        img.src = canvas.toDataURL('image/png');
      }
    }catch(e){ console.warn('চার্ট প্রিন্ট-ইমেজ তৈরি করা যায়নি:', e.message); }
  }
  window.print();
}

// ═══════════════════════════════════════════════════════
//  🆕 PDF রিপোর্ট (কোম্পানি লেটারহেডসহ)
//  html2canvas দিয়ে হিডেন টেমপ্লেটকে ছবিতে রূপান্তর করা হয় (এতে বাংলা
//  টেক্সট ব্রাউজারের নিজস্ব ফন্ট রেন্ডারিং দিয়েই আসে, jsPDF-এর আলাদা
//  ফন্ট এমবেড করার দরকার হয় না), তারপর সেই ছবিটা jsPDF দিয়ে A4
//  পেজ-বাই-পেজ কেটে PDF বানানো হয়।
// ═══════════════════════════════════════════════════════
function pdfTableHTML(headers, rows){
  const th = headers.map(h=>`<th style="background:#0B3B60;color:#fff;padding:6px 8px;font-size:10px;text-align:left;border:1px solid #0B3B60;">${escHtml(h)}</th>`).join('');
  const trs = rows.length
    ? rows.map(r=>`<tr>${r.map(c=>`<td style="padding:5px 8px;font-size:10px;border:1px solid #E2E8F0;">${c}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" style="padding:10px;font-size:10px;color:#94A3B8;text-align:center;border:1px solid #E2E8F0;">কোনো তথ্য নেই</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

function buildReportBodyHTML(type){
  const deptLabel = filterDept==='all' ? 'সকল শাখা' : (DEPT[filterDept]?.name||filterDept);
  let title='', meta='', body='';
  if(type==='materials'){
    title='📦 মালামাল লেনদেন রিপোর্ট';
    meta=`শাখা: ${deptLabel} · মাস: ${MN[M]} ${Y}`;
    const stock=getCurrentStock();
    body += `<div style="font-weight:700;font-size:13px;margin-bottom:8px;">বর্তমান স্টক সারাংশ (${MN[M]} ${Y} পর্যন্ত)</div>`;
    body += pdfTableHTML(['প্রোডাক্ট','শাখা','বর্তমান পরিমাণ','একক'],
      stock.map(s=>[escHtml(s.product_name), escHtml(DEPT[s.dept]?.name||s.dept), String(s.qty), escHtml(s.unit||'')]));
    const txns=getFT();
    body += `<div style="font-weight:700;font-size:13px;margin:16px 0 8px;">${MN[M]} ${Y} মাসের লেনদেন</div>`;
    body += pdfTableHTML(['তারিখ','প্রোডাক্ট','ধরন','পরিমাণ','বিস্তারিত'],
      txns.map(t=>[t.txn_date, escHtml(t.product_name), t.txn_type==='in'?'ইন':'আউট',
        (t.txn_type==='in'?'+':'−')+t.qty+' '+escHtml(t.unit||''),
        escHtml(t.txn_type==='in' ? (t.source||'—') : (t.purpose||'—'))]));
  } else if(type==='manpower'){
    title='👷 জনবল রিপোর্ট';
    meta=`শাখা: ${deptLabel}`;
    const all=getFM();
    const officer=all.filter(m=>m.type==='officer'), staff=all.filter(m=>m.type==='staff'), daily=all.filter(m=>m.type==='daily');
    body += `<div style="font-weight:700;font-size:13px;margin-bottom:10px;">সারাংশ — অফিসার: ${officer.length} · স্টাফ: ${staff.length} · দৈনিক শ্রমিক: ${daily.length} · মোট: ${all.length}</div>`;
    const mkRows = list => list.map(m=>[escHtml(m.name), escHtml(m.designation||'—'), escHtml(m.phone||'—'), escHtml(DEPT[m.dept]?.name||m.dept)]);
    body += `<div style="font-weight:700;font-size:13px;margin:14px 0 8px;">🎖️ অফিসার তালিকা</div>` + pdfTableHTML(['নাম','পদবী','ফোন','শাখা'], mkRows(officer));
    body += `<div style="font-weight:700;font-size:13px;margin:14px 0 8px;">🧑‍💼 স্টাফ তালিকা</div>` + pdfTableHTML(['নাম','পদবী','ফোন','শাখা'], mkRows(staff));
    body += `<div style="font-weight:700;font-size:13px;margin:14px 0 8px;">👷 দৈনিক শ্রমিক তালিকা</div>` + pdfTableHTML(['নাম','পদবী','ফোন','শাখা'], mkRows(daily));
  } else if(type==='activities'){
    title='📝 কার্যক্রম রিপোর্ট';
    meta=`শাখা: ${deptLabel} · মাস: ${MN[M]} ${Y}`;
    const acts=getFA();
    body += pdfTableHTML(['তারিখ','শাখা','বিবরণ'], acts.map(a=>[a.date, escHtml(DEPT[a.dept]?.name||a.dept), escHtml(a.description)]));
  }
  document.getElementById('pdfRepTitle').textContent = title;
  document.getElementById('pdfRepMeta').textContent  = meta;
  document.getElementById('pdfRepBody').innerHTML    = body || '<p style="color:#94A3B8;">কোনো ডেটা নেই</p>';
  document.getElementById('pdfRepGenAt').textContent = 'তৈরি: ' + new Date().toLocaleString('bn-BD') + (currentUser?.name ? ' · '+currentUser.name : '');
}

async function generatePDFReport(type){
  if(typeof html2canvas==='undefined' || typeof window.jspdf==='undefined'){
    toast('❌ PDF লাইব্রেরি লোড হয়নি — ইন্টারনেট সংযোগ চেক করুন'); return;
  }
  toast('⏳ PDF তৈরি হচ্ছে...');
  try{
    buildReportBodyHTML(type);
    const el = document.getElementById('pdfReportTemplate');
    await new Promise(r=>setTimeout(r,60)); // DOM রেন্ডার সম্পন্ন হওয়ার জন্য সামান্য বিরতি
    const canvas = await html2canvas(el, {scale:2, backgroundColor:'#ffffff', useCORS:true});
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = canvas.height * imgW / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    let heightLeft = imgH, position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while(heightLeft > 0){
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    pdf.save(`BGFCL_${type}_report_${new Date().toISOString().slice(0,10)}.pdf`);
    toast('✅ PDF ডাউনলোড হয়েছে');
  }catch(e){
    console.error(e);
    toast('❌ PDF তৈরি ব্যর্থ: '+e.message);
  }
}

// ═══════════════════════════════════════════════════════
//  🆕 Excel এক্সপোর্ট (SheetJS দিয়ে .xlsx ফাইল — বাংলা টেক্সট সরাসরি
//  সেলে বসে, PDF-এর মতো ফন্ট-এমবেডিং সমস্যা এখানে নেই)
// ═══════════════════════════════════════════════════════
function exportExcel(type){
  if(typeof XLSX==='undefined'){ toast('❌ Excel লাইব্রেরি লোড হয়নি — ইন্টারনেট সংযোগ চেক করুন'); return; }
  try{
    const wb = XLSX.utils.book_new();
    if(type==='materials'){
      const stock = getCurrentStock();
      const stockRows = stock.map(s=>({'প্রোডাক্ট':s.product_name,'শাখা':DEPT[s.dept]?.name||s.dept,'বর্তমান পরিমাণ':s.qty,'একক':s.unit||''}));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), 'বর্তমান স্টক');
      const txns = getFT();
      const txnRows = txns.map(t=>({'তারিখ':t.txn_date,'প্রোডাক্ট':t.product_name,'ধরন':t.txn_type==='in'?'ইন':'আউট','পরিমাণ':t.qty,'একক':t.unit||'','উৎস/কাজ':t.txn_type==='in'?(t.source||''):(t.purpose||''),'ওয়ার্ক অর্ডার':t.work_order||'','শাখা':DEPT[t.dept]?.name||t.dept}));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), `লেনদেন ${MN[M]} ${Y}`.slice(0,31));
    } else if(type==='manpower'){
      const all=getFM();
      const typeLabel = m => m.type==='officer'?'অফিসার':m.type==='staff'?'স্টাফ':'দৈনিক শ্রমিক';
      const rows = all.map(m=>({
        'নাম':m.name,'ধরন':typeLabel(m),'পদবী':m.designation||'','ফোন':m.phone||'','ঠিকানা':m.address||'',
        'শাখা':DEPT[m.dept]?.name||m.dept,'শেষ CL':m.cl_last_date||'','CL বাকি':m.cl_remaining??'',
        'অন্য ছুটি তারিখ':m.other_leave_last_date||'','অন্য ছুটি বাকি':m.other_leave_remaining??'',
        'AL নেয়া হয়েছে':m.al_taken==='yes'?'হ্যাঁ':'না','AL তারিখ':m.al_taken==='yes'?(m.al_date||''):'',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'জনবল');
    } else if(type==='activities'){
      const acts=getFA();
      const rows=acts.map(a=>({'তারিখ':a.date,'শাখা':DEPT[a.dept]?.name||a.dept,'বিবরণ':a.description}));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `কার্যক্রম ${MN[M]} ${Y}`.slice(0,31));
    } else if(type==='docs'){
      const docs=getDocs();
      const rows=docs.map(d=>({'নাম':d.name,'ধরন':d.item_type==='folder'?'ফোল্ডার':'ফাইল','ক্যাটাগরি ট্যাগ':(d.tags||[]).join(', '),'সাইজ (বাইট)':d.size_bytes||'','শাখা':DEPT[d.dept]?.name||d.dept,'তৈরি হয়েছে':d.created_at?new Date(d.created_at).toLocaleString('bn-BD'):''}));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ফাইল তালিকা');
    }
    XLSX.writeFile(wb, `BGFCL_${type}_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast('✅ Excel ডাউনলোড হয়েছে');
  }catch(e){
    console.error(e);
    toast('❌ Excel তৈরি ব্যর্থ: '+e.message);
  }
}

function renderCurrentTab(){
  if(currentTab==='overview')         renderOverview();
  else if(currentTab==='materials')   renderAll();
  else if(currentTab==='manpower')    renderManpower();
  else if(currentTab==='activities')  renderActivities();
  else if(currentTab==='docs')        renderDocs();
  else if(currentTab==='finance')     renderFinance();
}

// ═══════════════════════════════════════════════════════
//  🆕 ওভারভিউ ড্যাশবোর্ড (হোমপেজ) — সব ট্যাবের key metrics এক জায়গায়
// ═══════════════════════════════════════════════════════
function renderOverview(){
  const name = currentUser?.name || currentUser?.email || 'ব্যবহারকারী';
  const deptLabel = filterDept==='all' ? 'সকল শাখা' : (DEPT[filterDept]?.name||filterDept);
  document.getElementById('ovWelcomeTitle').textContent = `স্বাগতম, ${name} 👋`;
  document.getElementById('ovWelcomeSub').textContent = `${deptLabel} · ${MN[M]} ${Y} · ${new Date().toLocaleDateString('bn-BD',{weekday:'long',day:'numeric',month:'long'})}`;
  document.getElementById('sumDepts').textContent = Object.keys(DEPT).length; // ভবিষ্যতে শাখা যোগ/বাদ দিলেও সংখ্যা নিজে থেকেই সঠিক থাকবে

  // মালামাল
  const stock = getCurrentStock();
  const monthTxns = getFT();
  document.getElementById('ovProducts').textContent = stock.length;
  document.getElementById('ovIn').textContent  = monthTxns.filter(t=>t.txn_type==='in').length;
  document.getElementById('ovOut').textContent = monthTxns.filter(t=>t.txn_type==='out').length;

  // জনবল
  const fm = getFM();
  document.getElementById('ovOfficer').textContent = fm.filter(m=>m.type==='officer').length;
  document.getElementById('ovStaff').textContent    = fm.filter(m=>m.type==='staff').length;
  document.getElementById('ovDaily').textContent     = fm.filter(m=>m.type==='daily').length;

  // কার্যক্রম
  document.getElementById('ovActivities').textContent = getFA().length;

  // ফাইল/ডকুমেন্টস
  const docs=getDocs();
  document.getElementById('ovFiles').textContent   = docs.filter(d=>d.item_type==='file').length;
  document.getElementById('ovFolders').textContent = docs.filter(d=>d.item_type==='folder').length;

  // হিসাব — এই মাসের গ্যাস আয়
  const monthGasEntries = getGasEntries().filter(e=>{
    const d=new Date(e.entry_date);
    return (d.getMonth()+1)===M && d.getFullYear()===Y;
  });
  const monthGasIncome = monthGasEntries.reduce((s,e)=>s+(+e.amount_taka||0),0);
  document.getElementById('ovGasIncome').textContent = '৳'+fmtNum(monthGasIncome,0);

  // সাম্প্রতিক কার্যকলাপ (audit log থেকে, সর্বশেষ ৮টা)
  const feed=document.getElementById('ovRecentFeed');
  const recent=getAuditLog().slice(0,8);
  if(!recent.length){
    feed.innerHTML=`<div class="empty-st" style="padding:20px;"><div class="ei">🕓</div><p>এখনো কোনো কার্যকলাপ নেই</p></div>`;
  }else{
    feed.innerHTML = recent.map(l=>{
      const when = l.created_at ? new Date(l.created_at).toLocaleString('bn-BD',{dateStyle:'medium',timeStyle:'short'}) : '';
      return `<div class="ov-feed-item">
        <span>${AUDIT_ACTION_LABEL[l.action]||l.action} — <strong>${escHtml(l.record_label||'')}</strong> <span style="color:var(--muted);">(${AUDIT_MODULE_LABEL[l.module]||l.module} · ${escHtml(l.actor_name||'অজানা')})</span></span>
        <span class="ofm">${when}</span>
      </div>`;
    }).join('');
  }
}

function renderAll(){
  const stock = getCurrentStock();      // এই মাস পর্যন্ত cumulative বর্তমান স্টক (নির্বাচিত শাখা অনুযায়ী)
  const monthTxns = getFT();            // শুধু এই মাসের লেনদেন
  document.getElementById('sumTotal').textContent    = stock.length;
  document.getElementById('sumIncoming').textContent = monthTxns.filter(t=>t.txn_type==='in').length;
  document.getElementById('sumLow').textContent      = monthTxns.filter(t=>t.txn_type==='out').length;
  document.getElementById('logLabel').textContent    = `${MN[M]} ${Y}`;
  renderCards(stock);
  renderChart();
  renderTxnLog(monthTxns);
}

function renderCards(stock){
  const grid=document.getElementById('deptGrid');
  const depts=filterDept==='all'?Object.keys(DEPT):[filterDept];
  grid.innerHTML='';
  depts.forEach(dk=>{
    const cfg=DEPT[dk], di=stock.filter(i=>i.dept===dk);
    const canE=canEdit(dk);
    const card=document.createElement('div');
    card.className='dept-card';
    const more=di.length-5;
    card.innerHTML=`
      <div class="dept-hdr" style="background:${cfg.bg};">
        <div class="dept-icon" style="background:${cfg.color}20;">${cfg.icon}</div>
        <div><div class="dept-name" style="color:${cfg.color};">${cfg.name}</div><div class="dept-sub">${di.length} ধরনের প্রোডাক্ট</div></div>
      </div>
      <div class="dept-items">
        ${di.length===0
          ? `<div class="empty-st"><div class="ei">📭</div><p>এখনো কোনো স্টক নেই</p></div>`
          : `<ul class="items-list">${di.map((item,idx)=>{
              const lowQty = item.qty<=0;
              return `<li class="item-row${idx>=5?' item-extra':''}">
                <div class="item-dot" style="background:${cfg.color};"></div>
                <span class="item-name" style="cursor:pointer;" onclick="filterProduct='${escHtml(item.product_name)}';renderTxnLog();document.getElementById('logLabel').scrollIntoView({behavior:'smooth'});" title="এই প্রোডাক্টের লেনদেন ইতিহাস দেখুন">${escHtml(item.product_name)}</span>
                <span class="item-qty">${item.qty}<small style="color:#94A3B8;font-weight:400;"> ${escHtml(item.unit)||''}</small></span>
                <span class="ist ${lowQty?'ist-low':'ist-ok'}">${lowQty?'শেষ':'আছে'}</span>
              </li>`;
            }).join('')}</ul>
            ${more>0?`<button class="btn-expand" onclick="const p=this.previousElementSibling.parentElement;const exp=p.classList.toggle('expanded');this.textContent=exp?'কম দেখুন ▴':'আরও ${more}টি দেখুন ▾';">আরও ${more}টি দেখুন ▾</button>`:''}`
        }
      </div>`;
    grid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════
//  CHART
// ═══════════════════════════════════════════════════════
function renderChart(){
  const cv=document.getElementById('mainChart');
  if(typeof Chart === 'undefined'){
    console.error('Chart.js failed to load from CDN');
    if(cv && cv.parentElement){
      cv.parentElement.innerHTML = '<p style="text-align:center;padding:30px;color:#94A3B8;font-size:13px;">📊 চার্ট লোড করা যায়নি — ইন্টারনেট সংযোগ চেক করুন</p>';
    }
    return;
  }
  if(chartInst){chartInst.destroy();chartInst=null;}
  const txns=getTxns();
  const fnt={family:"'Kalpurush','Hind Siliguri'",size:11};

  if(filterChart==='bar'){
    // শাখাভিত্তিক তুলনা: বর্তমান প্রোডাক্ট-ধরন সংখ্যা + এই মাসে ইন/আউট লেনদেন সংখ্যা (সব গণনা-ভিত্তিক, একক ভিন্ন হলেও তুলনাযোগ্য)
    const depts=Object.keys(DEPT);
    const stockAll=getCurrentStock('all');
    chartInst=new Chart(cv,{type:'bar',
      data:{labels:depts.map(d=>DEPT[d].name.replace('মেইনটেন্যান্স','মেইন.')),
        datasets:[
          {label:'প্রোডাক্ট ধরন',data:depts.map(dk=>stockAll.filter(i=>i.dept===dk).length),backgroundColor:depts.map(dk=>DEPT[dk].color+'CC'),borderRadius:5,borderSkipped:false},
          {label:'এই মাসে ইন',data:depts.map(dk=>txns.filter(t=>t.dept===dk&&t.month==M&&t.year==Y&&t.txn_type==='in').length),backgroundColor:'#10B981AA',borderRadius:5,borderSkipped:false},
          {label:'এই মাসে আউট',data:depts.map(dk=>txns.filter(t=>t.dept===dk&&t.month==M&&t.year==Y&&t.txn_type==='out').length),backgroundColor:'#EF4444AA',borderRadius:5,borderSkipped:false},
        ]},
      options:{responsive:true,plugins:{legend:{position:'top',labels:{font:fnt}}},scales:{y:{beginAtZero:true,ticks:{font:fnt}},x:{ticks:{font:fnt}}}}
    });
  }else if(filterChart==='line'){
    // মাসভিত্তিক ট্রেন্ড: সারা বছরের প্রতি মাসে মোট ইন-পরিমাণ বনাম আউট-পরিমাণ (নির্বাচিত শাখা অনুযায়ী)
    const ms=Array.from({length:12},(_,i)=>i+1);
    const inData  = ms.map(m=>txns.filter(t=>t.month===m&&t.year===Y&&t.txn_type==='in' &&(filterDept==='all'||t.dept===filterDept)).reduce((s,t)=>s+ (+t.qty||0),0));
    const outData = ms.map(m=>txns.filter(t=>t.month===m&&t.year===Y&&t.txn_type==='out'&&(filterDept==='all'||t.dept===filterDept)).reduce((s,t)=>s+ (+t.qty||0),0));
    chartInst=new Chart(cv,{type:'line',
      data:{labels:MN.slice(1),datasets:[
        {label:'যুক্ত হয়েছে (ইন)',data:inData, borderColor:'#10B981',backgroundColor:'#10B98122',tension:.4,fill:true,pointRadius:3},
        {label:'ব্যবহার হয়েছে (আউট)',data:outData,borderColor:'#EF4444',backgroundColor:'#EF444422',tension:.4,fill:true,pointRadius:3},
      ]},
      options:{responsive:true,plugins:{legend:{position:'top',labels:{font:fnt}}},scales:{y:{beginAtZero:true,ticks:{font:fnt}},x:{ticks:{font:fnt}}}}
    });
  }else if(filterChart==='pie'){
    // স্টক বিতরণ: শাখা অনুযায়ী প্রোডাক্ট-ধরন সংখ্যার ভাগ
    const depts=Object.keys(DEPT);
    const stockAll=getCurrentStock('all');
    chartInst=new Chart(cv,{type:'doughnut',
      data:{labels:depts.map(dk=>DEPT[dk].name),datasets:[{data:depts.map(dk=>stockAll.filter(i=>i.dept===dk).length),backgroundColor:depts.map(dk=>DEPT[dk].color),borderWidth:2,hoverOffset:8}]},
      options:{responsive:true,cutout:'60%',plugins:{legend:{position:'right',labels:{font:fnt,padding:10}}}}
    });
  }else{
    // ইন বনাম আউট (এই মাস, নির্বাচিত শাখা) — মোট লেনদেন-সংখ্যা
    const f=getFT();
    chartInst=new Chart(cv,{type:'bar',
      data:{labels:['যুক্ত হয়েছে (ইন)','ব্যবহার হয়েছে (আউট)'],datasets:[{label:'লেনদেন সংখ্যা',data:[f.filter(t=>t.txn_type==='in').length,f.filter(t=>t.txn_type==='out').length],backgroundColor:['#10B981CC','#EF4444CC'],borderRadius:8,borderSkipped:false}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{font:fnt}},x:{ticks:{font:fnt}}}}
    });
  }
}

// ═══════════════════════════════════════════════════════
//  লেনদেন লগ (একীভূত — আগের "আনলোড লগ")
// ═══════════════════════════════════════════════════════
let filterProduct = null; // প্রোডাক্ট-নাম ধরে লগ ফিল্টার (dept card-এ ক্লিক করলে সেট হয়)

function renderTxnLog(monthTxns){
  const tb=document.getElementById('logBody');
  const filterBox=document.getElementById('logProductFilterBox');
  let list = monthTxns || getFT();
  if(filterProduct){
    list = list.filter(t=>t.product_name===filterProduct);
    filterBox.style.display='';
    document.getElementById('logProductFilterName').textContent = filterProduct;
  } else {
    filterBox.style.display='none';
  }
  tb.innerHTML='';
  if(!list.length){
    tb.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:28px;color:#94A3B8;">এই মাসে কোনো লেনদেন নেই</td></tr>`;
    return;
  }
  list.forEach(t=>{
    const cfg=DEPT[t.dept]||{color:'#64748B',name:t.dept};
    const canE=canEdit(t.dept);
    const isIn = t.txn_type==='in';
    const typeBadge = isIn
      ? `<span class="tag-dept" style="background:#D1FAE5;color:#059669;">➕ ইন</span>`
      : `<span class="tag-dept" style="background:#FEE2E2;color:#DC2626;">➖ আউট</span>`;
    const detail = isIn
      ? `উৎস: ${escHtml(t.source)||'—'}`
      : `কাজ: ${escHtml(t.purpose)||'—'}${t.work_order?` (WO: ${escHtml(t.work_order)})`:''}`;
    const imgCell = t.image_data
      ? `<img src="${t.image_data}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;cursor:pointer;" onclick="window.open(this.src,'_blank')"/>`
      : '—';
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${t.txn_date}</td><td><strong>${escHtml(t.product_name)}</strong></td>
      <td><span class="tag-dept" style="background:${cfg.color}22;color:${cfg.color};">${cfg.name}</span></td>
      <td>${typeBadge}</td>
      <td><strong>${isIn?'+':'−'}${t.qty}</strong> ${escHtml(t.unit)||''}</td>
      <td style="font-size:12px;">${detail}</td>
      <td>${imgCell}</td>
      <td>${canE?`<button class="btn-ei" onclick="openEditTxn('${t.id}')" title="সম্পাদনা">✏️</button><button class="btn-di" onclick="deleteTxn('${t.id}')" title="মুছুন">🗑️</button>`:''}</td>`;
    tb.appendChild(tr);
  });
}

