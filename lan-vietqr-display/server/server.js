'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os');
const ROOT=path.join(__dirname,'..'),PORT=+process.env.PORT||8787,DBF=path.join(ROOT,'server-data.json');
const rnd=n=>crypto.randomBytes(n).toString('hex');
let db={displayId:'DISPLAY-'+rnd(3).toUpperCase(),controllerId:null,secret:null,pairedAt:null,rev:0,payment:null};
try{Object.assign(db,JSON.parse(fs.readFileSync(DBF,'utf8')));}catch{}
const save=()=>fs.writeFileSync(DBF,JSON.stringify(db),{mode:0o600});
const lanIp=()=>{if(process.env.LAN_IP)return process.env.LAN_IP;
  try{for(const l of Object.values(os.networkInterfaces()))for(const i of l)if((i.family==='IPv4'||i.family===4)&&!i.internal)return i.address;}catch{}return null;};

// ---- pairing (code + one-time token, 5 min) ----
let pair=null;
const newPair=()=>pair={code:String(crypto.randomInt(0,1e6)).padStart(6,'0'),token:rnd(16),exp:Date.now()+3e5};
const pairInfo=()=>{if(!pair||pair.exp<Date.now())newPair();const ip=lanIp();
  return{code:pair.code,exp:pair.exp,host:ip&&ip+':'+PORT,url:ip&&`http://${ip}:${PORT}/control?pair=${pair.token}`};};
const fails=new Map();
const locked=ip=>(fails.get(ip)||{n:0}).n>=5&&Date.now()<fails.get(ip).t;
const fail=ip=>{const f=fails.get(ip)||{n:0};f.n++;f.t=Date.now()+6e4;fails.set(ip,f);};

// ---- clients ----
const disp=new Set(),ctrl=new Set();
const status=()=>({type:'DISPLAY_STATUS',displayId:db.displayId,paired:!!db.secret,pair:db.secret?null:pairInfo(),revision:db.rev,payment:db.payment,controllerOnline:[...ctrl].some(c=>c.auth)});
const pushD=()=>disp.forEach(c=>c.send(status()));
const pushC=()=>ctrl.forEach(c=>c.auth&&c.send({type:'DISPLAY_STATUS',online:disp.size>0,revision:db.rev}));
const isStr=(s,n)=>typeof s==='string'&&s.length<=n;
const valid=p=>p&&p.bank&&/^\d{6}$/.test(p.bank.bin)&&isStr(p.bank.name,60)&&p.account&&/^\d{1,19}$/.test(p.account.number)&&isStr(p.account.holderName,40)&&(p.amount===null||Number.isInteger(p.amount)&&p.amount>0&&p.amount<1e11)&&isStr(p.description,50)&&p.currency==='VND';
function forget(){
  Object.assign(db,{controllerId:null,secret:null,pairedAt:null,rev:0,payment:null});save();
  ctrl.forEach(c=>{c.send({type:'UNPAIR'});c.sock.end();});newPair();pushD();
}
function onMsg(c,m){
  if(!m||typeof m.type!=='string')return;const t=m.type;
  if(t==='PING')return c.send({type:'PONG'});
  if(c.role==='display'){if(t==='FORGET')forget();return;}
  if(t==='PAIR_REQUEST'){
    if(db.secret||locked(c.ip))return c.send({type:'PAIR_REJECT',reason:db.secret?'ALREADY_PAIRED':'LOCKED'});
    const ok=pair&&pair.exp>Date.now()&&isStr(m.controllerId,40)&&m.controllerId&&(m.code===pair.code||m.token===pair.token);
    if(!ok){fail(c.ip);return c.send({type:'PAIR_REJECT',reason:'INVALID_OR_EXPIRED'});}
    Object.assign(db,{controllerId:m.controllerId,secret:rnd(32),pairedAt:Date.now(),rev:0,payment:null});pair=null;save();c.auth=true;
    c.send({type:'PAIR_ACCEPT',displayId:db.displayId,secret:db.secret});pushD();return pushC();
  }
  if(t==='AUTH_REQUEST'){
    if(!db.secret||m.controllerId!==db.controllerId||locked(c.ip))return c.send({type:'AUTH_REJECT'});
    c.nonce=rnd(16);return c.send({type:'AUTH_CHALLENGE',nonce:c.nonce});
  }
  if(t==='AUTH_PROOF'){
    const e=c.nonce&&db.secret&&crypto.createHmac('sha256',db.secret).update(c.nonce).digest('hex');c.nonce=null;
    if(e&&typeof m.proof==='string'&&m.proof.length===e.length&&crypto.timingSafeEqual(Buffer.from(m.proof),Buffer.from(e))){c.auth=true;c.send({type:'AUTH_ACCEPT',revision:db.rev});pushD();pushC();}
    else{fail(c.ip);c.send({type:'AUTH_REJECT'});}
    return;
  }
  if(!c.auth)return c.send({type:'AUTH_REJECT'});
  if(t==='SET_PAYMENT'){
    if(!valid(m.payload)||!Number.isInteger(m.revision))return c.send({type:'ERROR',reason:'BAD_PAYMENT'});
    if(m.revision>db.rev){db.rev=m.revision;db.payment=m.payload;save();disp.forEach(d=>d.send({type:'SET_PAYMENT',revision:db.rev,payload:db.payment}));}
    return pushC();
  }
  if(t==='UNPAIR')forget();
}

