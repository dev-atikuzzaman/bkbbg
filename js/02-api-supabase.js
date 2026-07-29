// ═══════════════════════════════════════════════════════
//  SUPABASE HELPERS
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
//  🛡️ SUPABASE PAYLOAD SANITIZER
//  HTML <input type="date"> খালি থাকলে .value = '' (empty string) হয়,
//  কখনো null হয় না। কিন্তু Postgres-এর nullable "date" (বা numeric/uuid)
//  কলামে '' পাঠালে "invalid input syntax for type date: ''" এররে
//  ইনসার্ট/আপডেট পুরোটাই ব্যর্থ হয়ে যায় — null হলে কোনো সমস্যা নেই।
//  এখানে top-level-এর প্রতিটা key-তে '' পেলে তা null-এ বদলে দেয়া হয়,
//  যাতে ভবিষ্যতে কোনো নতুন ফর্ম/ফিল্ডেও এই বাগ আর ফিরে আসতে না পারে।
//  (customFields-এর মতো নেস্টেড অবজেক্ট/jsonb-এর ভেতরে হাত দেয়া হয় না,
//  যাতে ব্যবহারকারীর নিজের কাস্টম টেক্সট মান অপরিবর্তিত থাকে।)
// ═══════════════════════════════════════════════════════
function sanitizeForSupabase(body){
  if(body===null || typeof body!=='object' || Array.isArray(body)) return body;
  const out={};
  for(const k in body){
    const v=body[k];
    out[k] = (v==='') ? null : v;
  }
  return out;
}

async function supa(path, method='GET', body=null, token=null, _retried=false){
  if(!CFG.URL) throw new Error('no_config');
  body = sanitizeForSupabase(body);

  // সেশনের মেয়াদ শেষ হওয়ার কাছাকাছি হলে রিকোয়েস্ট পাঠানোর আগেই রিফ্রেশ করে নেয়া হয়,
  // যাতে "সুপার অ্যাডমিন রিফ্রেশ দিলেই এডিট/অনুমোদন কাজ করা বন্ধ হয়ে যায়" জাতীয় বাগ না হয়
  if(supaSession && !token) await ensureFreshSession();
  const h = {
    'apikey': CFG.KEY,
    'Authorization': 'Bearer '+(token || supaSession?.access_token || CFG.KEY),
    'Content-Type': 'application/json',
  };
  if(method==='GET') h['Prefer']='return=representation';
  if(method==='POST') h['Prefer']='return=representation';
  if(method==='PATCH') h['Prefer']='return=representation';
  let r;
  try{
    r = await fetch(CFG.URL+'/rest/v1/'+path, {method, headers:h, body:body?JSON.stringify(body):null});
  }catch(netErr){
    throw new Error('ইন্টারনেট সংযোগ সমস্যা — নেটওয়ার্ক চেক করুন');
  }
  // 401 মানে টোকেন এক্সপায়ার্ড/অবৈধ — একবার রিফ্রেশ করে আবার চেষ্টা করা হয়
  if(r.status===401 && !token && supaSession?.refresh_token && !_retried){
    const refreshed = await refreshSupaSession();
    if(refreshed) return supa(path, method, body, token, true);
  }
  if(!r.ok){
    const t = await r.text();
    let friendly = t;
    try{
      const j = JSON.parse(t);
      if(j.message && /does not exist/i.test(j.message)){
        friendly = `ডাটাবেজ টেবিল পাওয়া যায়নি (${j.message}). Supabase এ SQL Setup স্ক্রিপ্ট রান করা হয়েছে কিনা যাচাই করুন।`;
      } else {
        friendly = j.message || j.msg || j.hint || t;
      }
    }catch(parseErr){ /* not JSON, keep raw text */ }
    throw new Error(friendly);
  }
  if(method==='DELETE') return true;
  const txt = await r.text();
  if(!txt) return true;
  try{ return JSON.parse(txt); }
  catch(parseErr){ return true; }
}

// ═══════════════════════════════════════════════════════
//  🆕 SUPABASE STORAGE (ফাইল/ডকুমেন্টস ট্যাবের আসল ফাইল-বাইট এখানে জমা হয়)
//  bucket পাবলিক, তাই দেখা/ডাউনলোডের জন্য টোকেন লাগে না — শুধু
//  আপলোড/মুছা/কপির জন্য লগইন-করা ইউজারের টোকেন দরকার।
// ═══════════════════════════════════════════════════════
async function supaStorageUpload(path, file){
  if(supaSession) await ensureFreshSession();
  const h = {
    'apikey': CFG.KEY,
    'Authorization': 'Bearer '+(supaSession?.access_token || CFG.KEY),
    'Content-Type': file.type || 'application/octet-stream',
    'x-upsert': 'true',
  };
  let r;
  try{
    r = await fetch(`${CFG.URL}/storage/v1/object/${CFG.STORAGE_BUCKET}/${encodeURIComponent(path)}`, {method:'POST', headers:h, body:file});
  }catch(netErr){ throw new Error('ইন্টারনেট সংযোগ সমস্যা — আপলোড ব্যর্থ'); }
  if(!r.ok){
    const t=await r.text();
    let msg=t; try{ msg=JSON.parse(t).message||t; }catch{}
    throw new Error(msg);
  }
  return true;
}
function supaStoragePublicUrl(path){
  return `${CFG.URL}/storage/v1/object/public/${CFG.STORAGE_BUCKET}/${encodeURIComponent(path)}`;
}
async function supaStorageRemove(paths){ // paths: array of storage_path
  if(!paths.length) return true;
  if(supaSession) await ensureFreshSession();
  const h = {'apikey':CFG.KEY,'Authorization':'Bearer '+(supaSession?.access_token||CFG.KEY),'Content-Type':'application/json'};
  const r = await fetch(`${CFG.URL}/storage/v1/object/${CFG.STORAGE_BUCKET}`, {method:'DELETE', headers:h, body:JSON.stringify({prefixes:paths})});
  if(!r.ok){ const t=await r.text(); throw new Error(t); }
  return true;
}
async function supaStorageCopy(fromPath, toPath){
  if(supaSession) await ensureFreshSession();
  const h = {'apikey':CFG.KEY,'Authorization':'Bearer '+(supaSession?.access_token||CFG.KEY),'Content-Type':'application/json'};
  const r = await fetch(`${CFG.URL}/storage/v1/object/copy`, {method:'POST', headers:h, body:JSON.stringify({bucketId:CFG.STORAGE_BUCKET, sourceKey:fromPath, destinationKey:toPath})});
  if(!r.ok){ const t=await r.text(); throw new Error(t); }
  return true;
}

