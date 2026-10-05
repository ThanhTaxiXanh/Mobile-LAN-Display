(()=>{
const $=i=>document.getElementById(i),L=LV,kv=L.kv;
let cur=null,st=null,ws=null,retry=0,tick=null,wl=null;
const view=v=>['pair','pay','wait'].forEach(x=>$(x).hidden=x!==v);
function showPair(){
  const p=st.pair;
  $('code').textContent=p.code.replace(/(\d{3})(\d{3})/,'$1 $2');
  $('pqr').innerHTML=p.url?L.qrSvg(p.url,{ecl:'M'}):'';          // pairing QR: plain, no logo
  $('purl').textContent=p.host?'http://'+p.host+'/control':'Chạy máy chủ với LAN_IP=<địa chỉ IP>';
  clearInterval(tick);
  const t=()=>{const s=Math.max(0,Math.round((p.exp-Date.now())/1000));$('exp').textContent='Mã có hiệu lực '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  t();tick=setInterval(t,1000);view('pair');
}
function render(){
  if(st&&!st.paired)return showPair();
  if(cur){L.renderCard($('card'),cur.payment);return view('pay');}   // last valid state stays on screen
  $('wt').textContent=st?'Đã ghép nối — đang chờ iPhone':'Đang kết nối máy chủ...';view('wait');
}
const apply=(rev,p)=>{if(p&&(!cur||rev>cur.revision)){cur={revision:rev,payment:p};kv.set('last',cur);}};
function on(m){
  if(m.type==='DISPLAY_STATUS'){
    st=m;
    if(!m.paired){cur=null;kv.del('last');}else apply(m.revision,m.payment);
    render();
  }else if(m.type==='SET_PAYMENT'){apply(m.revision,m.payload);render();}
}
function connect(){
  ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?role=display');
  let rx=Date.now(),hb;
  ws.onopen=()=>{retry=0;hb=setInterval(()=>{if(Date.now()-rx>20000)ws.close();else ws.send('{"type":"PING"}');},5000);};
  ws.onmessage=e=>{rx=Date.now();try{on(JSON.parse(e.data));}catch{}};
  ws.onclose=()=>{clearInterval(hb);st=null;render();setTimeout(connect,[1,2,4,8,15,30][Math.min(retry++,5)]*1000);};
}
const lock=async()=>{try{wl=await navigator.wakeLock.request('screen');}catch{}};
$('fs').onclick=()=>{try{document.documentElement.requestFullscreen();}catch{}lock();};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&wl)lock();});
$('fg').onclick=()=>{if(ws&&ws.readyState===1&&confirm('Ngắt ghép nối với iPhone?'))ws.send('{"type":"FORGET"}');};
(async()=>{cur=(await kv.get('last'))||null;render();connect();})();
})();
