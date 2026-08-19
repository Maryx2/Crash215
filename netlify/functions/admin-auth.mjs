import {json,cookie,session,makeToken} from './_admin-lib.mjs';

const DEFAULT_ALLOWED = [
  'marymdb1998@gmail.com',
  'amirnajmabadi415@gmail.com'
];

function allowedEmails(){
  const extra=(process.env.ADMIN_ALLOWED_EMAILS||'')
    .split(',')
    .map(x=>x.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED,...extra])];
}

function supabaseConfig(){
  return {
    url:(process.env.SUPABASE_URL||'').replace(/\/$/,''),
    anon:process.env.SUPABASE_ANON_KEY||''
  };
}

async function signInWithSupabase(email,password){
  const {url,anon}=supabaseConfig();
  if(!url||!anon) throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY is missing in Netlify.');
  const r=await fetch(`${url}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{
      apikey:anon,
      Authorization:`Bearer ${anon}`,
      'content-type':'application/json'
    },
    body:JSON.stringify({email,password})
  });
  let data={};
  try{data=await r.json()}catch{}
  if(!r.ok) throw new Error(data?.msg||data?.error_description||data?.error||'Invalid email or password');
  return data;
}

export default async(req)=>{
  if(req.method==='GET'){
    const s=session(req);
    if(s) return json({ok:true,session:{username:s.username,role:s.role,email:s.username},token:s.token});
    const cfg=supabaseConfig();
    return json({
      ok:false,
      session:null,
      auth_mode:'supabase_email',
      allowed_emails:allowedEmails(),
      config:{
        supabase_url:!!cfg.url,
        supabase_anon_key:!!cfg.anon,
        admin_session_secret:!!process.env.ADMIN_SESSION_SECRET
      }
    },401);
  }

  if(req.method==='DELETE'){
    return json({ok:true},200,{
      'set-cookie':cookie('',0,new URL(req.url).protocol==='https:')
    });
  }

  if(req.method!=='POST') return json({error:'Method not allowed'},405);

  try{
    const body=await req.json();
    const email=String(body.email||body.username||'').trim().toLowerCase();
    const password=String(body.password||'');

    if(!email||!password) return json({error:'Email and password are required'},400);

    if(!allowedEmails().includes(email)){
      return json({error:'This email is not authorized for Mission Control.'},403);
    }

    const auth=await signInWithSupabase(email,password);
    const actualEmail=String(auth?.user?.email||email).trim().toLowerCase();

    if(!allowedEmails().includes(actualEmail)){
      return json({error:'This Supabase account is not authorized for Mission Control.'},403);
    }

    // Both requested admin emails are Owners so all current console controls work.
    const role='owner';
    const token=makeToken(actualEmail,role,8*60*60);

    return json(
      {ok:true,session:{username:actualEmail,email:actualEmail,role},token},
      200,
      {'set-cookie':cookie(token,8*60*60,new URL(req.url).protocol==='https:')}
    );
  }catch(e){
    return json({error:e.message||'Admin login failed'},401);
  }
};
