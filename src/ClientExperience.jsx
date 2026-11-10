import React, { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, ListTodo, Mail, MapPin, Phone, Plus, X } from "lucide-react";
import "./ClientExperience.css";

const stageNext={
 new:"New inquiry. Call or email the customer, then move to Contacted.",
 contacted:"You've reached out. Schedule an estimate visit to move to Estimate Booked.",
 estimate_booked:"The estimate visit is booked. Attend, prepare the quote, then move to Estimate Sent when sent.",
 estimate_sent:"The quote has been sent. Move to Follow Up when you need to check on their decision.",
 follow_up:"Follow up with the customer on their quote. If approved, schedule the installation and move to Job Booked.",
 booked:"The installation is confirmed. Verify the job date, then mark Complete when the work is finished.",
 completed:"The job is complete. Keep the final value and notes accurate.",
 lost:"Opportunity lost. No further action unless the customer returns."
};
const money=value=>value==null?"Not quoted":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(value)||0);
const dateText=value=>value?new Date(value).toLocaleDateString("en-US",{month:"short",day:"numeric"}):"Not scheduled";
const toLocalDateTime=value=>{
 if(!value)return "";
 const d=new Date(value);if(Number.isNaN(d.getTime()))return "";
 const pad=n=>String(n).padStart(2,"0");
 return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-")+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
};
const appointmentTitle=job=>job.appointment_type==="estimate"?"Estimate Visit":job.appointment_type==="job"?"Active Job":"Type not set";

export function TodayPriorities({jobs=[],contacts=[],tasks=[],onLead,onTask,onComplete,onNavigate,onNewReminder}){
 const byId=new Map(contacts.map(c=>[c.id,c]));
 const waiting=jobs.filter(j=>j.stage==="new").sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
 const pending=tasks.filter(t=>!t.completed).sort((a,b)=>new Date(a.due_at||0)-new Date(b.due_at||0));
 const overdue=pending.filter(t=>t.due_at&&new Date(t.due_at).getTime()<Date.now());
 const estimates=jobs.filter(j=>j.stage==="estimate_sent");
 const upcoming=jobs.filter(j=>j.stage!=="lost"&&j.scheduled_at&&new Date(j.scheduled_at).getTime()>=Date.now()).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
 return <section className="today-board" aria-label="Today's priorities">
  <div className="today-top"><div><span className="today-kicker">YOUR DAILY WORKLIST</span><h2>Here's what needs your attention</h2><p>Start with a follow-up or new inquiry. Nothing here is automatically marked as contacted.</p></div><button type="button" onClick={onNewReminder}><Plus size={16}/> Reminder</button></div>
  <div className="today-counts">
   <button type="button" onClick={()=>onNavigate("tasks")}><span>Open reminders</span><strong>{pending.length}</strong><small>{overdue.length?overdue.length+" overdue":"View follow-ups"} <ArrowRight size={12}/></small></button>
   <button type="button" onClick={()=>onNavigate("pipeline")}><span>New leads</span><strong>{waiting.length}</strong><small>Incoming inquiries <ArrowRight size={12}/></small></button>
   <button type="button" onClick={()=>onNavigate("estimates")}><span>Estimates awaiting reply</span><strong>{estimates.length}</strong><small>Quotes to check <ArrowRight size={12}/></small></button>
   <button type="button" onClick={()=>onNavigate("calendar")}><span>Upcoming appointments</span><strong>{upcoming.length}</strong><small>Estimates and jobs <ArrowRight size={12}/></small></button>
  </div>
  <div className="today-work">
   <div className="today-work-group"><div className="today-group-head"><h3><ListTodo size={18}/> Follow up next</h3><button onClick={()=>onNavigate("tasks")}>See all <ArrowRight size={15}/></button></div>
    {pending.length?pending.slice(0,3).map(t=><div className="today-task" key={t.id}>
      <button type="button" className="today-task-check" aria-label={"Mark "+t.title+" done"} onClick={()=>onComplete(t)}><Check size={14}/></button>
      <div className="today-task-copy"><strong>{t.title}</strong><span>{byId.get(t.contact_id)?.name||"Customer follow-up"} · {t.due_at?"Due "+dateText(t.due_at):"Date not set"}{t.due_at&&new Date(t.due_at).getTime()<Date.now()?" · Overdue":""}</span></div>
      <button className="today-open" type="button" onClick={()=>onTask(t)} aria-label={"Edit "+t.title}><ArrowUpRight size={17}/></button>
     </div>):<p className="today-empty">No open reminders. Add one after your next customer call.</p>}
   </div>
   <div className="today-work-group"><div className="today-group-head"><h3><Phone size={18}/> New inquiries</h3><button onClick={()=>onNavigate("pipeline")}>See all <ArrowRight size={15}/></button></div>
    {waiting.length?waiting.slice(0,3).map(j=><button type="button" className="today-lead" key={j.id} onClick={()=>onLead(j)}>
      <div><strong>{byId.get(j.contact_id)?.name||"Customer"}</strong><span>{j.service||"Epoxy flooring"} · {dateText(j.created_at)}</span></div><ArrowUpRight size={17}/>
     </button>):<p className="today-empty">No new inquiries waiting.</p>}
   </div>
  </div>
 </section>;
}