// ---- minimal RFC 6455 WebSocket ----
function frame(sock,str,op=1){const p=Buffer.from(str),n=p.length;
  const h=n<126?Buffer.from([0x80|op,n]):Buffer.from([0x80|op,126,n>>8,n&255]);
  if(!sock.destroyed)sock.write(Buffer.concat([h,p]));}
function parse(c){
  const b=c.buf;if(b.length<2)return null;let len=b[1]&127,off=2;
  if(len===126){if(b.length<4)return null;len=b.readUInt16BE(2);off=4;}else if(len===127)return{op:8};
  const mk=b[1]&128;if(mk)off+=4;if(len>16384)return{op:8};if(b.length<off+len)return null;
  const p=Buffer.from(b.subarray(off,off+len));if(mk)for(let i=0;i<len;i++)p[i]^=b[off-4+(i%4)];
  c.buf=b.subarray(off+len);return{op:b[0]&15,p};
}
const loop=ip=>{ip=(ip||'').replace('::ffff:','');return ip==='::1'||ip==='127.0.0.1'||ip===lanIp();};

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
const srv=http.createServer((req,res)=>{
  let p;try{p=decodeURIComponent(new URL(req.url,'http://x').pathname);}catch{res.statusCode=400;return res.end();}
  if(p==='/health'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({ok:true,displayId:db.displayId,paired:!!db.secret}));}
  if(p==='/control'||p==='/display')p='/apps/'+p.slice(1)+'/index.html';
  const f=path.normalize(path.join(ROOT,p)),rel='/'+path.relative(ROOT,f).split(path.sep).join('/');
  if(!/^\/(apps|core|assets)\//.test(rel)){res.statusCode=404;return res.end('404');}
  fs.readFile(f,(e,d)=>{if(e){res.statusCode=404;return res.end('404');}
    res.setHeader('content-type',MIME[path.extname(f)]||'application/octet-stream');res.setHeader('cache-control','no-cache');res.end(d);});
});
srv.on('upgrade',(req,sock)=>{
  const u=new URL(req.url,'http://x'),role=u.searchParams.get('role'),key=req.headers['sec-websocket-key'],ip=req.socket.remoteAddress;
  const og=req.headers.origin;
  if(u.pathname!=='/ws'||!key||!['display','control'].includes(role)||(role==='display'&&!loop(ip))||(og&&new URL(og).host!==req.headers.host))return sock.destroy();
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');
  const c={sock,role,ip,buf:Buffer.alloc(0),auth:false,nonce:null,send:o=>frame(sock,JSON.stringify(o))};
  (role==='display'?disp:ctrl).add(c);
  if(role==='display'){c.send({type:'HELLO',displayId:db.displayId,protocolVersion:1,capabilities:['payment']});c.send(status());pushC();}
  sock.on('data',d=>{
    c.buf=Buffer.concat([c.buf,d]);let f;
    while(c.buf.length&&(f=parse(c))){
      if(f.op===8)return sock.end();
      if(f.op===9)frame(sock,f.p.toString(),10);
      else if(f.op===1){let m;try{m=JSON.parse(f.p.toString());}catch{continue;}onMsg(c,m);}
    }
  });
  const gone=()=>{disp.delete(c);ctrl.delete(c);pushC();pushD();};
  sock.on('close',gone);sock.on('error',()=>sock.destroy());
});
setInterval(()=>{if(!db.secret&&(!pair||pair.exp<Date.now()))pushD();},5000);   // rotate expired pairing code
srv.listen(PORT,'0.0.0.0',()=>{const ip=lanIp();
  console.log(`Display (open on THIS phone): http://localhost:${PORT}/display`);
  console.log(ip?`Control  (iPhone):           http://${ip}:${PORT}/control`:'LAN IP not detected — restart with LAN_IP=192.168.x.x node server/server.js');});
