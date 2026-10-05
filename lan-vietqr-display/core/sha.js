(function(L){
const P=[];for(let n=2;P.length<64;n++)if(P.every(p=>n%p))P.push(n);
const fr=x=>Math.floor((x%1)*4294967296)|0;
const K=P.map(p=>fr(Math.cbrt(p))),H0=P.slice(0,8).map(p=>fr(Math.sqrt(p)));
const rr=(x,n)=>(x>>>n)|(x<<(32-n));
function sha(msg){
  const l=msg.length,n=(l+72)&~63,m=new Uint8Array(n);m.set(msg);m[l]=128;
  const dv=new DataView(m.buffer);dv.setUint32(n-4,l*8);
  const h=H0.slice(),w=new Int32Array(64);
  for(let o=0;o<n;o+=64){
    for(let i=0;i<16;i++)w[i]=dv.getInt32(o+4*i);
    for(let i=16;i<64;i++){const a=w[i-15],c=w[i-2];w[i]=(w[i-16]+(rr(a,7)^rr(a,18)^(a>>>3))+w[i-7]+(rr(c,17)^rr(c,19)^(c>>>10)))|0;}
    let[a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){
      const t1=(hh+(rr(e,6)^rr(e,11)^rr(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0;
      const t2=((rr(a,2)^rr(a,13)^rr(a,22))+((a&b)^(a&c)^(b&c)))|0;
      hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    [a,b,c,d,e,f,g,hh].forEach((x,i)=>h[i]=(h[i]+x)|0);
  }
  const out=new Uint8Array(32),ov=new DataView(out.buffer);h.forEach((x,i)=>ov.setInt32(4*i,x));return out;
}
L.hmac=(key,msg)=>{
  const e=new TextEncoder();let k=e.encode(key);if(k.length>64)k=sha(k);
  const kk=new Uint8Array(64);kk.set(k);const m=e.encode(msg);
  const a=new Uint8Array(64+m.length);a.set(kk.map(x=>x^0x36));a.set(m,64);
  const o=new Uint8Array(96);o.set(kk.map(x=>x^0x5c));o.set(sha(a),64);
  return[...sha(o)].map(b=>b.toString(16).padStart(2,'0')).join('');
};
})(window.LV=window.LV||{});
