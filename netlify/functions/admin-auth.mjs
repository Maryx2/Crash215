import crypto from 'node:crypto';
import {json,cookie,secret,sign,rest,hashPassword,verifyPassword,session} from './_admin-lib.mjs';
const safeEq=(a,b,n)=>crypto.timingSafeEqual(Buffer.from(String(a).padEnd(n).slice(0,n)),Buffer.from(String(b).padEnd(n).slice(0,n)));
export default async req=>{
 if(req.method==='GET'){const s=session(req);return s?json({ok:true,session:{username:s.username,role:s.role}}):json({error:'Unauthorized'},401)}
 if(req.method==='DELETE')return json({ok:true},200,{'set-cookie':cookie('',0)});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(!secret())return json({error:'ADMIN_SESSION_SECRET is not configured'},503);
 const {username='',password=''}=await req.json().catch(()=>({}));let role=null,canonical=String(username);
 if(process.env.ADMIN_USERNAME&&process.env.ADMIN_PASSWORD&&safeEq(username,process.env.ADMIN_USERNAME,64)&&safeEq(password,process.env.ADMIN_PASSWORD,128)){role='owner';canonical=process.env.ADMIN_USERNAME}
 else{try{const rows=await rest(`admin_accounts?select=username,password_salt,password_hash,role,active&username=eq.${encodeURIComponent(username)}&limit=1`);const a=rows?.[0];if(a?.active&&verifyPassword(password,a.password_salt,a.password_hash)){role=a.role;canonical=a.username;await rest(`admin_accounts?username=eq.${encodeURIComponent(a.username)}`,'PATCH',{last_login_at:new Date().toISOString()},'return=minimal')}}catch(e){return json({error:'Admin database unavailable: '+e.message},503)}}
 if(!role)return json({error:'Invalid administrator credentials'},401);
 role=String(role).trim().toLowerCase();
 if(!['owner','admin','moderator','analyst'].includes(role))return json({error:'Invalid administrator role'},403);
 const exp=Date.now()+8*60*60*1000,payload=`${canonical}|${role}|${exp}`,token=Buffer.from(payload).toString('base64url')+'.'+sign(payload);
 return json({ok:true,session:{username:canonical,role}},200,{'set-cookie':cookie(token,8*60*60)});
};
