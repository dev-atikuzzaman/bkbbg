// ═══════════════════════════════════════════════════════
//  AUTH FLOW
// ═══════════════════════════════════════════════════════
function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach((t,i)=>{
    t.classList.toggle('active', ['login','signup','viewer'][i]===tab);
  });
  document.getElementById('loginForm').style.display   = tab==='login'   ? '' : 'none';
  document.getElementById('signupForm').style.display  = tab==='signup'  ? '' : 'none';
  document.getElementById('viewerForm').style.display  = tab==='viewer'  ? '' : 'none';
  document.getElementById('pendingForm').style.display = 'none';
}

async function doLogin(){
  const email = document.getElementById('liEmail').value.trim();
  const pass  = document.getElementById('liPass').value;
  if(!email||!pass){ toast('⚠️ ইমেইল ও পাসওয়ার্ড দিন'); return; }
  showLoader('লগইন হচ্ছে...');
  try{
    if(!CFG.URL){
      // Supabase কনফিগার করা না থাকলে কোনো হার্ডকোড করা পাসওয়ার্ড/ব্যাকডোর
      // দিয়ে লগইন করা যাবে না — নিরাপত্তার জন্য এখানে থেমে যাওয়া হয়
      toast('⚠️ Supabase সংযুক্ত নেই — লগইন সম্ভব নয়।'); hideLoader(); return;
    }
    const d = await supaAuth('token?grant_type=password', email, pass);
    persistSupaSession(d);
    // Load profile
    const prof = await supa(CFG.TABLE_PROF+'?email=eq.'+encodeURIComponent(email)+'&limit=1');
    const p = prof && prof[0];
    // সুপার অ্যাডমিনের ইমেইল ম্যাচ করলে প্রোফাইল টেবিলের অবস্থা যাই থাকুক
    // (pending/admin/অনুপস্থিত) — সবসময় super হিসেবেই ঢুকবে, যাতে কোনোভাবে
    // প্রোফাইল টেবিলের একটা ভুল/পুরনো row-এর কারণে আসল super admin লক
    // আউট হয়ে না যায়
    if(email===CFG.SUPER_ADMIN_EMAIL){
      setCurrentUser({id:p?.id||'super',email,role:'super',name:'সুপার অ্যাডমিন',dept:'all',reqDept:'all'});
    } else if(p){
      if(p.status==='pending'){
        hideLoader();
        setCurrentUser({id:p.id,email,role:'pending',name:p.name,dept:p.dept,reqDept:p.req_dept});
        showPendingScreen(p);
        return;
      }
      setCurrentUser({id:p.id,email,role:p.role,name:p.name,dept:p.dept,reqDept:p.req_dept});
    } else {
      setCurrentUser({id:'u',email,role:'viewer',name:email,dept:'',reqDept:''});
    }
    hideLoader();
    enterApp();
  }catch(e){
    hideLoader();
    toast('❌ লগইন ব্যর্থ: '+(e.message||'ভুল তথ্য'));
  }
}

async function doSignup(){
  const name    = document.getElementById('suName').value.trim();
  const desig   = document.getElementById('suDesig').value.trim();
  const dept    = document.getElementById('suDept').value;
  const reqDept = document.getElementById('suReqDept').value;
  const email   = document.getElementById('suEmail').value.trim();
  const pass    = document.getElementById('suPass').value;
  const pass2   = document.getElementById('suPass2').value;
  if(!name||!desig||!dept||!reqDept||!email||!pass){ toast('⚠️ সব তথ্য পূরণ করুন'); return; }
  if(pass!==pass2){ toast('⚠️ পাসওয়ার্ড দুটো মিলছে না'); return; }
  if(pass.length<6){ toast('⚠️ পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে'); return; }

  showLoader('অ্যাকাউন্ট তৈরি হচ্ছে...');
  try{
    const d = await supaAuth('signup', email, pass);
    const uid = d?.user?.id || d?.id;
    if(!uid){ throw new Error('ব্যবহারকারী তৈরি হয়নি — সার্ভার থেকে সঠিক তথ্য আসেনি'); }
    // Supabase returns HTTP 200 with a fake user (empty identities[]) instead of an
    // error when the email is already registered, to prevent user enumeration.
    if(Array.isArray(d?.user?.identities) && d.user.identities.length===0){
      throw new Error('already registered');
    }
    if(d?.session){ persistSupaSession(d.session); }

    try{
      await supa(CFG.TABLE_PROF,'POST',{
        id: uid, email, name, designation:desig,
        dept, req_dept:reqDept,
        role:'pending', status:'pending',
        created_at: new Date().toISOString(),
      });
    }catch(profErr){
      if(!/duplicate|already exists|23505/i.test(profErr.message||'')){
        throw new Error('প্রোফাইল সংরক্ষণ ব্যর্থ: '+(profErr.message||'অজানা কারণ'));
      }
    }

    notifySuperAdmin(name, desig, DEPT[reqDept]?.name||reqDept, email);
    hideLoader();
    setCurrentUser({id:uid,email,role:'pending',name,dept,reqDept});
    showPendingScreen({name,req_dept:reqDept});
    toast('✅ সাইন-আপ সফল! ইমেইল ভেরিফাই করুন।');
  }catch(e){
    hideLoader();
    const msg = e?.message || '';
    if(/already registered|user already exists/i.test(msg)){
      toast('⚠️ এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে — লগইন করুন');
    } else if(/no_config/i.test(msg)){
      toast('⚠️ Supabase কনফিগার করা হয়নি');
    } else {
      toast('❌ সাইন-আপ ব্যর্থ: '+(msg||'অজানা ত্রুটি — কনসোল চেক করুন'));
    }
    console.error('Signup error:', e);
  }
}

