import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Mail, Phone, RefreshCw, Search, ShieldCheck, ListTodo, CirclePause, Clock3 } from "lucide-react";
import "./FollowUpCenter.css";

const STEPS = [
 { step:1, title:"First response", when:"After a new lead comes in", help:"A personal email based on the customer's project" },
 { step:2, title:"Friendly reminder", when:"2 days later, only if they have not replied", help:"A short, helpful follow-up, not a copy of the first email" },
 { step:3, title:"Last check-in", when:"5 days after the first email, only if they have not replied", help:"A final polite check-in before the sequence stops" }
];
const LABELS={draft:"Draft",pending_review:"Waiting for approval",scheduled:"Scheduled",sent:"Sent",replied:"Customer replied",failed:"Needs attention",paused:"Paused",cancelled:"Cancelled",opted_out:"Unsubscribed"};
const day=value=>value?new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"";
const clean=value=>String(value||"").trim();
const emailStatus=(messages,connected)=>{
 if(messages.some(m=>m.status==="failed"))return {label:"Needs attention",type:"bad"};
 if(messages.some(m=>m.status==="replied"))return {label:"Customer replied",type:"good"};
 if(messages.some(m=>m.status==="opted_out"))return {label:"Unsubscribed",type:"muted"};
 if(messages.some(m=>m.status==="pending_review"))return {label:"Review email",type:"warn"};
 if(messages.some(m=>m.status==="sent"))return {label:"Email sent",type:"good"};
 if(messages.some(m=>m.status==="scheduled"))return {label:"Next email scheduled",type:"warn"};
 if(messages.some(m=>m.status==="paused"))return {label:"Paused",type:"muted"};
 if(messages.some(m=>m.status==="draft"))return {label:"Draft ready",type:"warn"};
 return connected?{label:"Not enrolled",type:"muted"}:{label:"Email setup needed",type:"muted"};
};
const Status=({label,type="muted"})=><span className={"fu-status fu-"+type}>{label}</span>;

