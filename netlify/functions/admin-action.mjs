import crypto from 'node:crypto';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const secret=()=>process.env.ADMIN_SESSION_SECRET||'';
function authed(req){const raw=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('starblast_admin='))?.split('=').slice(1).join('=');if(!raw||!secret())return false;try{const [b64,sig]=raw.split('.');const payload=Buffer.from(b64,'base64url').toString();const expected=crypto.createHmac('sha256',secret()).update(payload).digest('hex');if(!sig||sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;const [user,exp]=payload.split('|');return user===process.env.ADMIN_USERNAME&&Date.now()<Number(exp)}catch{return false}}
function env(){const url=(process.env.SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';if(!url||!key)throw new Error('Supabase admin environment variables are missing');return{url,key,headers:{apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json'}}}
async function rest(path,method='POST',body,prefer='return=representation'){const {url,headers}=env();const r=await fetch(`${url}/rest/v1/${path}`,{method,headers:{...headers,Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body)});const txt=await r.text();let data=null;try{data=txt?JSON.parse(txt):null}catch{data=txt}if(!r.ok)throw new Error(typeof data==='object'?(data.message||data.error||JSON.stringify(data)):String(data||r.statusText));return data}
async function audit(action,target,details={}){await rest('admin_audit_logs','POST',{admin_username:process.env.ADMIN_USERNAME||'admin',action,target_user_id:target||null,details},'return=minimal')}
export default async(req)=>{
 if(!authed(req))return json({error:'Unauthorized'},401);if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{const b=await req.json();const action=b.action;
  if(action==='update_config'){
    const allowed=['cooldown_seconds','rocket_speed','acceleration','score_multiplier','xp_multiplier','shields_enabled','slowmo_enabled','maintenance_mode','announcement'];const patch={};for(const k of allowed)if(k in b.config)patch[k]=b.config[k];patch.updated_at=new Date().toISOString();
    const current=(await rest('game_config?select=config_version&id=eq.1','GET'))?.[0];patch.config_version=Number(current?.config_version||1)+1;
    const data=await rest('game_config?id=eq.1','PATCH',patch);await audit('UPDATE_CONFIG',null,patch);return json({ok:true,config:data?.[0]||patch});
  }
  if(action==='suspend_player'){
    if(!b.userId)return json({error:'Missing userId'},400);const suspended=!!b.suspended;await rest(`profiles?user_id=eq.${encodeURIComponent(b.userId)}`,'PATCH',{is_suspended:suspended,updated_at:new Date().toISOString()},'return=minimal');if(suspended)await rest(`active_runs?user_id=eq.${encodeURIComponent(b.userId)}`,'DELETE',undefined,'return=minimal');await audit(suspended?'SUSPEND_PLAYER':'UNSUSPEND_PLAYER',b.userId,{});return json({ok:true});
  }
  if(action==='reset_player'){
    if(!b.userId)return json({error:'Missing userId'},400);await rest(`runs?user_id=eq.${encodeURIComponent(b.userId)}`,'DELETE',undefined,'return=minimal');await rest(`active_runs?user_id=eq.${encodeURIComponent(b.userId)}`,'DELETE',undefined,'return=minimal');await rest(`profiles?user_id=eq.${encodeURIComponent(b.userId)}`,'PATCH',{total_score:0,best_score:0,xp:0,level:1,launches:0,ejects:0,failures:0,best_multiplier:1,current_streak:0,best_streak:0,total_play_ms:0,updated_at:new Date().toISOString()},'return=minimal');await audit('RESET_PLAYER',b.userId,{clearedRuns:true});return json({ok:true});
  }
  if(action==='save_note'){
    if(!b.userId)return json({error:'Missing userId'},400);const note=String(b.note||'').slice(0,4000);await rest('admin_player_notes?on_conflict=user_id','POST',{user_id:b.userId,note,updated_by:process.env.ADMIN_USERNAME||'admin',updated_at:new Date().toISOString()},'resolution=merge-duplicates,return=minimal');await audit('SAVE_PLAYER_NOTE',b.userId,{length:note.length});return json({ok:true});
  }
  if(action==='announcement'){
    const announcement=String(b.message||'').slice(0,500);await rest('game_config?id=eq.1','PATCH',{announcement,updated_at:new Date().toISOString()},'return=minimal');await audit('SET_ANNOUNCEMENT',null,{announcement});return json({ok:true});
  }
  return json({error:'Unknown action'},400);
 }catch(e){return json({error:e.message||'Admin action failed'},500)}
};
