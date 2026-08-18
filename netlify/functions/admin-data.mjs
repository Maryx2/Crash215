import crypto from 'node:crypto';
const secret=()=>process.env.ADMIN_SESSION_SECRET||'';
function authed(req){const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('starblast_admin='))?.split('=').slice(1).join('=');if(!raw||!secret())return false;try{const [b64,sig]=raw.split('.');const payload=Buffer.from(b64,'base64url').toString();const expected=crypto.createHmac('sha256',secret()).update(payload).digest('hex');if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;const [user,exp]=payload.split('|');return user===process.env.ADMIN_USERNAME&&Date.now()<Number(exp)}catch{return false}}
export default async (req)=>{
  if(!authed(req)) return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{'content-type':'application/json'}});
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return new Response(JSON.stringify({error:'Set SUPABASE_SERVICE_ROLE_KEY in Netlify for admin data'}),{status:503,headers:{'content-type':'application/json'}});
  const headers={apikey:key,Authorization:`Bearer ${key}`};
  const r=await fetch(`${url}/rest/v1/profiles?select=username,total_score,level,best_multiplier,launches,ejects,failures&order=total_score.desc&limit=100`,{headers});
  if(!r.ok) return new Response(JSON.stringify({error:'Could not load Supabase admin data'}),{status:502,headers:{'content-type':'application/json'}});
  const players=await r.json();
  const summary=players.reduce((a,p)=>({players:a.players+1,launches:a.launches+Number(p.launches||0),ejects:a.ejects+Number(p.ejects||0),failures:a.failures+Number(p.failures||0)}),{players:0,launches:0,ejects:0,failures:0});
  return new Response(JSON.stringify({summary,players}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
};