function notifySuperAdmin(name, desig, deptName, email){
  // Open mailto as fallback notification
  const sub = encodeURIComponent(`[BGFCL Inventory] নতুন অ্যাডমিন অনুরোধ - ${name}`);
  const body = encodeURIComponent(
    `নাম: ${name}\nপদবী: ${desig}\nইমেইল: ${email}\nঅনুরোধকৃত শাখা: ${deptName}\n\n` +
    `অনুগ্রহ করে অ্যাপে লগইন করে Pending Approvals থেকে অনুমোদন করুন।`
  );
  window.open(`mailto:${CFG.SUPER_ADMIN_EMAIL}?subject=${sub}&body=${body}`,'_blank');
}

function showPendingScreen(p){
  document.getElementById('authTabs').style.display='none';
  ['loginForm','signupForm','viewerForm'].forEach(id=>document.getElementById(id).style.display='none');
  const pf = document.getElementById('pendingForm');
  pf.style.display='';
  document.getElementById('pendingMsg').textContent=
    `${p.name} — ${DEPT[p.req_dept]?.name||p.req_dept} শাখার অ্যাডমিন অনুরোধ পাঠানো হয়েছে। সুপার অ্যাডমিন (${CFG.SUPER_ADMIN_EMAIL}) অনুমোদন করলে আপনি ইমেইলে জানবেন।`;
}

function doResetPass(){
  const email = document.getElementById('liEmail').value.trim();
  if(!email){ toast('⚠️ ইমেইল দিন'); return; }
  if(!CFG.URL){ toast('⚠️ Supabase সংযুক্ত নেই'); return; }
  fetch(CFG.URL+'/auth/v1/recover',{
    method:'POST',
    headers:{'apikey':CFG.KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email})
  }).then(()=>toast('✅ রিসেট লিংক পাঠানো হয়েছে ইমেইলে'));
}

function enterAsViewer(){
  setCurrentUser({id:'viewer',email:'',role:'viewer',name:'ভিউয়ার',dept:'',reqDept:''});
  enterApp();
}

function setCurrentUser(u){
  currentUser = u;
  localStorage.setItem('bgfcl_user', JSON.stringify(u));
  if(window.Sentry && u?.email) window.Sentry.setUser({email:u.email});
}

