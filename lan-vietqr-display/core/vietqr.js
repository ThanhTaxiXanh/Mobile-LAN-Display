(function(L){
const f=(id,v)=>id+String(v.length).padStart(2,'0')+v;
L.crc16=s=>{let c=0xFFFF;for(let i=0;i<s.length;i++){c^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++)c=c&0x8000?((c<<1)^0x1021)&0xFFFF:(c<<1)&0xFFFF;}return c.toString(16).toUpperCase().padStart(4,'0');};
const ascii=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').replace(/[^\x20-\x7E]/g,'').trim();
L.BANKS=[['970436','Vietcombank'],['970415','VietinBank'],['970418','BIDV'],['970405','Agribank'],['970407','Techcombank'],['970422','MB Bank'],['970416','ACB'],['970432','VPBank'],['970423','TPBank'],['970403','Sacombank']];
// p = {bank:{bin},account:{number},amount:int|null,description}
L.vietqr=p=>{
  if(!/^\d{6}$/.test(p.bank.bin)||!/^\d{1,19}$/.test(p.account.number))throw new Error('BAD_ACCOUNT');
  const amt=p.amount>0?String(Math.round(p.amount)):'';
  let s=f('00','01')+f('01',amt?'12':'11')+
    f('38',f('00','A000000727')+f('01',f('00',p.bank.bin)+f('01',p.account.number))+f('02','QRIBFTTA'))+
    f('53','704')+(amt?f('54',amt):'')+f('58','VN');
  const d=ascii(p.description).slice(0,50);
  if(d)s+=f('62',f('08',d));
  s+='6304';return s+L.crc16(s);
};
})(window.LV=window.LV||{});