export default function FollowUpCenter({db,workspaceId,jobs=[],contacts=[],tasks=[],onAddReminder,onEditReminder,onCompleteReminder,onOpenLead,onRefresh,onNewReminder,mode="customers"}) {
 const [connection,setConnection]=useState(null);
 const [messages,setMessages]=useState([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [filter,setFilter]=useState("all");
 const [expanded,setExpanded]=useState(null);
 const [limit,setLimit]=useState(20);
 const [manualLimit,setManualLimit]=useState(8);
 const load=async()=>{
  if(!db||!workspaceId)return;
  setLoading(true);setError("");
  try{
   const [a,b]=await Promise.all([
    db.from("epoxy_email_connections").select("sender_email,status,sending_enabled,last_checked_at,last_error").eq("workspace_id",workspaceId).maybeSingle(),
    db.from("epoxy_email_messages").select("id,job_id,sequence_step,recipient_email,subject,body,status,scheduled_at,sent_at,replied_at,last_error,created_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false})
   ]);
   if(a.error)throw a.error;
   if(b.error)throw b.error;
   setConnection(a.data);setMessages(b.data||[]);
  }catch(err){setError("Email activity could not be loaded. Please refresh or contact Ignite Co.");}
  finally{setLoading(false);}
 };
 useEffect(()=>{load();},[workspaceId,db]);
 const connected=connection?.status==="connected";
 const sending=connected&&connection?.sending_enabled===true;
 const byId=useMemo(()=>new Map(contacts.map(c=>[c.id,c])),[contacts]);
 const grouped=useMemo(()=>{const m=new Map();messages.forEach(x=>{if(!m.has(x.job_id))m.set(x.job_id,[]);m.get(x.job_id).push(x);});return m;},[messages]);
 const leadRows=useMemo(()=>jobs.map(job=>{
  const contact=byId.get(job.contact_id)||{};
  const history=grouped.get(job.id)||[];
  return {job,contact,history,state:emailStatus(history,connected)};
 }),[jobs,byId,grouped,connected]);
 const problems=messages.filter(m=>m.status==="failed"||m.status==="pending_review").length;
 const sent=messages.filter(m=>m.status==="sent"||m.status==="replied").length;
 const replies=messages.filter(m=>m.status==="replied").length;
 const list=leadRows.filter(({job,contact,history,state})=>{
  const q=search.toLowerCase().trim();
  if(q&&![contact.name,contact.email,contact.phone,job.service,job.notes,job.lead_details?.finish_type,job.lead_details?.timeline].join(" ").toLowerCase().includes(q))return false;
  if(filter==="attention")return history.some(m=>["failed","pending_review"].includes(m.status));
  if(filter==="sent")return history.some(m=>["sent","replied"].includes(m.status));
  if(filter==="replies")return history.some(m=>m.status==="replied");
  if(filter==="not_started")return history.length===0;
  return true;
 }).sort((a,b)=>new Date(b.job.created_at||0)-new Date(a.job.created_at||0));
 const remindersFor=id=>tasks.filter(t=>t.job_id===id);
 const manualTasks=tasks.filter(t=>!t.completed).sort((a,b)=>new Date(a.due_at||0)-new Date(b.due_at||0));
 const manualPending=manualTasks.length;
 return <div className="fu-page">
   {mode==="customers"&&<section className="fu-section fu-manual" aria-label="Manual follow-up priorities">
    <div className="fu-manual-header"><div><h2>Reminders to handle</h2><p>{manualPending} open reminders. Mark one done after contacting the customer.</p></div><button type="button" onClick={()=>onNewReminder?.()}><ListTodo size={16}/> New reminder</button></div>
    {manualTasks.length?manualTasks.slice(0,manualLimit).map(t=>{
      const contact=byId.get(t.contact_id),overdue=t.due_at&&new Date(t.due_at).getTime()<Date.now();
      return <div className="fu-manual-item" key={t.id}><div><strong>{t.title}</strong><span className={overdue?"is-overdue":""}>{contact?.name||"Customer"} · {t.due_at?(overdue?"Overdue · ":"Due ")+day(t.due_at):"No due date"}</span></div>
       <button type="button" onClick={()=>onEditReminder?.(t)}>Edit</button><button type="button" onClick={()=>onCompleteReminder?.(t)}><CheckCircle2 size={14}/> Done</button></div>;
    }):<p className="fu-manual-empty">All clear. Add a reminder after your next customer conversation.</p>}
    {manualPending>manualLimit&&<button type="button" className="fu-button fu-button-more" onClick={()=>setManualLimit(n=>n+8)}>Show more reminders ({manualPending-manualLimit} remaining)</button>}
   </section>}
   {mode==="automation"&&<>
   <section className="fu-hero" aria-label="Email system status">
     <div className="fu-hero-top"><div><p className="fu-eyebrow">FOLLOW-UP CONTROL CENTER</p><h2>Know exactly who was contacted.</h2><p>See every email, every reply, and what needs your attention.</p></div>
      <button className="fu-button fu-button-white" type="button" onClick={()=>{load();onRefresh?.();}} disabled={loading}><RefreshCw size={19}/>{loading?"Checking…":"Check for updates"}</button>
     </div>
     <div className="fu-health">
       <div><span>Email account</span><strong>{connected?"Connected":connection?.status==="error"?"Problem with connection":"Not connected"}</strong><small>{connected?connection.sender_email:"Jeremy must authorize his Gmail"}</small></div>
       <div><span>AI email sending</span><strong>{sending?"Enabled":"Not active"}</strong><small>{sending?"Sending is permitted":"No automatic emails will be sent"}</small></div>
       <div><span>Email activity</span><strong>{problems?problems+" to review":sent+" sent"}</strong><small>{replies} replies recorded</small></div>
     </div>
   </section>
   {!sending&&<div className="fu-alert" role="status"><CirclePause size={24}/><div><strong>Automatic emails are not running yet.</strong><p>The CRM is ready to show the sequence and real delivery history. The business Gmail, AI generation and sending workflow still need to be connected and tested. No emails are being sent by this screen.</p></div></div>}
   {error&&<div className="fu-alert fu-error" role="alert"><AlertCircle size={22}/><span>{error}</span></div>}
   <section className="fu-section" aria-label="Planned sequence">
    <div className="fu-section-head"><div><h2>The 3-email follow-up plan</h2><p>Each email will use what the customer wrote in their form. Replies and unsubscribe requests must stop later messages.</p></div><Status type={sending?"good":"warn"} label={sending?"Connection enabled":"Planned, not active"}/></div>
    <div className="fu-steps">{STEPS.map(s=><div className="fu-step" key={s.step}><div className="fu-step-number">{s.step}</div><div><strong>{s.title}</strong><span>{s.when}</span><p>{s.help}</p></div></div>)}</div>
    <p className="fu-safe"><ShieldCheck size={18}/> Start with human approval of each AI-generated message. Only enable automatic sending after Jeremy approves the wording, sending rules, and opt-out handling.</p>
   </section>
   </>}
   {mode==="customers"&&<section className="fu-section" aria-label="Customer email and reminder activity">
     <div className="fu-section-head"><div><h2>Customer follow-ups</h2><p>{jobs.length} lead records. Open a customer for reminders and email activity.</p></div></div>
     <div className="fu-tools">
       <label className="fu-search"><Search size={21}/><span className="fu-sr-only">Find a customer</span><input value={search} onChange={e=>{setSearch(e.target.value);setLimit(20);}} placeholder="Search customer name or project"/></label>
       <label className="fu-select-label">Show<select value={filter} onChange={e=>{setFilter(e.target.value);setLimit(20);}}><option value="all">All customers</option><option value="attention">Needs attention</option><option value="sent">Emails sent</option><option value="replies">Customer replies</option><option value="not_started">No emails yet</option></select></label>
     </div>
     <div className="fu-list">
      {list.slice(0,limit).map(({job,contact,history,state})=>{
       const open=expanded===job.id;
       const reminders=remindersFor(job.id);
       const notes=clean(job.notes);
       const details=job.lead_details||{};
       return <article className="fu-lead" key={job.id}>
        <div className="fu-lead-main">
         <div className="fu-lead-copy"><h3>{contact.name||"Unnamed customer"}</h3><p>{clean(job.service)||"Epoxy flooring"} · {day(job.created_at)}</p><Status label={state.label} type={state.type}/></div>
         <button type="button" className="fu-button fu-button-outline" onClick={()=>setExpanded(open?null:job.id)} aria-expanded={open}><span className="fu-view-long">{open?"Hide details":"View follow-up"}</span><span className="fu-view-short">{open?"Hide":"View"}</span>{open?<ChevronUp size={20}/>:<ChevronDown size={20}/>}</button>
        </div>
        {open&&<div className="fu-lead-expanded">
         <div className="fu-details"><h4>Customer's request</h4><div className="fu-detail-grid">
           <p><b>Finish</b><span>{details.finish_type||"Not provided"}</span></p>
           <p><b>Project size</b><span>{details.approx_size||"Not provided"}</span></p>
           <p><b>Timing</b><span>{details.timeline||"Not provided"}</span></p>
           <p><b>ZIP code</b><span>{details.zip||"Not provided"}</span></p>
          </div>{notes&&!/historical inquiry imported/i.test(notes)&&<p className="fu-notes"><b>Customer notes:</b> {notes}</p>}
          <div className="fu-contact-links">{contact.email&&<a href={"mailto:"+contact.email}><Mail size={18}/> Email customer</a>}{contact.phone&&<a href={"tel:"+contact.phone}><Phone size={18}/> Call customer</a>}</div>
         </div>
         <details className="fu-email-history"><summary>Email delivery history (optional)</summary><div className="fu-sequence"><h4>Email sequence and delivery</h4>
          {STEPS.map(s=>{const m=history.find(x=>x.sequence_step===s.step);return <div className="fu-email-step" key={s.step}>
           <div className="fu-email-step-top"><span className="fu-step-number">{s.step}</span><strong>{s.title}</strong><Status label={m?(LABELS[m.status]||m.status):"Not started"} type={m?.status==="failed"?"bad":["sent","replied"].includes(m?.status)?"good":["pending_review","scheduled"].includes(m?.status)?"warn":"muted"}/></div>
           {m?<div className="fu-message"><p><b>{m.subject||"No subject yet"}</b></p>{m.body&&<div className="fu-message-body">{m.body}</div>}<small>{m.sent_at?"Sent "+day(m.sent_at):m.scheduled_at?"Planned "+day(m.scheduled_at):"Not sent"}{m.last_error?" · Problem: "+m.last_error:""}</small></div>
             :<p className="fu-step-help">No email has been generated or sent for this step.</p>}
          </div>;})}
         </div></details>
         <div className="fu-reminders"><h4>Personal reminders</h4>
          {reminders.length?reminders.map(t=><div className="fu-reminder" key={t.id}><div><strong>{t.title}</strong><p>{t.completed?"Completed":"Due "+day(t.due_at)}</p>{t.notes&&<small>{t.notes}</small>}</div><div className="fu-reminder-actions"><button type="button" onClick={()=>onEditReminder?.(t)}>Edit</button><button type="button" onClick={()=>onCompleteReminder?.(t)}>{t.completed?"Reopen":"Mark done"}</button></div></div>)
          :<p className="fu-step-help">No personal reminders for this customer.</p>}
         </div>
         <div className="fu-actions"><button className="fu-button fu-button-primary" onClick={()=>onAddReminder?.(job)} type="button"><ListTodo size={19}/> Add a reminder</button><button className="fu-button fu-button-outline" onClick={()=>onOpenLead?.(job)} type="button">Open customer record</button></div>
        </div>}
       </article>;
      })}
      {!list.length&&<div className="fu-empty"><CheckCircle2 size={27}/><h3>No customers in this view</h3><p>Choose another filter or search for a different name.</p></div>}
     </div>
     {list.length>limit&&<button className="fu-button fu-button-more" type="button" onClick={()=>setLimit(n=>n+20)}>Show more customers ({list.length-limit} remaining)</button>}
   </section>}
 </div>;
}