function enterApp(){
  // Show the shell FIRST, unconditionally — nothing after this point can blank the screen
  document.getElementById('authScreen').style.display='none';
  document.getElementById('appShell').style.display='block';

  try{ updateUserChip(); }catch(e){ console.error('updateUserChip failed:',e); }
  try{ updateActionBar(); }catch(e){ console.error('updateActionBar failed:',e); }
  try{ switchMainTab('overview'); }catch(e){ console.error('switchMainTab failed:',e); toast('⚠️ ডেটা লোডে সমস্যা হয়েছে'); }

  // 🆕 একদম প্রথমবার (এই ডিভাইসে আগে কোনো ডেটা ক্যাশ হয়নি) হলে, ক্লাউড
  // থেকে আসল ডেটা না আসা পর্যন্ত নমুনা/ফাঁকা ডেটার বদলে স্কেলিটন
  // দেখানো হচ্ছে — flash of fake/empty content এড়াতে
  const isFreshDevice = !localStorage.getItem('bgfcl_txns');
  if(isFreshDevice){ showSkeleton(); setTimeout(hideSkeleton, 6000); } // ৬ সেকেন্ড নিরাপত্তা-জাল

  try{
    checkSupaConn().then(ok=>{
      supaOk=ok;
      if(ok){
        fetchFromCloud().then(hideSkeleton).catch(e=>{ console.error('fetchFromCloud failed:',e); hideSkeleton(); });
        initRealtime();
      }
      else { hideSkeleton(); toast('⚠️ ক্লাউড সিঙ্ক ব্যর্থ: '+(lastSupaError||'কারণ জানা যায়নি')+' (badge-এ ট্যাপ করুন)'); }
    }).catch(()=>{ supaOk=false; hideSkeleton(); });
  }catch(e){ console.error('checkSupaConn call failed:',e); hideSkeleton(); }

  try{
    if(currentUser?.role==='super') loadPendingApprovals();
  }catch(e){ console.error('loadPendingApprovals failed:',e); }

  // 🆕 নতুন ব্যবহারকারীর জন্য একবার অনবোর্ডিং টিউটোরিয়াল দেখানো
  try{
    if(!localStorage.getItem('bgfcl_onboarded')) setTimeout(startOnboarding, 700);
  }catch(e){}
}
function showSkeleton(){ const el=document.getElementById('skeletonOverlay'); if(el) el.style.display='block'; }
function hideSkeleton(){ const el=document.getElementById('skeletonOverlay'); if(el) el.style.display='none'; }

// ═══════════════════════════════════════════════════════
//  🆕 অনবোর্ডিং / টিউটোরিয়াল — নতুন ব্যবহারকারীর জন্য সংক্ষিপ্ত পরিচিতি
// ═══════════════════════════════════════════════════════
const ONBOARDING_SLIDES = [
  {icon:'👋', title:'স্বাগতম BGFCL ডিজিটাল স্টক ইনভেন্টরিতে', body:'বাখরাবাদ গ্যাস ফিল্ডের মালামাল, জনবল, কার্যক্রম ও ফাইল — সব একসাথে ম্যানেজ করার জন্য এই অ্যাপ। ছোট্ট একটা পরিচিতি দেখে নিন — মাত্র কয়েক সেকেন্ড লাগবে।'},
  {icon:'🏠', title:'ওভারভিউ ড্যাশবোর্ড', body:'অ্যাপ খুললেই প্রথমে এই হোমপেজ দেখবেন — সব ট্যাবের গুরুত্বপূর্ণ সংখ্যা ও সাম্প্রতিক কার্যকলাপ একনজরে। যেকোনো কার্ডে ট্যাপ করলে সরাসরি সেই ট্যাবে চলে যাবেন।'},
  {icon:'📦', title:'মালামাল', body:'প্রতিটা লেনদেন "ইন" (যুক্ত হলো) বা "আউট" (ব্যবহার হলো) হিসেবে যোগ করুন — বর্তমান স্টক নিজে থেকেই হিসাব হয়ে যাবে। ছবি, উৎস, ওয়ার্ক অর্ডার নং — সব যোগ করা যায়।'},
  {icon:'👷', title:'জনবল', body:'অফিসার, স্টাফ ও দৈনিক শ্রমিক — তিন ক্যাটাগরিতে জনবলের তথ্য রাখুন, ছুটির হিসাব ট্র্যাক করুন, আর দৈনিক শ্রমিকদের উপস্থিতিও নিতে পারবেন।'},
  {icon:'📁', title:'ফাইল/ডকুমেন্টস', body:'যেকোনো ফাইল আপলোড করুন, ফোল্ডারে গুছিয়ে রাখুন। ফোনে আঙুল দিয়ে চেপে ধরে টেনে অন্য ফোল্ডারে নেয়া যায়, পিসিতে ড্র্যাগ-ড্রপ করা যায়।'},
  {icon:'📊', title:'রিপোর্ট ও নিরাপত্তা', body:'যেকোনো ট্যাব থেকে PDF বা Excel রিপোর্ট বানাতে পারবেন। প্রতিটা পরিবর্তনের ইতিহাস "কার্যকলাপ লগ"-এ থাকে, আর প্রতিদিন রাতে স্বয়ংক্রিয় ব্যাকআপও হয়। শুরু করুন! ✅'},
];
let obIndex = 0;
function startOnboarding(){
  obIndex = 0;
  renderOnboardingSlide();
  openModal('modalOnboarding');
}
function renderOnboardingSlide(){
  const s = ONBOARDING_SLIDES[obIndex];
  document.getElementById('obStepLabel').textContent = `পরিচিতি (${obIndex+1}/${ONBOARDING_SLIDES.length})`;
  document.getElementById('obIcon').textContent = s.icon;
  document.getElementById('obTitle').textContent = s.title;
  document.getElementById('obBody').textContent = s.body;
  document.getElementById('obDots').innerHTML = ONBOARDING_SLIDES.map((_,i)=>`<div class="ob-dot${i===obIndex?' active':''}"></div>`).join('');
  document.getElementById('obPrevBtn').style.visibility = obIndex===0 ? 'hidden' : 'visible';
  document.getElementById('obNextBtn').textContent = obIndex===ONBOARDING_SLIDES.length-1 ? '✅ শুরু করুন' : 'পরবর্তী →';
}
function onboardingNext(){
  if(obIndex < ONBOARDING_SLIDES.length-1){ obIndex++; renderOnboardingSlide(); }
  else finishOnboarding();
}
function onboardingPrev(){
  if(obIndex>0){ obIndex--; renderOnboardingSlide(); }
}
function finishOnboarding(){
  localStorage.setItem('bgfcl_onboarded','1');
  closeModal('modalOnboarding');
}

