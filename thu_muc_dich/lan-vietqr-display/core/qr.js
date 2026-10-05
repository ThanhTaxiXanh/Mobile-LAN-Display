(function(L){
const ECC={M:[10,16,26,18,24,16,18,22,22,26,30,22,22,24],H:[17,28,22,16,22,28,26,26,24,28,24,28,22,24]};
const BLK={M:[1,1,1,2,2,4,4,4,5,5,5,8,9,9],H:[1,1,2,4,4,4,5,6,8,8,11,11,16,16]};
const FMT={M:0,H:2};
const EXP=new Uint8Array(512),LOG=new Uint8Array(256);
for(let i=0,x=1;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=285;}
for(let i=255;i<512;i++)EXP[i]=EXP[i-255];
const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
const raw=v=>{let r=(16*v+128)*v+64;if(v>=2){const a=(v/7|0)+2;r-=(25*a-10)*a-55;if(v>=7)r-=36;}return r;};
const align=v=>{if(v==1)return[];const n=(v/7|0)+2,s=Math.ceil((v*4+4)/(n*2-2))*2,r=[6];for(let p=v*4+10;r.length<n;p-=s)r.splice(1,0,p);return r;};
function gen(n){let r=[1];for(let i=0;i<n;i++){const s=new Array(r.length+1).fill(0);for(let j=0;j<r.length;j++){s[j]^=r[j];s[j+1]^=mul(r[j],EXP[i]);}r=s;}return r;}
function rem(d,g){const n=g.length-1,r=new Array(n).fill(0);for(const b of d){const x=b^r.shift();r.push(0);if(x)for(let i=0;i<n;i++)r[i]^=mul(g[i+1],x);}return r;}
function penalty(m,n){let p=0;for(let t=0;t<2;t++)for(let a=0;a<n;a++){let run=1;for(let b=1;b<n;b++){const c=t?m[b][a]:m[a][b],d=t?m[b-1][a]:m[a][b-1];if(c==d){run++;if(run==5)p+=3;else if(run>5)p++;}else run=1;}}let k=0;for(const r of m)for(const c of r)k+=c;return p+Math.floor(Math.abs(k*20-n*n*10)/(n*n))*10;}
const MK=[(x,y)=>(x+y)%2==0,(x,y)=>y%2==0,(x,y)=>x%3==0,(x,y)=>(x+y)%3==0,(x,y)=>((x/3|0)+(y>>1))%2==0,(x,y)=>x*y%2+x*y%3==0,(x,y)=>(x*y%2+x*y%3)%2==0,(x,y)=>((x+y)%2+x*y%3)%2==0];
L.qr=(text,ecl)=>{
  const bytes=[...new TextEncoder().encode(text)];let v=1,dcw;
  for(;v<=14;v++){dcw=(raw(v)>>3)-ECC[ecl][v-1]*BLK[ecl][v-1];if(4+(v<10?8:16)+bytes.length*8<=dcw*8)break;}
  if(v>14)throw new Error('QR_TOO_LONG');
  const bits=[],put=(x,n)=>{for(let i=n-1;i>=0;i--)bits.push((x>>>i)&1);};
  put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));put(0,Math.min(4,dcw*8-bits.length));while(bits.length%8)bits.push(0);
  const data=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(''),2));
  for(let p=0xEC;data.length<dcw;p^=0xEC^0x11)data.push(p);
  const nb=BLK[ecl][v-1],el=ECC[ecl][v-1],tot=raw(v)>>3,ns=nb-tot%nb,sl=tot/nb|0,g=gen(el),bl=[];
  for(let i=0,k=0;i<nb;i++){const d=data.slice(k,k+sl-el+(i<ns?0:1));k+=d.length;bl.push({d,e:rem(d,g)});}
  const out=[];
  for(let i=0;i<=sl-el;i++)for(let j=0;j<nb;j++)if(i<bl[j].d.length)out.push(bl[j].d[i]);
  for(let i=0;i<el;i++)for(let j=0;j<nb;j++)out.push(bl[j].e[i]);
  const n=17+4*v,m=Array.from({length:n},()=>new Array(n).fill(0)),fn=Array.from({length:n},()=>new Array(n).fill(false));
  const set=(x,y,d,M=m)=>{if(x>=0&&y>=0&&x<n&&y<n){M[y][x]=d?1:0;fn[y][x]=true;}};
  for(let i=0;i<n;i++){set(6,i,i%2==0);set(i,6,i%2==0);}
  const fnd=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));set(cx+dx,cy+dy,d!=2&&d!=4);}};
  fnd(3,3);fnd(n-4,3);fnd(3,n-4);
  const ap=align(v),A=ap.length;
  for(let i=0;i<A;i++)for(let j=0;j<A;j++){if(i==0&&j==0||i==0&&j==A-1||i==A-1&&j==0)continue;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(ap[i]+dx,ap[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!=1);}
  if(v>=7){let r=v;for(let i=0;i<12;i++)r=(r<<1)^((r>>11)*0x1F25);const b=v<<12|r;for(let i=0;i<18;i++){const a=n-11+i%3,c=i/3|0,bit=(b>>i)&1;set(a,c,bit);set(c,a,bit);}}
  const fmt=(mask,M)=>{const d=(FMT[ecl]<<3)|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>9)*0x537);const b=((d<<10)|r)^0x5412,q=i=>(b>>i)&1;
    for(let i=0;i<=5;i++)set(8,i,q(i),M);set(8,7,q(6),M);set(8,8,q(7),M);set(7,8,q(8),M);for(let i=9;i<15;i++)set(14-i,8,q(i),M);
    for(let i=0;i<8;i++)set(n-1-i,8,q(i),M);for(let i=8;i<15;i++)set(8,n-15+i,q(i),M);set(8,n-8,1,M);};
  fmt(0,m);
  let i=0;
  for(let right=n-1;right>=1;right-=2){if(right==6)right=5;for(let vert=0;vert<n;vert++)for(let j=0;j<2;j++){const x=right-j,y=((right+1)&2)==0?n-1-vert:vert;if(!fn[y][x]&&i<out.length*8){m[y][x]=(out[i>>3]>>(7-(i&7)))&1;i++;}}}
  let best,bp=1e9;
  for(let k=0;k<8;k++){const t=m.map(r=>r.slice());for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(!fn[y][x]&&MK[k](x,y))t[y][x]^=1;fmt(k,t);const p=penalty(t,n);if(p<bp){bp=p;best=t;}}
  return best;
};
// o: {ecl:'H'|'M', logo:url, logoPct:0.08-0.15}
L.qrSvg=(text,o={})=>{
  const m=L.qr(text,o.ecl||'H'),n=m.length,q=4,N=n+q*2;let d='';
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){if(!m[y][x])continue;let e=x;while(e<n&&m[y][e])e++;d+=`M${x+q} ${y+q}h${e-x}v1h-${e-x}z`;x=e-1;}
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges"><rect width="${N}" height="${N}" fill="#fff"/><path d="${d}"/>`;
  if(o.logo){const c=N/2,r=n*(o.logoPct||.13)/2;s+=`<circle cx="${c}" cy="${c}" r="${r*1.18}" fill="#fff"/><clipPath id="lc"><circle cx="${c}" cy="${c}" r="${r}"/></clipPath><image href="${o.logo}" x="${c-r}" y="${c-r}" width="${2*r}" height="${2*r}" clip-path="url(#lc)" preserveAspectRatio="xMidYMid slice"/>`;}
  return s+'</svg>';
};
})(window.LV=window.LV||{});
