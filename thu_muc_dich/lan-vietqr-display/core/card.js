(function(L){
// --- persistent store (IndexedDB) ---
const dbp=new Promise((res,rej)=>{const o=indexedDB.open('lv',1);o.onupgradeneeded=()=>o.result.createObjectStore('k');o.onsuccess=()=>res(o.result);o.onerror=()=>rej(o.error);});
const tx=async(m,fn)=>{const d=await dbp;return new Promise((res,rej)=>{const r=fn(d.transaction('k',m).objectStore('k'));r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});};
L.kv={get:k=>tx('readonly',s=>s.get(k)),set:(k,v)=>tx('readwrite',s=>s.put(v,k)),del:k=>tx('readwrite',s=>s.delete(k))};
// --- shared payment card renderer (used by iPhone AND Android) ---
const esc=s=>String(s).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
L.fmt=n=>n.toLocaleString('en-US')+' VND';
L.renderCard=(el,p)=>{
  let qr;
  try{qr=L.qrSvg(L.vietqr(p),{ecl:'H',logo:'/assets/branding/qr-center-logo.png',logoPct:.13});}
  catch(e){qr='<p style="padding:40px;text-align:center">Chưa đủ thông tin tài khoản</p>';}
  el.innerHTML=`<div class="card"><div class="top"><div class="acc">${esc(p.account.number)}</div><div class="own">${esc(p.account.holderName)}</div></div><div class="qr">${qr}</div><img class="brand" src="/assets/branding/thanh-taxi-xanh-logo.png" alt="ThanhTaxiXanh"></div>`+
    ((p.amount||p.description)?`<div class="info">${p.amount?`<div class="amt">${L.fmt(p.amount)}</div>`:''}${p.description?`<div class="desc">${esc(p.description)}</div>`:''}</div>`:'');
};
})(window.LV=window.LV||{});