// ═══════════════════════════════════════════════════════
//  🆕 ফন্ট ও ডিসপ্লে সেটিংস (ফন্ট বাছাই/আপলোড, ফন্ট সাইজ, পেজ জুম)
// ═══════════════════════════════════════════════════════
const FONT_PRESETS = {
  default:       "'Hind Siliguri', sans-serif",
  siyamrupali:   "'Siyam Rupali', 'Hind Siliguri', sans-serif",
  nikoshban:     "'NikoshBan', 'Hind Siliguri', sans-serif",
  timesnewroman: "'Times New Roman', Times, serif",
  custom:        "'UserCustomFont', 'Hind Siliguri', sans-serif",
};

function applyFontPreset(choice){
  document.documentElement.style.setProperty('--f', FONT_PRESETS[choice] || FONT_PRESETS.default);
  localStorage.setItem('bgfcl_font_choice', choice);
  const sel=document.getElementById('fontPresetSelect'); if(sel) sel.value=choice;
}

async function handleFontUpload(event){
  const file = event.target.files[0];
  if(!file) return;
  if(!/\.(ttf|otf|woff2?)$/i.test(file.name)){ toast('⚠️ শুধু .ttf/.otf/.woff/.woff2 ফাইল আপলোড করা যাবে'); event.target.value=''; return; }
  if(file.size > 3*1024*1024){ toast('⚠️ ফন্ট ফাইল ৩ MB-এর বেশি না রাখাই ভালো — লোড ধীর হয়ে যাবে'); event.target.value=''; return; }
  try{
    const buf = await file.arrayBuffer();
    const fontFace = new FontFace('UserCustomFont', buf);
    await fontFace.load();
    document.fonts.add(fontFace);
    const base64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
    localStorage.setItem('bgfcl_custom_font', base64);
    localStorage.setItem('bgfcl_custom_font_name', file.name);
    document.getElementById('customFontOption').style.display='';
    document.getElementById('customFontStatus').textContent = `✅ ইনস্টল করা আছে: ${file.name}`;
    applyFontPreset('custom');
    toast('✅ ফন্ট আপলোড ও চালু হয়েছে');
  }catch(e){
    console.error('font upload failed:', e);
    toast('❌ ফন্ট লোড করা যায়নি — ফাইলটা ঠিক আছে কিনা দেখুন');
  }
}

async function loadSavedCustomFont(){
  const saved = localStorage.getItem('bgfcl_custom_font');
  if(!saved) return false;
  try{
    const fontFace = new FontFace('UserCustomFont', saved);
    await fontFace.load();
    document.fonts.add(fontFace);
    return true;
  }catch(e){ console.warn('সংরক্ষিত কাস্টম ফন্ট লোড করা যায়নি:', e); return false; }
}

