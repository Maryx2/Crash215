import crypto from 'node:crypto';
const COOKIE='starblast_admin';
const secret=()=>process.env.ADMIN_SESSION_SECRET||'';
const sign=(value)=>crypto.createHmac('sha256',secret()).update(value).digest('hex');
const cookie=(value,maxAge)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
export default async (req)=>{
  if(req.method==='DELETE') return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','set-cookie':cookie('',0)}});
  if(req.method!=='POST') return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers:{'content-type':'application/json'}});
  if(!process.env.ADMIN_USERNAME||!process.env.ADMIN_PASSWORD||!secret()) return new Response(JSON.stringify({error:'Admin environment variables are not configured'}),{status:503,headers:{'content-type':'application/json'}});
  const {username='',password=''}=await req.json().catch(()=>({}));
  const okUser=crypto.timingSafeEqual(Buffer.from(String(username).padEnd(64).slice(0,64)),Buffer.from(String(process.env.ADMIN_USERNAME).padEnd(64).slice(0,64)));
  const okPass=crypto.timingSafeEqual(Buffer.from(String(password).padEnd(128).slice(0,128)),Buffer.from(String(process.env.ADMIN_PASSWORD).padEnd(128).slice(0,128)));
  if(!okUser||!okPass) return new Response(JSON.stringify({error:'Invalid administrator credentials'}),{status:401,headers:{'content-type':'application/json'}});
  const exp=Date.now()+8*60*60*1000; const payload=`${process.env.ADMIN_USERNAME}|${exp}`; const token=Buffer.from(payload).toString('base64url')+'.'+sign(payload);
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json','set-cookie':cookie(token,8*60*60)}});
};
