import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const ROOT = Deno.env.get("SUPABASE_URL") || "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CLIENT = Deno.env.get("EPOXY_GOOGLE_CLIENT_ID") || "";
const CLIENT_SECRET = Deno.env.get("EPOXY_GOOGLE_CLIENT_SECRET") || "";
const CALLBACK = ROOT + "/functions/v1/epoxy-gmail";
const RETURN_URL = "https://epoxycreations-crm.vercel.app/";
const GOOGLE_SCOPES = "openid email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly";
const senderLimitPerDay = 15;
const sb = createClient(ROOT, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ["https://epoxycreations-crm.vercel.app","http://localhost:5173"].includes(origin) ? origin : "https://epoxycreations-crm.vercel.app",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-epoxy-worker-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin"
  };
}
function json(req:Request, payload:unknown, code=200) {
  return new Response(JSON.stringify(payload), {status:code, headers:{"Content-Type":"application/json",...cors(req)}});
}
function redirect(status:string) {
  return Response.redirect(RETURN_URL + "?gmail=" + encodeURIComponent(status), 303);
}
function bytes64(bytes: Uint8Array) {
  let s = ""; for(let i=0;i<bytes.length;i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"");
}
function from64(s:string) {
  const raw=atob(s.replaceAll("-","+").replaceAll("_","/"));
  return Uint8Array.from(raw, c=>c.charCodeAt(0));
}
async function sha(value:string) {
  const a=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return Array.from(a,b=>b.toString(16).padStart(2,"0")).join("");
}
async function cryptoKey() {
  if (!KEY) throw new Error("Secure storage unavailable");
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("epoxy-gmail-credential-v1:"+KEY));
  return crypto.subtle.importKey("raw",digest,"AES-GCM",false,["encrypt","decrypt"]);
}
async function encrypt(value:string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await cryptoKey(),new TextEncoder().encode(value)));
  return bytes64(iv)+"."+bytes64(encrypted);
}
async function decrypt(value:string) {
  const [a,b]=value.split(".");
  if (!a||!b) throw new Error("Credential data invalid");
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:from64(a)},await cryptoKey(),from64(b)));
}
async function authorize(req:Request, workspaceId:string, admin=false) {
  const header=req.headers.get("authorization")||"";
  if (!header.toLowerCase().startsWith("bearer ")) throw new Error("Sign in first");
  const {data:{user},error}=await sb.auth.getUser(header.slice(7));
  if(error||!user) throw new Error("Sign in first");
  const {data:member,error:memberErr}=await sb.from("epoxy_workspace_members").select("role").eq("workspace_id",workspaceId).eq("user_id",user.id).maybeSingle();
  if(memberErr||!member || (admin&&!["owner","admin"].includes(member.role))) throw new Error("Not authorized for this Epoxy workspace");
  return user;
}
async function refreshToken(workspaceId:string) {
  if(!CLIENT||!CLIENT_SECRET) throw new Error("Google OAuth configuration missing");
  const {data,error}=await sb.from("epoxy_gmail_credentials").select("refresh_token_cipher").eq("workspace_id",workspaceId).maybeSingle();
  if(error||!data) throw new Error("Gmail requires authorization");
  const refresh=await decrypt(data.refresh_token_cipher);
  const form=new URLSearchParams({client_id:CLIENT,client_secret:CLIENT_SECRET,refresh_token:refresh,grant_type:"refresh_token"});
  const res=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:form});
  const body=await res.json().catch(()=>({}));
  if(!res.ok||!body.access_token) throw new Error("Google authorization expired or was revoked");
  return String(body.access_token);
}
async function google(access:string,endpoint:string,options:RequestInit={}) {
  const res=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+endpoint,{...options,headers:{Authorization:"Bearer "+access,"Content-Type":"application/json",...(options.headers||{})}});
  const body=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error("Gmail request failed ("+res.status+")");
  return body;
}
function header(message:any,name:string) {
  return String((message.payload?.headers||[]).find((h:any)=>String(h.name).toLowerCase()===name.toLowerCase())?.value||"");
}
function emailFrom(value:string) {
  return (value.match(/<([^>]+)>/)?.[1]||value).trim().toLowerCase();
}
async function customerReplied(access:string,threadId:string,sender:string,after:number) {
  const thread=await google(access,"threads/"+encodeURIComponent(threadId)+"?format=metadata&metadataHeaders=From&metadataHeaders=Message-ID");
  return (thread.messages||[]).some((m:any)=>Number(m.internalDate||0)>after && emailFrom(header(m,"From"))!==sender.toLowerCase());
}
async function markReply(workspaceId:string,jobId:string) {
  const now=new Date().toISOString();
  const {data:latest}=await sb.from("epoxy_email_messages").select("id").eq("workspace_id",workspaceId).eq("job_id",jobId).eq("status","sent").order("sent_at",{ascending:false}).limit(1).maybeSingle();
  if(latest) await sb.from("epoxy_email_messages").update({status:"replied",replied_at:now,updated_at:now}).eq("id",latest.id).eq("status","sent");
  await sb.from("epoxy_email_messages").update({status:"cancelled",updated_at:now}).eq("workspace_id",workspaceId).eq("job_id",jobId).in("status",["scheduled","pending_review"]);
}
function sequence(name:string) {
  const first=String(name||"there").split(/\s+/)[0].replace(/[^\p{L}\p{N}'-]/gu,"").slice(0,35)||"there";
  const subject="Checking in about your epoxy flooring project";
  const base="\n\nThanks,\nEpoxy Creations\n\nIf you don't want more follow-ups, just reply stop.";
  return [
    {sequence_step:1,subject,body:"Hi "+first+",\n\nThis is the Epoxy Creations team. Just checking in about your epoxy flooring project. Are you still interested in moving forward, or is there anything we can clarify?"+base,days:0},
    {sequence_step:2,subject,body:"Hi "+first+",\n\nFollowing up on your epoxy flooring project. If you're still considering options, we can answer questions about the process or next steps."+base,days:2},
    {sequence_step:3,subject,body:"Hi "+first+",\n\nOne last check-in from Epoxy Creations about your flooring project. If your plans have changed, no problem. If you'd still like help, reply here and we'll follow up personally."+base,days:5}
  ];
}
function mime(to:string,from:string,subject:string,body:string,previousId:string|null) {
  const clean=(v:string)=>v.replace(/[\r\n]/g," ").trim();
  const lines=["From: "+clean(from),"To: "+clean(to),"Subject: "+clean(subject),"MIME-Version: 1.0","Content-Type: text/plain; charset=UTF-8","Content-Transfer-Encoding: 8bit"];
  if(previousId) lines.push("In-Reply-To: "+clean(previousId),"References: "+clean(previousId));
  return bytes64(new TextEncoder().encode(lines.join("\r\n")+"\r\n\r\n"+body.replace(/\r?\n/g,"\r\n")));
}
async function tick() {
  const now=new Date(),parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",hour:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(now);
  const weekday=parts.find(x=>x.type==="weekday")?.value, hour=Number(parts.find(x=>x.type==="hour")?.value);
  if(["Sat","Sun"].includes(weekday||"")||hour<9||hour>=18) return {ok:true,paused:"Outside weekday business hours"};
  const {data:due,error}=await sb.from("epoxy_email_messages").select("id,workspace_id,job_id,sequence_step,recipient_email,subject,body,scheduled_at").eq("status","scheduled").lte("scheduled_at",now.toISOString()).order("scheduled_at",{ascending:true}).limit(20);
  if(error) throw new Error("Could not read send queue");
  let sent=0,stopped=0,failed=0;
  for(const message of due||[]) {
    const {data:connection}=await sb.from("epoxy_email_connections").select("sender_email,status,sending_enabled").eq("workspace_id",message.workspace_id).maybeSingle();
    if(!connection||connection.status!=="connected"||!connection.sending_enabled) continue;
    const {data:job}=await sb.from("epoxy_jobs").select("stage,contact_id").eq("id",message.job_id).eq("workspace_id",message.workspace_id).maybeSingle();
    if(!job||job.stage!=="follow_up") {
      await sb.from("epoxy_email_messages").update({status:"cancelled",updated_at:now.toISOString()}).eq("job_id",message.job_id).in("status",["scheduled","pending_review"]);
      stopped++;continue;
    }
    const {data:contact}=await sb.from("epoxy_contacts").select("email").eq("id",job.contact_id).eq("workspace_id",message.workspace_id).maybeSingle();
    if(!contact||contact.email.toLowerCase()!==message.recipient_email.toLowerCase()) {
      await sb.from("epoxy_email_messages").update({status:"cancelled",last_error:"Lead email was changed",updated_at:now.toISOString()}).eq("id",message.id);
      stopped++;continue;
    }
    const {count}=await sb.from("epoxy_email_messages").select("id",{count:"exact",head:true}).eq("workspace_id",message.workspace_id).in("status",["sent","replied"]).gte("sent_at",new Date(now.getTime()-24*60*60*1000).toISOString());
    if((count||0)>=senderLimitPerDay) continue;
    const {data:earlier}=await sb.from("epoxy_email_messages").select("status,provider_thread_id,provider_rfc_message_id,sent_at").eq("workspace_id",message.workspace_id).eq("job_id",message.job_id).lt("sequence_step",message.sequence_step).order("sequence_step",{ascending:false});
    if((earlier||[]).some((x:any)=>x.status==="replied"||x.status==="opted_out")) {await markReply(message.workspace_id,message.job_id);stopped++;continue;}
    if(message.sequence_step>1 && (!earlier?.length||earlier[0].status!=="sent")) continue;
    try {
      const access=await refreshToken(message.workspace_id);
      const firstSent=(earlier||[]).filter((m:any)=>m.sent_at).map((m:any)=>new Date(m.sent_at).getTime()).sort()[0];
      const parent=earlier?.find((m:any)=>m.provider_thread_id);
      if(parent?.provider_thread_id && await customerReplied(access,parent.provider_thread_id,connection.sender_email,firstSent||0)) {
        await markReply(message.workspace_id,message.job_id);stopped++;continue;
      }
      const {data:claimed}=await sb.from("epoxy_email_messages").update({status:"sending",attempted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",message.id).eq("status","scheduled").select("id").maybeSingle();
      if(!claimed) continue;
      try {
        const raw=mime(message.recipient_email,connection.sender_email,message.subject,message.body,earlier?.[0]?.provider_rfc_message_id||null);
        const payload:any={raw};
        if(parent?.provider_thread_id) payload.threadId=parent.provider_thread_id;
        const send=await google(access,"messages/send",{method:"POST",body:JSON.stringify(payload)});
        let rfc="";
        try {const metadata=await google(access,"messages/"+encodeURIComponent(send.id)+"?format=metadata&metadataHeaders=Message-ID");rfc=header(metadata,"Message-ID");}catch(_){}
        await sb.from("epoxy_email_messages").update({status:"sent",sent_at:new Date().toISOString(),provider_message_id:send.id,provider_thread_id:send.threadId,provider_rfc_message_id:rfc,last_error:"",updated_at:new Date().toISOString()}).eq("id",message.id).eq("status","sending");
        sent++;
      }catch(e) {
        await sb.from("epoxy_email_messages").update({status:"failed",last_error:String((e as Error).message||"Send could not be confirmed").slice(0,200),updated_at:new Date().toISOString()}).eq("id",message.id).eq("status","sending");
        failed++;
      }
    } catch(e) {
      await sb.from("epoxy_email_connections").update({status:"error",sending_enabled:false,last_error:String((e as Error).message).slice(0,200),updated_at:new Date().toISOString()}).eq("workspace_id",message.workspace_id);
      failed++;
    }
  }
  // Scan recently sent threads even when no new message is due.
  const {data:sentMessages}=await sb.from("epoxy_email_messages").select("workspace_id,job_id,provider_thread_id,sent_at").eq("status","sent").not("provider_thread_id","is",null).gte("sent_at",new Date(Date.now()-30*24*60*60*1000).toISOString()).limit(40);
  const seen=new Set<string>();
  for(const m of sentMessages||[]) {
    const id=m.workspace_id+":"+m.job_id;
    if(seen.has(id)) continue;seen.add(id);
    const {data:c}=await sb.from("epoxy_email_connections").select("sender_email,status").eq("workspace_id",m.workspace_id).maybeSingle();
    if(c?.status!=="connected") continue;
    try {const access=await refreshToken(m.workspace_id);if(await customerReplied(access,m.provider_thread_id,c.sender_email,new Date(m.sent_at).getTime())) {await markReply(m.workspace_id,m.job_id);stopped++;}}catch(_){}
  }
  return {ok:true,sent,stopped,failed};
}
Deno.serve(async (req:Request)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors(req)});
  const url=new URL(req.url);
  if(req.method==="GET"&&url.searchParams.has("error")) return redirect("authorization-cancelled");
  if(req.method==="GET"&&url.searchParams.has("code")) {
    try {
      const code=url.searchParams.get("code")||"", state=url.searchParams.get("state")||"";
      if(!CLIENT||!CLIENT_SECRET||!state) return redirect("configuration-needed");
      const {data:row}=await sb.from("epoxy_gmail_oauth_states").delete().eq("state_hash",await sha(state)).gt("expires_at",new Date().toISOString()).select("workspace_id").maybeSingle();
      if(!row) return redirect("authorization-expired");
      const token=await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({client_id:CLIENT,client_secret:CLIENT_SECRET,code,redirect_uri:CALLBACK,grant_type:"authorization_code"})});
      const body=await token.json().catch(()=>({}));
      if(!token.ok||!body.access_token||!body.refresh_token) return redirect("authorization-failed");
      const profile=await google(body.access_token,"profile");
      if(!profile.emailAddress||!String(profile.emailAddress).includes("@")) return redirect("authorization-failed");
      const encrypted=await encrypt(String(body.refresh_token));
      const {error:credsError}=await sb.from("epoxy_gmail_credentials").upsert({workspace_id:row.workspace_id,refresh_token_cipher:encrypted,updated_at:new Date().toISOString()},{onConflict:"workspace_id"});
      if(credsError) return redirect("authorization-failed");
      const {error:connError}=await sb.from("epoxy_email_connections").upsert({workspace_id:row.workspace_id,sender_email:profile.emailAddress,status:"connected",sending_enabled:false,last_checked_at:new Date().toISOString(),last_error:"",updated_at:new Date().toISOString()},{onConflict:"workspace_id"});
      if(connError) return redirect("authorization-failed");
      return redirect("connected");
    } catch(_) {return redirect("authorization-failed");}
  }
  if(req.method!=="POST") return json(req,{error:"POST required"},405);
  let b:any={};try{b=await req.json();}catch(_){return json(req,{error:"Invalid JSON"},400);}
  if(b.action==="tick") {
    const {data:config}=await sb.from("epoxy_gmail_worker_config").select("secret").eq("id",true).maybeSingle();
    const secret=req.headers.get("x-epoxy-worker-key")||"";
    if(!config||secret.length<32||secret!==config.secret) return json(req,{error:"Unauthorized"},401);
    try{return json(req,await tick());}catch(_){return json(req,{error:"Worker failed"},500);}
  }
  const workspaceId=String(b.workspace_id||"");
  if(!/^[a-f0-9-]{36}$/i.test(workspaceId)) return json(req,{error:"Invalid workspace"},400);
  try {
    await authorize(req,workspaceId,true);
    if(b.action==="start") {
      if(!CLIENT||!CLIENT_SECRET) return json(req,{error:"Google OAuth credentials are not configured. Ignite Co needs to finish Google Cloud setup."},503);
      const token=bytes64(crypto.getRandomValues(new Uint8Array(32)));
      const {data:{user}}=await sb.auth.getUser((req.headers.get("authorization")||"").slice(7));
      const {error}=await sb.from("epoxy_gmail_oauth_states").insert({state_hash:await sha(token),workspace_id:workspaceId,user_id:user!.id,expires_at:new Date(Date.now()+10*60*1000).toISOString()});
      if(error) throw new Error("Could not start authorization");
      const params=new URLSearchParams({client_id:CLIENT,redirect_uri:CALLBACK,response_type:"code",access_type:"offline",prompt:"consent",scope:GOOGLE_SCOPES,state:token});
      return json(req,{url:"https://accounts.google.com/o/oauth2/v2/auth?"+params.toString()});
    }
    if(b.action==="enable"||b.action==="disable") {
      if(b.action==="enable") {
        const {data:connection}=await sb.from("epoxy_email_connections").select("status").eq("workspace_id",workspaceId).maybeSingle();
        const {data:creds}=await sb.from("epoxy_gmail_credentials").select("workspace_id").eq("workspace_id",workspaceId).maybeSingle();
        if(connection?.status!=="connected"||!creds) return json(req,{error:"Connect Gmail before enabling"},409);
        await refreshToken(workspaceId);
      }
      const {error}=await sb.from("epoxy_email_connections").update({sending_enabled:b.action==="enable",updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId);
      if(error) throw new Error("Could not update sender status");
      return json(req,{ok:true,enabled:b.action==="enable"});
    }
    if(b.action==="enroll") {
      const jobId=String(b.job_id||"");
      const {data:connection}=await sb.from("epoxy_email_connections").select("status,sending_enabled").eq("workspace_id",workspaceId).maybeSingle();
      if(!connection?.sending_enabled||connection.status!=="connected") return json(req,{error:"Enable sending before enrolling a lead"},409);
      const {data:job}=await sb.from("epoxy_jobs").select("id,stage,contact_id").eq("workspace_id",workspaceId).eq("id",jobId).maybeSingle();
      if(!job||job.stage!=="follow_up") return json(req,{error:"The lead must be in Follow Up"},409);
      const {data:contact}=await sb.from("epoxy_contacts").select("name,email").eq("workspace_id",workspaceId).eq("id",job.contact_id).maybeSingle();
      if(!contact?.email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) return json(req,{error:"Lead needs a valid email address"},409);
      const rows=sequence(contact.name).map(x=>({workspace_id:workspaceId,job_id:jobId,sequence_step:x.sequence_step,recipient_email:contact.email,subject:x.subject,body:x.body,status:"scheduled",scheduled_at:new Date(Date.now()+x.days*86400000).toISOString()}));
      const {error}=await sb.from("epoxy_email_messages").upsert(rows,{onConflict:"workspace_id,job_id,sequence_step",ignoreDuplicates:true});
      if(error) throw new Error("Unable to queue follow-ups");
      return json(req,{ok:true,queued:3});
    }
    if(b.action==="disconnect") {
      await sb.from("epoxy_email_connections").update({status:"disconnected",sending_enabled:false,updated_at:new Date().toISOString()}).eq("workspace_id",workspaceId);
      await sb.from("epoxy_gmail_credentials").delete().eq("workspace_id",workspaceId);
      await sb.from("epoxy_email_messages").update({status:"cancelled"}).eq("workspace_id",workspaceId).in("status",["scheduled","pending_review"]);
      return json(req,{ok:true});
    }
    return json(req,{error:"Unknown action"},400);
  } catch(e) {return json(req,{error:String((e as Error).message||"Request failed").slice(0,250)},403);}
});
