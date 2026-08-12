// ═══════════════════════════════════════════════════════
//  🆕 গ্লোবাল সার্চ — নাম দিয়ে জনবল (অফিসার/স্টাফ/দৈনিক শ্রমিক) এবং
//  মালামালের নাম দিয়ে স্টক আইটেম একসাথে খুঁজে বের করা হয়।
//  শাখা ফিল্টার উপেক্ষা করে পুরো ডেটাসেটে সার্চ চালানো হয় (গ্লোবাল)।
// ═══════════════════════════════════════════════════════

function openGlobalSearch(){
  openModal('modalGlobalSearch');
  const input = document.getElementById('globalSearchInput');
  input.value = '';
  document.getElementById('globalSearchResults').innerHTML =
    `<div class="gs-empty">🔎 নাম বা মালামালের নাম লিখে সার্চ শুরু করুন</div>`;
  setTimeout(()=>input.focus(), 150);
}

function closeGlobalSearch(){
  closeModal('modalGlobalSearch');
}

// সব দৈনিক লেনদেন থেকে (শাখা+প্রোডাক্ট অনুযায়ী গ্রুপ করে) পুরো প্রতিষ্ঠানের
// সার্বিক (all-branch, all-time cumulative) বর্তমান স্টক বের করা হয়, শাখা ফিল্টার ছাড়াই
function getGlobalStock(){
  const map={};
  getTxns().forEach(t=>{
    const key=t.dept+'||'+t.product_name;
    if(!map[key]) map[key]={dept:t.dept, product_name:t.product_name, unit:t.unit||'', qty:0};
    map[key].qty += (t.txn_type==='in' ? +t.qty : -t.qty);
    if(t.unit) map[key].unit = t.unit;
  });
  return Object.values(map);
}

const MP_TYPE_LABEL = {officer:'অফিসার', staff:'স্টাফ', daily:'দৈনিক শ্রমিক'};

function runGlobalSearch(qRaw){
  const box = document.getElementById('globalSearchResults');
  const q = (qRaw||'').trim().toLowerCase();
  if(!q){
    box.innerHTML = `<div class="gs-empty">🔎 নাম বা মালামালের নাম লিখে সার্চ শুরু করুন</div>`;
    return;
  }

  // ── মানুষ সার্চ (নাম অনুযায়ী, সব শাখা মিলিয়ে) ──
  const people = getManpower().filter(m => (m.name||'').toLowerCase().includes(q));

  // ── মালামাল সার্চ (প্রোডাক্টের নাম অনুযায়ী, সব শাখা মিলিয়ে, ডুপ্লিকেট বাদ) ──
  const stock = getGlobalStock().filter(s => (s.product_name||'').toLowerCase().includes(q));

  if(!people.length && !stock.length){
    box.innerHTML = `<div class="gs-empty">😕 "${escHtml(qRaw)}" এর সাথে মিলে এমন কিছু পাওয়া যায়নি</div>`;
    return;
  }

  let html='';

  if(people.length){
    html += `<div class="gs-sec-label">👤 জনবল (${people.length})</div>`;
    html += `<div class="profile-grid">`;
    html += people.map(m=>{
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
          <div class="pc-desig">${escHtml(m.designation)||'—'} · ${MP_TYPE_LABEL[m.type]||''}</div>
          <div class="pc-dept" style="background:${cfg.color}22;color:${cfg.color};">${escHtml(cfg.name)}</div>
          ${pfJsLabel ? `<div class="pc-row">${pfJsLabel}: ${pfJs ? escHtml(pfJs) : '—'}</div>` : ''}
          <div class="pc-row">📞 ${escHtml(m.phone)||'—'}</div>
        </div>`;
    }).join('');
    html += `</div>`;
  }

  if(stock.length){
    html += `<div class="gs-sec-label">📦 মালামাল (${stock.length})</div>`;
    html += stock.map(s=>{
      const cfg = DEPT[s.dept]||{color:'#64748B',name:s.dept,icon:'📦'};
      return `
        <div class="gs-mat-card">
          <div class="gs-mat-icon" style="background:${cfg.color}22;">${cfg.icon||'📦'}</div>
          <div>
            <div class="gs-mat-name">${escHtml(s.product_name)}</div>
            <div class="gs-mat-meta">${escHtml(cfg.name)} · বর্তমান পরিমাণ: ${s.qty} ${escHtml(s.unit||'')}</div>
          </div>
        </div>`;
    }).join('');
  }

  box.innerHTML = html;
}