// main, #appShell-এর ভেতরেই নেস্টেড — তাই zoom সরাসরি বসালে দুইটা
// মান গুণ হয়ে যেত (compounding)। এখানে main-এর zoom সবসময় দুইটা
// সংরক্ষিত মান থেকে হিসাব করে বসানো হয়, যাতে "ফন্ট সাইজ" স্লাইডার
// সবসময় ঠিক তার নিজের মান অনুযায়ীই কাজ করে, "পেজ জুম" যা-ই থাকুক না কেন।
function recalcMainZoom(){
  const fontSizePct = +(localStorage.getItem('bgfcl_font_size')||100);
  const pageZoomPct = +(localStorage.getItem('bgfcl_page_zoom')||100);
  const m=document.querySelector('main');
  if(m) m.style.zoom = (fontSizePct/pageZoomPct*100)+'%';
}
function applyFontSize(val){
  localStorage.setItem('bgfcl_font_size', val);
  const lbl=document.getElementById('fontSizeLabel'); if(lbl) lbl.textContent = val+'%';
  recalcMainZoom();
}
function applyPageZoom(val){
  // body-তে জুম বসানো হচ্ছে (শুধু #appShell-এ নয়) — কারণ মোডালগুলো
  // (.mo) DOM-এ #appShell-এর sibling, appShell-এর ভেতরের এলিমেন্ট না;
  // body-লেভেলে বসালে মোডাল-ডায়ালগও পেজ জুমের সাথে মিলিয়ে স্কেল হবে
  document.body.style.zoom = val+'%';
  const lbl=document.getElementById('pageZoomLabel'); if(lbl) lbl.textContent = val+'%';
  localStorage.setItem('bgfcl_page_zoom', val);
  recalcMainZoom(); // পেজ জুম বদলালেও মূল কনটেন্টের effective ফন্ট-সাইজ যেন অপরিবর্তিত থাকে
}
function resetDisplaySettings(){
  applyFontPreset('default');
  document.getElementById('fontSizeSlider').value=100; applyFontSize(100);
  document.getElementById('pageZoomSlider').value=100; applyPageZoom(100);
  toast('↺ ডিফল্ট সেটিংসে ফিরে গেছে');
}
function openDisplaySettings(){
  document.getElementById('fontPresetSelect').value = localStorage.getItem('bgfcl_font_choice')||'default';
  const fsz = localStorage.getItem('bgfcl_font_size')||'100';
  document.getElementById('fontSizeSlider').value = fsz;
  document.getElementById('fontSizeLabel').textContent = fsz+'%';
  const pz = localStorage.getItem('bgfcl_page_zoom')||'100';
  document.getElementById('pageZoomSlider').value = pz;
  document.getElementById('pageZoomLabel').textContent = pz+'%';
  const customName = localStorage.getItem('bgfcl_custom_font_name');
  if(customName){
    document.getElementById('customFontOption').style.display='';
    document.getElementById('customFontStatus').textContent = `✅ ইনস্টল করা আছে: ${customName}`;
  }
  openModal('modalDisplaySettings');
}
// অ্যাপ চালু হওয়ার সময় সংরক্ষিত পছন্দ প্রয়োগ করা হয় (initApp থেকে ডাকা হয়)
async function initDisplayPrefs(){
  const savedFont = localStorage.getItem('bgfcl_font_choice');
  if(savedFont==='custom'){
    const ok = await loadSavedCustomFont();
    applyFontPreset(ok ? 'custom' : 'default');
  } else if(savedFont){
    applyFontPreset(savedFont);
  }
  const fsz = localStorage.getItem('bgfcl_font_size');
  if(fsz) applyFontSize(fsz);
  const pz = localStorage.getItem('bgfcl_page_zoom');
  if(pz) applyPageZoom(pz);
}

function backToLogin(){
  if(!confirm('লগইন স্ক্রিনে ফিরে যাবেন?')) return;
  doLogout();
}

function restoreSession(){
  const saved = localStorage.getItem('bgfcl_user');
  if(saved){
    try{
      const parsed = JSON.parse(saved);
      if(parsed && parsed.id){
        currentUser = parsed;
        if(CFG.URL){
          try{ supaSession = JSON.parse(localStorage.getItem('supa_session')||'null'); }catch(e){ supaSession=null; }
          // পুরনো (এক্সপায়ার্ড) টোকেন নিয়ে ফিরে এলে ব্যাকগ্রাউন্ডে রিফ্রেশ চেষ্টা করা হয়,
          // যাতে প্রথম লেখা/এডিট রিকোয়েস্ট আসার আগেই টোকেন সতেজ থাকে
          if(supaSession) refreshSupaSession().catch(()=>{});
        }
        enterApp();
        return;
      }
    }catch(e){
      console.warn('Session restore failed, clearing corrupt session', e);
      localStorage.removeItem('bgfcl_user');
    }
  }
  document.getElementById('appShell').style.display='none';
  document.getElementById('authScreen').style.display='flex';
}

