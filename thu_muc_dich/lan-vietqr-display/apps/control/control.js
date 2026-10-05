(()=>{
const $=i=>document.getElementById(i),L=LV,kv=L.kv;
const DEF={bank:{bin:'970436',name:'Vietcombank'},account:{number:'0878300385',holderName:'LE THANH'},amount:null,currency:'VND',description:'THANH TOAN'};
let S={rev:0,payment:DEF},trust=null,cid=null,ws=null,state='UNPAIRED',online=false,retry=0,timer=null,hb=null,rx=0;
const T={UNPAIRED:'○ Android chưa ghép nối',PAIRING:'○ Đang ghép nối...',PAIRED_DISCONNECTED:'○ Android mất kết nối',CONNECTING:'○ Đang kết nối với ThanhTaxiXanh Display...',RECONNECTING:'○ Đang kết nối lại...',CONNECTED:'● Android đã kết nối',ERROR:'○ Bị từ chối — hãy ngắt ghép nối và ghép lại'};
const setState=s=>{state=s;const ok=s==='CONNECTED';
  $('st').textContent=ok&&!online?'● Máy chủ OK — Android chưa mở màn hình':T[s];
  $('st').className='st'+(ok&&online?' ok':'');
  $('paired').hidden=!trust;$('unpaired').hidden=!!trust;$('pairbox').open=!trust;};
const toast=t=>{$('toast').textContent=t;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,3500);};
const send=o=>ws&&ws.readyState===1&&ws.send(JSON.stringify({version:1,messageId:Math.random().toString(36).slice(2),timestamp:Date.now(),...o}));
const push=()=>send({type:'SET_PAYMENT',revision:S.rev,payload:S.payment});
const hbStart=()=>{clearInterval(hb);hb=setInterval(()=>{if(Date.now()-rx>20000)ws.close();else send({type:'PING'});},5000);};
const hex=a=>[...a].map(b=>b.toString(16).padStart(2,'0')).join('');
const draft=()=>({bank:{bin:$('bank').value,name:$('bank').selectedOptions[0].text},account:{number:$('acc').value.replace(/\D/g,''),holderName:$('own').value.toUpperCase().trim()},amount:parseInt($('amt').value.replace(/\D/g,''),10)||null,currency:'VND',description:$('desc').value.trim()});
const fill=p=>{$('bank').value=p.bank.bin;$('acc').value=p.account.number;$('own').value=p.account.holderName;$('amt').value=p.amount||'';$('desc').value=p.description;};
const preview=()=>L.renderCard($('card'),draft());
// commit: local update first, then network (never blocks the local UI)
const commit=async()=>{S={rev:S.rev+1,payment:draft()};await kv.set('state',S);L.renderCard($('card'),S.payment);push();};
async function drop(){trust=null;await kv.del('trust');clearTimeout(timer);clearInterval(hb);if(ws){ws.onclose=null;ws.close();}online=false;setState('UNPAIRED');}
async function on(m){
  if(m.type==='AUTH_CHALLENGE')send({type:'AUTH_PROOF',proof:L.hmac(trust.secret,m.nonce)});
  else if(m.type==='AUTH_ACCEPT'){retry=0;setState('CONNECTED');push();hbStart();}
  else if(m.type==='PAIR_ACCEPT'){trust={controllerId:cid,displayId:m.displayId,secret:m.secret,pairedAt:Date.now()};await kv.set('trust',trust);retry=0;setState('CONNECTED');push();hbStart();toast('Đã ghép nối với ThanhTaxiXanh Display');}
  else if(m.type==='PAIR_REJECT')toast(m.reason==='ALREADY_PAIRED'?'Android đã ghép với iPhone khác':m.reason==='LOCKED'?'Thử sai nhiều lần, đợi 1 phút':'Mã sai hoặc đã hết hạn');
  else if(m.type==='AUTH_REJECT'){clearTimeout(timer);ws.onclose=null;ws.close();setState('ERROR');}
  else if(m.type==='DISPLAY_STATUS'){online=!!m.online;setState(state);}
  else if(m.type==='UNPAIR')await drop();
}
function connect(pr){
  clearTimeout(timer);if(ws){ws.onclose=null;ws.close();}
  online=false;setState(pr?'PAIRING':retry?'RECONNECTING':'CONNECTING');
  ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?role=control');
  ws.onopen=()=>{rx=Date.now();pr?send({type:'PAIR_REQUEST',controllerId:cid,...pr}):send({type:'AUTH_REQUEST',controllerId:trust.controllerId});};
  ws.onmessage=e=>{rx=Date.now();let m;try{m=JSON.parse(e.data)}catch{return}on(m);};
  ws.onclose=()=>{clearInterval(hb);online=false;
    if(!trust){setState('UNPAIRED');return;}
    setState('PAIRED_DISCONNECTED');timer=setTimeout(()=>connect(),[1,2,4,8,15,30][Math.min(retry++,5)]*1000);};
}
async function boot(){
  L.BANKS.forEach(([b,n])=>$('bank').add(new Option(n,b)));
  S=(await kv.get('state'))||S;trust=(await kv.get('trust'))||null;
  cid=await kv.get('cid');if(!cid){cid='CTRL-'+hex(crypto.getRandomValues(new Uint8Array(6))).toUpperCase();await kv.set('cid',cid);}
  fill(S.payment);L.renderCard($('card'),S.payment);          // QR first, network later
  const tk=new URLSearchParams(location.search).get('pair');
  if(tk)history.replaceState(null,'','/control');             // keep token out of the URL
  setState(trust?'CONNECTING':'UNPAIRED');
  if(trust)connect();else if(tk)connect({token:tk});
}
document.querySelectorAll('#form input,#form select').forEach(e=>e.addEventListener('input',preview));
$('upd').onclick=commit;
$('clr').onclick=()=>{$('amt').value='';$('desc').value='';commit();};
[10,20,50,100,200,500].forEach(n=>{const b=document.createElement('button');b.textContent=n+'K';b.onclick=()=>{$('amt').value=n*1000;commit();};$('quick').append(b);});
const o=document.createElement('button');o.textContent='Tùy chỉnh';o.onclick=()=>$('amt').focus();$('quick').append(o);
$('pairbtn').onclick=()=>connect({code:$('code').value.replace(/\s/g,'')});
$('recon').onclick=()=>{retry=0;connect();};
$('unpair').onclick=async()=>{if(!confirm('Ngắt ghép nối với Android?'))return;send({type:'UNPAIR'});await drop();};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&trust&&state!=='CONNECTED'&&state!=='ERROR'){retry=0;connect();}});
boot();
})();
