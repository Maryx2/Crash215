import crypto from 'node:crypto';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const secret=()=>process.env.ADMIN_SESSION_SECRET||'';
function authed(req){const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('starblast_admin='))?.split('=').slice(1).join('=');if(!raw||!secret())return false;try{const [b64,sig]=raw.split('.');const payload=Buffer.from(b64,'base64url').toString();const expected=crypto.createHmac('sha256',secret()).update(payload).digest('hex');if(!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;const [user,exp]=payload.split('|');return user===process.env.ADMIN_USERNAME&&Date.now()<Number(exp)}catch{return false}}
function env(){const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';if(!url||!key)throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');return{url,key,headers:{apikey:key,Authorization:`Bearer ${key}`}}}
async function rest(path,options={}){const {url,headers}=env();const r=await fetch(`${url}/rest/v1/${path}`,{...options,headers:{...headers,...options.headers}});const txt=await r.text();let data=null;try{data=txt?JSON.parse(txt):null}catch{data=txt}if(!r.ok)throw new Error(typeof data==='object'?(data.message||data.error||JSON.stringify(data)):String(data||r.statusText));return{data,headers:r.headers,status:r.status}}
async function authUsers(){const {url,headers}=env();const r=await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`,{headers});if(!r.ok)throw new Error('Could not load Supabase Auth users');const d=await r.json();return d.users||[]}
const num=v=>Number(v||0);
const isoAgo=ms=>new Date(Date.now()-ms).toISOString();
function playerMap(users){return new Map(users.map(u=>[u.id,u]));}
export default async(req)=>{
  if(!authed(req))return json({error:'Unauthorized'},401);
  try{
    const u=new URL(req.url);const section=u.searchParams.get('section')||'overview';
    if(section==='overview'){
      const [{data:profiles},{data:runs},{data:active},{data:config}]=await Promise.all([
        rest('profiles?select=user_id,username,total_score,best_score,xp,level,launches,ejects,failures,best_multiplier,current_streak,best_streak,total_play_ms,last_seen_at,is_suspended,created_at&order=total_score.desc&limit=1000'),
        rest(`runs?select=id,user_id,outcome,multiplier,score,profile_type,duration_ms,created_at&created_at=gte.${encodeURIComponent(isoAgo(24*3600e3))}&order=created_at.desc&limit=2000`),
        rest(`active_runs?select=user_id,profile_type,started_at&started_at=gte.${encodeURIComponent(isoAgo(30*60e3))}&order=started_at.desc&limit=500`),
        rest('game_config?select=*&id=eq.1')
      ]);
      const online=profiles.filter(p=>p.last_seen_at&&Date.now()-new Date(p.last_seen_at).getTime()<90000).length;
      const summary=profiles.reduce((a,p)=>{a.players++;a.launches+=num(p.launches);a.ejects+=num(p.ejects);a.failures+=num(p.failures);a.score+=num(p.total_score);return a},{players:0,launches:0,ejects:0,failures:0,score:0});
      const todayRuns=runs.length, todayScore=runs.reduce((s,r)=>s+num(r.score),0), avgMult=todayRuns?runs.reduce((s,r)=>s+num(r.multiplier),0)/todayRuns:0;
      const recent=runs.slice(0,30).map(r=>({...r,username:profiles.find(p=>p.user_id===r.user_id)?.username||'Unknown'}));
      return json({summary:{...summary,online,activeRuns:active.length,todayRuns,todayScore,avgMult},topPlayers:profiles.slice(0,10),recent,config:config?.[0]||null});
    }
    if(section==='live'){
      const [{data:profiles},{data:active},{data:runs}]=await Promise.all([
        rest(`profiles?select=user_id,username,level,total_score,last_seen_at,is_suspended&last_seen_at=gte.${encodeURIComponent(isoAgo(15*60e3))}&order=last_seen_at.desc&limit=500`),
        rest(`active_runs?select=user_id,profile_type,started_at&started_at=gte.${encodeURIComponent(isoAgo(30*60e3))}&order=started_at.desc&limit=500`),
        rest(`runs?select=id,user_id,outcome,multiplier,score,profile_type,duration_ms,created_at&created_at=gte.${encodeURIComponent(isoAgo(60*60e3))}&order=created_at.desc&limit=500`)
      ]);
      const names=new Map(profiles.map(p=>[p.user_id,p.username]));
      return json({players:profiles,active:active.map(a=>({...a,username:names.get(a.user_id)||'Unknown'})),events:runs.slice(0,100).map(r=>({...r,username:names.get(r.user_id)||'Unknown'}))});
    }
    if(section==='players'){
      const q=(u.searchParams.get('q')||'').trim();const limit=Math.min(250,Math.max(10,num(u.searchParams.get('limit'))||100));
      const filter=q?`&username=ilike.*${encodeURIComponent(q.replace(/[*,]/g,''))}*`:'';
      const [{data:profiles},users]=await Promise.all([
        rest(`profiles?select=*&order=last_seen_at.desc.nullslast&limit=${limit}${filter}`),authUsers().catch(()=>[])
      ]);
      const um=playerMap(users);return json({players:profiles.map(p=>({...p,email:um.get(p.user_id)?.email||null,email_confirmed_at:um.get(p.user_id)?.email_confirmed_at||null,last_sign_in_at:um.get(p.user_id)?.last_sign_in_at||null}))});
    }
    if(section==='player'){
      const id=u.searchParams.get('id');if(!id)return json({error:'Missing player id'},400);
      const [{data:profiles},{data:runs},{data:note},users]=await Promise.all([
        rest(`profiles?select=*&user_id=eq.${encodeURIComponent(id)}&limit=1`),
        rest(`runs?select=*&user_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=500`),
        rest(`admin_player_notes?select=*&user_id=eq.${encodeURIComponent(id)}&limit=1`),authUsers().catch(()=>[])
      ]);
      if(!profiles?.[0])return json({error:'Player not found'},404);const au=users.find(x=>x.id===id);
      return json({player:{...profiles[0],email:au?.email||null,email_confirmed_at:au?.email_confirmed_at||null,last_sign_in_at:au?.last_sign_in_at||null},runs,note:note?.[0]||null});
    }
    if(section==='runs'){
      const outcome=u.searchParams.get('outcome')||'';const rare=u.searchParams.get('rare')==='1';const days=Math.min(365,Math.max(1,num(u.searchParams.get('days'))||7));const limit=Math.min(1000,Math.max(50,num(u.searchParams.get('limit'))||300));
      let path=`runs?select=*&created_at=gte.${encodeURIComponent(isoAgo(days*86400e3))}&order=created_at.desc&limit=${limit}`;if(outcome)path+=`&outcome=eq.${encodeURIComponent(outcome)}`;if(rare)path+='&multiplier=gt.3';
      const [{data:runs},{data:profiles}]=await Promise.all([rest(path),rest('profiles?select=user_id,username&limit=1000')]);const names=new Map(profiles.map(p=>[p.user_id,p.username]));
      return json({runs:runs.map(r=>({...r,username:names.get(r.user_id)||'Unknown'}))});
    }
    if(section==='analytics'){
      const days=Math.min(90,Math.max(1,num(u.searchParams.get('days'))||30));const [{data:runs},{data:profiles}]=await Promise.all([
        rest(`runs?select=outcome,multiplier,score,profile_type,duration_ms,created_at&created_at=gte.${encodeURIComponent(isoAgo(days*86400e3))}&order=created_at.asc&limit=10000`),
        rest('profiles?select=user_id,created_at,last_seen_at&limit=5000')
      ]);
      const daily={};for(const r of runs){const d=r.created_at.slice(0,10);daily[d]??={date:d,runs:0,ejects:0,failures:0,score:0};daily[d].runs++;daily[d][r.outcome==='EJECT'?'ejects':'failures']++;daily[d].score+=num(r.score)}
      const buckets={'1.00–1.49×':0,'1.50–1.99×':0,'2.00–2.49×':0,'2.50–3.00×':0,'>3.00×':0};for(const r of runs){const m=num(r.multiplier);buckets[m<1.5?'1.00–1.49×':m<2?'1.50–1.99×':m<2.5?'2.00–2.49×':m<=3?'2.50–3.00×':'>3.00×']++}
      const total=runs.length,ejects=runs.filter(r=>r.outcome==='EJECT').length,rare=runs.filter(r=>num(r.multiplier)>3).length,playMs=runs.reduce((s,r)=>s+num(r.duration_ms),0);
      return json({summary:{total,ejects,failures:total-ejects,successRate:total?ejects/total*100:0,rareRate:total?rare/total*100:0,avgMultiplier:total?runs.reduce((s,r)=>s+num(r.multiplier),0)/total:0,avgDurationMs:total?playMs/total:0,newPlayers:profiles.filter(p=>new Date(p.created_at)>=new Date(isoAgo(days*86400e3))).length},daily:Object.values(daily),buckets});
    }
    if(section==='leaderboard'){const {data}=await rest('profiles?select=user_id,username,total_score,best_score,level,launches,ejects,failures,best_multiplier,best_streak,last_seen_at,is_suspended&order=total_score.desc&limit=100');return json({players:data});}
    if(section==='config'){const {data}=await rest('game_config?select=*&id=eq.1');return json({config:data?.[0]||null,locked:{extendedRunChance:5,standardMaxMultiplier:3}});}
    if(section==='audit'){const {data}=await rest('admin_audit_logs?select=*&order=created_at.desc&limit=500');return json({logs:data});}
    if(section==='system'){
      const checks={env:{supabaseUrl:!!process.env.SUPABASE_URL,serviceRole:!!process.env.SUPABASE_SERVICE_ROLE_KEY,adminSecret:!!process.env.ADMIN_SESSION_SECRET},database:false,auth:false,realtime:'client-managed'};
      let dbError=null,authError=null;try{await rest('profiles?select=user_id&limit=1');checks.database=true}catch(e){dbError=e.message}try{await authUsers();checks.auth=true}catch(e){authError=e.message}
      return json({checks,errors:{database:dbError,auth:authError},now:new Date().toISOString(),node:process.version});
    }
    return json({error:'Unknown section'},400);
  }catch(e){return json({error:e.message||'Admin data error'},500)}
};