// ═══════════════════════════════════════════════════════
//  SESSION PERSISTENCE + REFRESH
//  (আগে supaSession শুধু মেমোরিতে থাকতো, localStorage-এ সেভ হতো
//   না — ফলে পেজ রিলোড করলেই এটা null হয়ে যেত, আর তখন সব
//   authenticated রিকোয়েস্ট (super admin approve/reject, dept-wise
//   insert/update/delete) নীরবে anon key দিয়ে পাঠানো শুরু করতো, যা
//   RLS পলিসিতে আটকে যায়। এখানে সেশন সেভ + এক্সপায়ারিতে অটো-রিফ্রেশ
//   দুটোই যোগ করা হলো)
// ═══════════════════════════════════════════════════════
function persistSupaSession(session){
  supaSession = session;
  if(session) localStorage.setItem('supa_session', JSON.stringify(session));
  else localStorage.removeItem('supa_session');
}

async function ensureFreshSession(){
  if(!supaSession?.expires_at) return; // পুরোনো ফরম্যাটের সেশন হলে স্কিপ
  const nowSec = Math.floor(Date.now()/1000);
  if(supaSession.expires_at - nowSec < 60){ // ৬০ সেকেন্ডের কম বাকি থাকলে আগেই রিফ্রেশ
    await refreshSupaSession();
  }
}

async function refreshSupaSession(){
  if(!supaSession?.refresh_token || !CFG.URL) return false;
  try{
    const r = await fetch(CFG.URL+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{'apikey':CFG.KEY,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token: supaSession.refresh_token}),
    });
    if(!r.ok){
      // refresh token নিজেই অকেজো হয়ে গেলে সেশন মুছে ফেলা হয়, ব্যবহারকারীকে
      // আবার লগইন করতে হবে — কিন্তু currentUser/UI অপরিবর্তিত থাকবে যতক্ষণ
      // না তারা কিছু লিখতে/এডিট করতে যায়
      persistSupaSession(null);
      return false;
    }
    const d = await r.json();
    persistSupaSession(d);
    return true;
  }catch(e){ return false; }
}

// Auth via Supabase Auth REST
async function supaAuth(action, email, password){
  if(!CFG.URL) throw new Error('no_config');
  const url = CFG.URL+'/auth/v1/'+action;
  let r;
  try{
    r = await fetch(url,{
      method:'POST',
      headers:{'apikey':CFG.KEY,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),
    });
  }catch(netErr){
    throw new Error('ইন্টারনেট সংযোগ সমস্যা — আবার চেষ্টা করুন');
  }
  const raw = await r.text();
  let d = {};
  try{ d = raw ? JSON.parse(raw) : {}; }
  catch(parseErr){ throw new Error('সার্ভার থেকে অপ্রত্যাশিত উত্তর এসেছে (status '+r.status+')'); }
  if(!r.ok) throw new Error(d.error_description || d.msg || d.message || 'Auth error (status '+r.status+')');
  return d;
}

async function supaAuthGet(path){
  if(!CFG.URL || !supaSession) return null;
  try{
    const r = await fetch(CFG.URL+'/auth/v1/'+path,{
      headers:{'apikey':CFG.KEY,'Authorization':'Bearer '+supaSession.access_token}
    });
    if(!r.ok) return null;
    const raw = await r.text();
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

let lastSupaError = null;
async function checkSupaConn(){
  try{
    await supa(CFG.TABLE_TXN+'?limit=1');
    lastSupaError = null;
    setSupaStatus(true);
    return true;
  }catch(e){
    console.warn('Supabase connection check failed:', e.message);
    lastSupaError = e.message || 'অজানা ত্রুটি';
    setSupaStatus(false);
    return false;
  }
}
function setSupaStatus(ok){
  supaOk=ok;
  const dot = document.getElementById('connDot');
  if(!dot) return;
  dot.classList.toggle('offline', !ok);
  dot.title = ok ? 'ক্লাউডের সাথে সংযুক্ত (Online / Synced)' : 'ক্লাউড সংযোগ নেই (Offline / Not Synced)';
  dot.style.cursor = 'pointer';
  dot.onclick = ok ? ()=>{ toast('🔄 ক্লাউড থেকে রিফ্রেশ হচ্ছে...'); fetchFromCloud().then(()=>toast('✅ রিফ্রেশ সম্পন্ন')).catch(()=>{}); } : showSupaDiagnostic;
}
async function showSupaDiagnostic(){
  toast('🔄 আবার চেক করা হচ্ছে...');
  const ok = await checkSupaConn();
  if(ok){ toast('✅ এখন সংযুক্ত হয়েছে!'); return; }
  toast('❌ কারণ: '+(lastSupaError||'অজানা ত্রুটি'));
}