export function QuickLeadView({job,contact={},stages=[],saving=false,onClose,onStage,onNotes,onReminder,onEdit,onSchedule}){
 const [notes,setNotes]=useState(job.notes||"");
 const [bookingKind,setBookingKind]=useState(job.appointment_type||"");
 const [bookingTime,setBookingTime]=useState(toLocalDateTime(job.scheduled_at));
 useEffect(()=>setNotes(job.notes||""),[job.id,job.notes]);
 useEffect(()=>{setBookingKind(job.appointment_type||"");setBookingTime(toLocalDateTime(job.scheduled_at));},[job.id,job.appointment_type,job.scheduled_at]);
 const info=job.lead_details||{};
 return <div className="quick-view" role="dialog" aria-modal="true" aria-label={"Customer details for "+(contact.name||"customer")}>
  <div className="quick-head"><div><span>LEAD DETAILS</span><h2>{contact.name||"Customer"}</h2><p>{job.service||"Epoxy flooring"}</p></div><button type="button" className="quick-close" onClick={onClose} aria-label="Close customer details"><X size={20}/></button></div>
  <div className="quick-body">
   <div className="quick-contact-actions">
    {contact.phone?<a href={"tel:"+contact.phone}><Phone size={17}/> Call</a>:<span className="quick-unavailable">Phone not provided</span>}
    {contact.email?<a href={"mailto:"+contact.email}><Mail size={17}/> Email</a>:<span className="quick-unavailable">Email not provided</span>}
   </div>
   <div className="quick-next"><strong>Next step</strong><p>{stageNext[job.stage]||"Review the customer and update their status."}</p></div>
   <label className="quick-stage-label">Customer status
    <select value={job.stage||"new"} disabled={saving} onChange={e=>onStage(job,e.target.value)}>
      {stages.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
    </select>
   </label>
   <div className="quick-booking" aria-label="Schedule an appointment for this lead">
     <div className="quick-booking-head"><strong><CalendarDays size={17}/> Schedule on calendar</strong><p>Choose the visit type first. An estimate does not mean the installation job is booked.</p></div>
     {job.scheduled_at&&<div className={"quick-existing-booking quick-existing-"+(job.appointment_type||"unknown")}>
       Current booking: <strong>{appointmentTitle(job)}</strong> · {new Date(job.scheduled_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
       {!job.appointment_type&&<span> Select the type below to classify this older booking.</span>}
     </div>}
     <div className="quick-booking-options" role="group" aria-label="Type of appointment">
       <button type="button" className={bookingKind==="estimate"?"is-selected estimate-selected":""} aria-pressed={bookingKind==="estimate"} onClick={()=>setBookingKind("estimate")}><ClipboardList size={17}/><span>Estimate Visit<small>Measure, inspect or quote</small></span></button>
       <button type="button" className={bookingKind==="job"?"is-selected job-selected":""} aria-pressed={bookingKind==="job"} onClick={()=>setBookingKind("job")}><CheckCircle2 size={17}/><span>Active Job<small>Confirmed installation</small></span></button>
     </div>
     <label className="quick-booking-time">Date and time
       <input type="datetime-local" value={bookingTime} onChange={e=>setBookingTime(e.target.value)}/>
     </label>
     <button type="button" className="quick-booking-save" disabled={saving||!bookingKind||!bookingTime} onClick={()=>onSchedule?.(job,bookingKind,bookingTime)}>
       <CalendarDays size={17}/>{saving?"Saving booking…":"Save to CRM calendar"}
     </button>
     <p className="quick-booking-hint">Estimate Visit moves the lead to Estimate Booked. Active Job moves it to Job Booked. Both appear in the CRM calendar, not Google Calendar.</p>
   </div>
   <div className="quick-detail-grid">
    <div><span>Project</span><strong>{job.service||"Epoxy flooring"}</strong></div>
    <div><span>Timeline</span><strong>{info.timeline||"Not provided"}</strong></div>
    <div><span>Finish</span><strong>{info.finish_type||"Not provided"}</strong></div>
    <div><span>Size</span><strong>{info.approx_size||"Not provided"}</strong></div>
    <div><span>ZIP code</span><strong>{info.zip||"Not provided"}</strong></div>
    <div><span>Quote</span><strong>{money(job.estimate_amount)}</strong></div>
   </div>
   {contact.phone&&<p className="quick-detail-line"><Phone size={15}/> {contact.phone}</p>}
   {contact.email&&<p className="quick-detail-line"><Mail size={15}/> {contact.email}</p>}
   {(job.pickup_address||contact.address)&&<p className="quick-detail-line"><MapPin size={15}/> {job.pickup_address||contact.address}</p>}
   <label className="quick-note-label">Latest contact note
    <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Called, left voicemail, customer asked for a quote…"/>
   </label>
   <button type="button" className="quick-save" disabled={saving||notes===(job.notes||"")} onClick={()=>onNotes(job,notes)}><CheckCircle2 size={17}/> {saving?"Saving…":"Save note"}</button>
  </div>
  <div className="quick-foot">
    <button type="button" onClick={()=>onReminder(job)}><ListTodo size={16}/> Add follow-up</button>
    <button type="button" onClick={()=>onEdit(job)}><CalendarDays size={16}/> More details</button>
  </div>
 </div>;
}

const guideSteps=[
 {title:"Review a new inquiry",body:"Open Leads. Facebook inquiries arrive in New Leads. Check the project and contact the customer, then update the status.",tab:"pipeline",cta:"Go to Leads"},
 {title:"Record your conversation",body:"Tap a customer's name, call or email them, then save a short note and update their status. You do not need the full edit form.",tab:"pipeline",cta:"View customers"},
 {title:"Plan the next action",body:"Schedule an Estimate Visit to reach Estimate Booked. After sending the quote, select Estimate Sent, then Follow Up. A confirmed installation is Job Booked.",tab:"pipeline",cta:"Open Leads"}
];
export function OnboardingGuide({onNavigate,onFinish}){
 const [step,setStep]=useState(0);
 const item=guideSteps[step];
 return <section className="intro-guide" aria-label="Getting started guide">
   <div className="intro-top"><span>GET STARTED · STEP {step+1} OF 3</span><button type="button" onClick={onFinish} aria-label="Skip guide"><X size={18}/> Skip</button></div>
   <div className="intro-progress"><span style={{width:((step+1)/3*100)+"%"}}/></div>
   <h2>{item.title}</h2><p>{item.body}</p>
   <div className="intro-actions">
    <button type="button" className="intro-try" onClick={()=>onNavigate(item.tab)}>{item.cta} <ArrowUpRight size={15}/></button>
    {step>0&&<button type="button" className="intro-prev" onClick={()=>setStep(s=>s-1)}><ChevronLeft size={15}/> Back</button>}
    <button type="button" className="intro-next" onClick={()=>step<2?setStep(s=>s+1):onFinish()}>{step===2?"Finish guide":"Next"} {step<2?<ChevronRight size={15}/>:<Check size={15}/>}</button>
   </div>
 </section>;
}
