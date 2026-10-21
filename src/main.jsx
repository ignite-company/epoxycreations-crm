import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard, Users, ClipboardList, Kanban, CalendarDays, Settings, House,
  Plus, Search, Bell, ArrowUpRight, Phone, Mail, MapPin, Check,
  ChevronLeft, ChevronRight, ChevronDown, Menu, X, Clock, Truck, DollarSign,
  CircleCheck, Star, ExternalLink, Download, ShieldCheck, LogOut, Link2,
  CircleHelp, AlertCircle, ArrowRight, ListTodo, Pencil, Filter, RotateCcw,
  CalendarCheck2, CircleDot, Route, MapPinned, Navigation, ArrowUp, ArrowDown, Layers3
} from "lucide-react";
import "./styles.css";

const LOGO = "/logo.svg";
const MARK = "/mark.svg";
// Public Supabase client configuration. Vercel environment variables take precedence.
// This publishable key is designed for browser use; row-level security protects data.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const connected = Boolean(SUPABASE_URL && KEY);
const db = connected ? createClient(SUPABASE_URL, KEY) : null;
const DATA_TABLES={contacts:"epoxy_contacts",jobs:"epoxy_jobs",tasks:"epoxy_tasks",service_areas:"epoxy_service_areas"};
const STAGES = [
  { id: "imported", label: "Imported · review", color: "gray" },
  { id: "new", label: "New lead", color: "blue" },
  { id: "contacted", label: "Contacted", color: "gray" },
  { id: "estimate_sent", label: "Estimate sent", color: "orange" },
  { id: "booked", label: "Booked", color: "green" },
  { id: "completed", label: "Completed", color: "green" },
  { id: "lost", label: "Lost", color: "gray" }
];
const TABS = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "pipeline", label: "Lead pipeline", icon: Kanban },
  { id: "areas", label: "Service areas", icon: MapPinned },
  { id: "jobs", label: "Jobs & estimates", icon: ClipboardList },
  { id: "customers", label: "Customers", icon: Users },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "tasks", label: "Follow-ups", icon: ListTodo },
  { id: "settings", label: "Settings", icon: Settings }
];
const FOLLOW_UP_CATEGORIES = [
  {id:"follow_up",label:"Follow-up scheduled"},
  {id:"no_answer",label:"No answer, first attempt"},
  {id:"unresponsive",label:"Not responding"},
  {id:"waiting_on_customer",label:"Waiting on customer"}
];
const followCategory = id => FOLLOW_UP_CATEGORIES.find(c=>c.id===id)?.label||"Follow-up scheduled";
const leadReceived = value => value ? new Intl.DateTimeFormat("en-US",{
  timeZone:"America/New_York",weekday:"long",month:"short",day:"numeric",year:"numeric",
  hour:"numeric",minute:"2-digit",timeZoneName:"short"
}).format(new Date(value)) : "Unknown";
const leadAge=(value,now)=>{
  if(!value)return "";
  const ms=now-new Date(value).getTime();
  if(!Number.isFinite(ms))return "";
  if(ms<60000)return "Just now";
  const mins=Math.floor(ms/60000);
  if(mins<60)return mins+"m ago";
  const hrs=Math.floor(mins/60);
  if(hrs<24)return hrs+"h ago";
  const days=Math.floor(hrs/24);
  if(days<30)return days+"d ago";
  return Math.floor(days/30)+"mo ago";
};
const localDateTimeInput = value => {
  const d = new Date(value);
  const pad = n => String(n).padStart(2,"0");
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
};
const DAY = 86400000;
const dateOffset = (n) => new Date(Date.now() + n * DAY).toISOString();
// No synthetic customer records. Production requires a private customer database.
const samples={areas:[],contacts:[],jobs:[],tasks:[]};
function localRead(key) {
  // Purge earlier preview records so previous visitors don't see fake leads.
  try { localStorage.removeItem("epoxy_demo_"+key); } catch {}
  return [];
}
const money = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(Number(n)||0);
const shortDate = (n) => n ? new Date(n).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "Not scheduled";
const fullDate = (n) => n ? new Date(n).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "Not scheduled";
const dayLabel = (date) => new Date(date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const initials = (name) => (name||"?").split(" ").slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
const uuid = () => crypto.randomUUID();
const hasStreetAddress = a => Boolean(a && a.trim().length>=12 && /\d/.test(a) && !/^ZIP\s+\d{5}(?:-\d{4})?$/i.test(a.trim()));
const mapsUrl = a => "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(a);
const propertySearchUrl = a => "https://www.zillow.com/homes/"+encodeURIComponent(a.trim().replace(/[,\s]+/g,"-"))+"_rb/";
const redfinSearchUrl = a => "https://www.redfin.com/search?searchInput="+encodeURIComponent(a.trim());
const stageInfo = (stage) => STAGES.find(s=>s.id===stage) || STAGES[0];
const cssDate = (date) => date ? new Date(date).toLocaleDateString("en-CA") : "";
function csvDownload(rows,filename){
  const quote=v=>{const str=String(v??"");const guarded=/^[=+\-@\t\r]/.test(str)?"'"+str:str;return '"'+guarded.replace(/"/g,'""')+'"';};
  const csv=rows.map(row=>row.map(quote).join(",")).join("\r\n");
  const url=window.URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();window.URL.revokeObjectURL(url);
}

function parseLeadCSV(csv) {
 const rows=[];let row=[],cell="",quoted=false;
 const src=csv.replace(/^\uFEFF/,"");
 for(let i=0;i<src.length;i++){
  const ch=src[i];
  if(ch==='"'){if(quoted&&src[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(ch===","&&!quoted){row.push(cell);cell="";}
  else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&src[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell="";}
  else cell+=ch;
 }
 if(quoted)throw Error("CSV contains an unclosed quote.");
 row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const headers=(rows.shift()||[]).map(x=>x.trim().toLowerCase());
 const required=["name","phone","email","source_message_id","received_at"];
 for(const col of required)if(!headers.includes(col))throw Error("Missing required CSV column: "+col);
 return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,(values[i]||"").trim()])));
}

function Brand({ compact=false }){
 return <div className={"brand "+(compact?"brand-compact":"")}>
  <div className="brand-logo"><img src={MARK} alt="Epoxy Creations logo"/></div>
  {!compact && <div className="brand-copy"><b>Epoxy Creations</b><span>COMMAND CENTER</span></div>}
 </div>;
}
function Pill({stage}){const s=stageInfo(stage);return <span className={"pill pill-"+s.color}><span className="pill-dot"/>{s.label}</span>;}
function Empty({icon:Icon=CircleHelp,title,subtitle,action}){return <div className="empty-state"><div className="empty-icon"><Icon size={23}/></div><h3>{title}</h3><p>{subtitle}</p>{action}</div>;}
function Login({onLogin}){
 const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[message,setMessage]=useState("");const[loading,setLoading]=useState(false);
 async function submit(e){e.preventDefault();setLoading(true);setMessage("");const{error}=await db.auth.signInWithPassword({email,password});if(error)setMessage(error.message);else onLogin();setLoading(false);}
 return <div className="login-bg"><div className="login-card"><Brand/><div className="login-hero"><ShieldCheck size={32}/><h1>Welcome back</h1><p>Your customers, jobs and follow-ups, all in one place.</p></div><form onSubmit={submit} className="form-stack"><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="contact@ignitellc.co"/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label>{message&&<p className="error-text">{message}</p>}<button disabled={loading} className="btn btn-primary" type="submit">{loading?"Signing in…":"Sign in"}<ArrowRight size={17}/></button></form><p className="login-footnote">Sign in with your existing Ignite client portal account. Only approved Epoxy and Ignite users can access these records.</p></div></div>;
}
function App(){
 const[session,setSession]=useState(null);
 const[authLoading,setAuthLoading]=useState(connected);
 const[workspace,setWorkspace]=useState(null);
 const[loading,setLoading]=useState(connected);
 const[tab,setTab]=useState("dashboard");
 const[mobileNav,setMobileNav]=useState(false);
 const[contacts,setContacts]=useState(()=>connected?[]:localRead("contacts"));
 const[jobs,setJobs]=useState(()=>connected?[]:localRead("jobs"));
 const[tasks,setTasks]=useState(()=>connected?[]:localRead("tasks"));
 const[areas,setAreas]=useState(()=>connected?[]:localRead("areas"));
 const[areaFilter,setAreaFilter]=useState("all");
 const[routeDate,setRouteDate]=useState(()=>new Date().toLocaleDateString("en-CA"));
 const[query,setQuery]=useState("");
 const[importing,setImporting]=useState(false);
 const[importReport,setImportReport]=useState("");
 const[modal,setModal]=useState(null);
 const[form,setForm]=useState({});
 const[saving,setSaving]=useState(false);
 const[error,setError]=useState("");
 const[toast,setToast]=useState("");
 const[month,setMonth]=useState(new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const[selectedDay,setSelectedDay]=useState(null);
 const[propertyView,setPropertyView]=useState(null);
 const[recordView,setRecordView]=useState("jobs");
 const[recordFilter,setRecordFilter]=useState("all");
 const[taskCategoryFilter,setTaskCategoryFilter]=useState("all");
 const[now,setNow]=useState(Date.now());
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),60000);return()=>window.clearInterval(id);},[]);
 useEffect(()=>{if(!connected)return;db.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false);});const{data:{subscription}}=db.auth.onAuthStateChange((_ev,s)=>setSession(s));return()=>subscription.unsubscribe();},[]);
 useEffect(()=>{if(!connected){localStorage.setItem("epoxy_demo_contacts",JSON.stringify(contacts));}},[contacts]);
 useEffect(()=>{if(!connected){localStorage.setItem("epoxy_demo_jobs",JSON.stringify(jobs));}},[jobs]);
 useEffect(()=>{if(!connected){localStorage.setItem("epoxy_demo_tasks",JSON.stringify(tasks));}},[tasks]);
 useEffect(()=>{if(!connected){localStorage.setItem("epoxy_demo_areas",JSON.stringify(areas));}},[areas]);
 useEffect(()=>{if(connected&&session)reload();if(connected&&!session){setContacts([]);setJobs([]);setTasks([]);setAreas([]);setWorkspace(null);setLoading(false);}},[session?.user?.id]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(""),3800);return()=>clearTimeout(t);},[toast]);
 // Keep the open dashboard and pipeline fresh as new website forms arrive.
 useEffect(()=>{
   if(!connected||!session?.user?.id)return;
   const refresh=()=>{if(document.visibilityState==="visible")reload();};
   const timer=window.setInterval(refresh,20000);
   window.addEventListener("focus",refresh);
   return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);};
 },[session?.user?.id]);
 async function reload(){
  try{setLoading(true);setError("");
   const member=await db.from("epoxy_workspace_members").select("workspace_id,role,epoxy_workspaces(id,name,review_link)").eq("user_id",session.user.id).limit(1).maybeSingle();
   if(member.error)throw member.error;
   if(!member.data)throw Error("No workspace is assigned to this account. Contact the administrator.");
   setWorkspace(member.data);
   const [c,j,t,a]=await Promise.all(["contacts","jobs","tasks","service_areas"].map(table=>db.from(DATA_TABLES[table]||table).select("*").eq("workspace_id",member.data.workspace_id).order("created_at",{ascending:false})));
   for(const result of [c,j,t,a])if(result.error)throw result.error;
   setContacts(c.data||[]);setJobs(j.data||[]);setTasks(t.data||[]);setAreas(a.data||[]);
  }catch(e){setError(e.message||"Could not load business records.");}finally{setLoading(false);}
 }
 const person=(id)=>contacts.find(c=>c.id===id);
 const addressForJob=j=>{
  if(!j)return "";
  const own=(j.pickup_address||"").trim();
  if(hasStreetAddress(own))return own;
  const contact=person(j.contact_id);
  return hasStreetAddress(contact?.address||"")?contact.address.trim():"";
 };
 const draftAddress=j=>j?._addressEdited?(j.pickup_address||""):(j?.pickup_address||addressForJob(j));
 const selectedDayJobs=selectedDay?jobs.filter(j=>j.scheduled_at&&new Date(j.scheduled_at).toDateString()===selectedDay.toDateString()&&j.stage!=="lost").sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at)):[];
 function viewHouse(j){
  const address=addressForJob(j);
  if(!hasStreetAddress(address)){setToast("Save the job site address first.");return;}
  setPropertyView({address,customer:person(j.contact_id)?.name||"Customer"});
 }
 function closeProperty(){setPropertyView(null);}
 const filtered=(items,kind)=>{
  const text=query.trim().toLowerCase();if(!text)return items;
  return items.filter(v=>(kind==="contacts"?[v.name,v.phone,v.email,v.address]:[v.service,v.notes,v.source,person(v.contact_id)?.name,person(v.contact_id)?.phone]).filter(Boolean).join(" ").toLowerCase().includes(text));
 };
 // Pipeline stages are deliberately separated from the estimates and jobs ledger.
 const estimateRecords=jobs.filter(j=>j.stage==="estimate_sent"||(["new","contacted"].includes(j.stage)&&j.estimate_amount!=null));
 const workRecords=jobs.filter(j=>j.stage==="booked"||j.stage==="completed");
 const visibleRecords=filtered(recordView==="estimates"?estimateRecords:workRecords,"jobs").filter(j=>{
  if(recordFilter==="all")return true;
  if(recordView==="estimates")return recordFilter==="sent"?j.stage==="estimate_sent":j.stage!=="estimate_sent";
  return recordFilter==="scheduled"?j.stage==="booked":j.stage==="completed";
 });
 const activeJobs=jobs.filter(j=>j.stage!=="lost");
 const newLeads=jobs.filter(j=>j.stage==="new"||j.stage==="imported").length;
 const estimates=jobs.filter(j=>j.stage==="estimate_sent").length;
 const booked=jobs.filter(j=>j.stage==="booked").length;
 const revenue=jobs.filter(j=>j.stage==="completed").reduce((s,j)=>s+Number(j.final_amount??j.estimate_amount??0),0);
 const openTasks=tasks.filter(t=>!t.completed).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
 const visibleTasks=tasks.filter(t=>taskCategoryFilter==="all"||(t.category||"follow_up")===taskCategoryFilter);
 const filteredOpenTasks=visibleTasks.filter(t=>!t.completed).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
 const filteredDoneTasks=visibleTasks.filter(t=>t.completed);
 const completedCustomerIds=new Set(jobs.filter(j=>j.stage==="completed").map(j=>j.contact_id));
 const completedCustomers=contacts.filter(c=>completedCustomerIds.has(c.id));
 const upcomingJobs=jobs.filter(j=>j.stage==="booked"&&j.scheduled_at).sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at));
 function changeTab(id){setTab(id);setMobileNav(false);setQuery("");setSelectedDay(null);}
 function openModal(type,data={}){
  if(!connected){setToast("Secure customer storage must be connected before creating records.");return;}
  setError("");setForm(data);setModal(type);
 }
 function openFollowUpFromLead(job){
  const contact=person(job.contact_id);
  openModal("task",{
    title:"Follow up with "+(contact?.name||"lead"),
    category:"no_answer",contact_id:job.contact_id,job_id:job.id,
    notes:job.notes||contact?.notes||"",
    due_at:localDateTimeInput(Date.now()+DAY),
    completed:false
  });
 }
 async function upsert(table,payload,localSetter) {
  const data={...payload,id:payload.id||uuid()};
  if(connected){
   const out=await db.from(DATA_TABLES[table]||table).upsert({...data,workspace_id:workspace.workspace_id},{onConflict:"id"}).select().single();
   if(out.error)throw out.error;return out.data;
  }
  throw Error("Secure storage is not configured. Do not enter customer data here.");
  return data;
 }
 async function save(e){
  e.preventDefault();setSaving(true);setError("");
  try{
   if(modal==="lead"){
    const c=await upsert("contacts",{name:form.name.trim(),phone:form.phone||"",email:form.email||"",address:form.address||"",notes:form.contact_notes||"",created_at:new Date().toISOString()},setContacts);
    await upsert("jobs",{contact_id:c.id,service:form.service||"Epoxy flooring",source:form.source||"Website",pickup_address:hasStreetAddress(form.address)?form.address.trim():"",stage:"new",estimate_amount:null,final_amount:null,scheduled_at:null,notes:form.notes||"",route_zone:form.route_zone||"",visit_order:null,created_at:new Date().toISOString()},setJobs);
   }
   if(modal==="contact")await upsert("contacts",{id:form.id,name:form.name.trim(),phone:form.phone||"",email:form.email||"",address:form.address||"",notes:form.notes||""},setContacts);
   if(modal==="job"){
    const address=draftAddress(form).trim();
    await upsert("jobs",{id:form.id,contact_id:form.contact_id,service:form.service||"Epoxy flooring",source:form.source||"Other",pickup_address:address,stage:form.stage||"new",estimate_amount:form.estimate_amount===""||form.estimate_amount==null?null:Number(form.estimate_amount),final_amount:form.final_amount===""||form.final_amount==null?null:Number(form.final_amount),scheduled_at:form.scheduled_at?new Date(form.scheduled_at).toISOString():null,notes:form.notes||"",route_zone:form.route_zone||"",visit_order:form.visit_order??null,lead_details:form.lead_details||{},created_at:form.created_at||new Date().toISOString()},setJobs);
    // The contact record remembers the latest job site address, but each job keeps its own address.
    const existing=person(form.contact_id);
    if(existing&&hasStreetAddress(address)&&existing.address!==address){
      await upsert("contacts",{...existing,address},setContacts);
    }
   }
   if(modal==="area")await upsert("service_areas",{id:form.id,name:form.name.trim(),zip_codes:(form.zip_codes||"").split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean).join(", "),base_address:(form.base_address||"").trim(),created_at:form.created_at||new Date().toISOString()},setAreas);
   if(modal==="task")await upsert("tasks",{id:form.id,title:form.title.trim(),category:form.category||"follow_up",notes:form.notes||"",contact_id:form.contact_id||null,job_id:form.job_id||null,due_at:form.due_at?new Date(form.due_at).toISOString():new Date().toISOString(),completed:Boolean(form.completed),created_at:form.created_at||new Date().toISOString()},setTasks);
   setModal(null);setToast("Saved successfully");if(connected)await reload();
  }catch(e){setError(e.message||"Could not save. Please try again.");}finally{setSaving(false);}
 }
 async function setJobStage(job,stage){
  try{setError("");await upsert("jobs",{...job,stage},setJobs);if(connected)await reload();setToast("Job updated");}
  catch(e){setError(e.message||"Could not update job");}
 }
 async function toggleTask(task){
  try{await upsert("tasks",{...task,completed:!task.completed},setTasks);if(connected)await reload();}
  catch(e){setError(e.message||"Could not update follow-up");}
 }

 const zipFrom = value => (String(value||"").match(/\b\d{5}(?:-\d{4})?\b/)||[])[0]?.slice(0,5)||"";
 const localDay = value => {if(!value)return "";const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const areaForJob=j=>{
   const manuallySet=areas.find(a=>a.id===j.route_zone);
   if(manuallySet)return manuallySet;
   const zip=zipFrom(j.pickup_address||"")||zipFrom(person(j.contact_id)?.address||"")||zipFrom(j.lead_details?.zip||"");
   return zip ? areas.find(a=>String(a.zip_codes||"").split(/[,;\s]+/).includes(zip))||null : null;
 };
 const inArea=(j,id)=>id==="all"|| (id==="unassigned"?!areaForJob(j):areaForJob(j)?.id===id);
 const chosenArea=areas.find(a=>a.id===areaFilter);
 const areaLeads=jobs.filter(j=>j.stage!=="lost"&&inArea(j,areaFilter));
 const routeStops=areaLeads.filter(j=>j.stage==="booked"&&j.scheduled_at&&localDay(j.scheduled_at)===routeDate).sort((a,b)=>(a.visit_order??9999)-(b.visit_order??9999)||new Date(a.scheduled_at)-new Date(b.scheduled_at));
 const awaitingSchedule=areaLeads.filter(j=>!j.scheduled_at&&j.stage!=="completed");
 const driveUrl=(from,to)=>"https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(from)+"&destination="+encodeURIComponent(to)+"&travelmode=driving";
 function multiStopUrl(stops,base){
   const addresses=stops.map(addressForJob).filter(hasStreetAddress).slice(0,9);
   if(!addresses.length)return "";
   const destination=addresses[addresses.length-1];
   const origin=base&&hasStreetAddress(base)?base:addresses.shift();
   if(!addresses.length&&origin===destination)return mapsUrl(destination);
   const waypoints=addresses.slice(0,-1);
   const params=new URLSearchParams({api:"1",origin:origin||destination,destination,travelmode:"driving"});
   if(waypoints.length)params.set("waypoints",waypoints.join("|"));
   return "https://www.google.com/maps/dir/?"+params.toString();
 }
 async function moveVisit(job,by){
   const list=[...routeStops],index=list.findIndex(x=>x.id===job.id),target=index+by;
   if(index<0||target<0||target>=list.length)return;
   [list[index],list[target]]=[list[target],list[index]];
   try{
     for(let i=0;i<list.length;i++)await upsert("jobs",{...list[i],visit_order:i+1},setJobs);
     if(connected)await reload();
     setToast("Stop order updated");
   }catch(e){setError(e.message||"Unable to reorder stops");}
 }
 function resetDemo(){if(!connected){setContacts([]);setJobs([]);setTasks([]);setAreas([]);setToast("Preview records cleared");}}

 async function importLeadsCsv(file) {
   if(!file)return;
   if(!connected||!session||!workspace){setError("Connect a private Epoxy Creations database and sign in before importing customer data.");return;}
   setImporting(true);setImportReport("");setError("");
   try{
     const rows=parseLeadCSV(await file.text());
     if(rows.length>500)throw Error("Import a maximum of 500 leads at once.");
     const knownSourceIds=new Set(jobs.map(j=>j.lead_details?.source_message_id||j.lead_details?.gmail_message_id).filter(Boolean));
     const byEmail=new Map(contacts.filter(c=>c.email).map(c=>[c.email.toLowerCase(),c]));
     const byPhone=new Map(contacts.filter(c=>c.phone).map(c=>[c.phone.replace(/\D/g,""),c]));
     let imported=0,skipped=0;
     for(const row of rows){
       if(!row.name||!row.email||!row.source_message_id||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)){skipped++;continue;}
       if(knownSourceIds.has(row.source_message_id)){skipped++;continue;}
       const phone=(row.phone||"").replace(/\D/g,"");
       let contact=byEmail.get(row.email.toLowerCase())||(phone?byPhone.get(phone):null);
       if(!contact){
         const add=await db.from("epoxy_contacts").insert({
           workspace_id:workspace.workspace_id,
           name:row.name,phone:row.phone||"",email:row.email,
           address:row.street_address||(row.zip?"ZIP "+row.zip:""),notes:""
         }).select().single();
         if(add.error)throw Error("Contact "+row.name+": "+add.error.message);
         contact=add.data;byEmail.set(row.email.toLowerCase(),contact);if(phone)byPhone.set(phone,contact);
       }
       const details={
         zip:row.zip||"",finish_type:row.finish_type||"",approx_size:row.approx_size||"",
         timeline:row.timeline||"",received_at:row.received_at||"",
         source_message_id:row.source_message_id,gmail_source_url:row.gmail_source_url||""
       };
       const received=row.received_at&&/^\d{4}-\d{2}-\d{2}$/.test(row.received_at)?row.received_at+"T12:00:00.000Z":new Date().toISOString();
       const addJob=await db.from("epoxy_jobs").insert({
         workspace_id:workspace.workspace_id,contact_id:contact.id,
         service:row.project_type||"Epoxy flooring inquiry",
         source:row.lead_source||"Email inquiry",
         pickup_address:row.street_address||"",stage:"imported",
         route_zone:"",visit_order:null,
         estimate_amount:null,final_amount:null,scheduled_at:null,
         notes:"Historical inquiry imported from email. Contact and booking status not yet verified.",
         lead_details:details,created_at:received
       }).select().single();
       if(addJob.error)throw Error("Lead "+row.name+": "+addJob.error.message);
       knownSourceIds.add(row.source_message_id);imported++;
     }
     await reload();
     setImportReport("Imported "+imported+" lead"+(imported===1?"":"s")+". Skipped "+skipped+" duplicate or incomplete record"+(skipped===1?"":"s")+".");
     setToast("Email lead import complete");
   }catch(e){setError(e.message||"Import could not be completed.");}
   finally{setImporting(false);}
 }

 function exportJobs(){
  csvDownload([["Contact","Phone","Service","Source","Stage","Estimate","Final amount","Scheduled","Notes"],...jobs.map(j=>[person(j.contact_id)?.name,person(j.contact_id)?.phone,j.service,j.source,stageInfo(j.stage).label,j.estimate_amount,j.final_amount,j.scheduled_at,j.notes])],"epoxy-creations-jobs.csv");
 }
 const heading={
  dashboard:["Good "+(new Date().getHours()<12?"morning":new Date().getHours()<17?"afternoon":"evening")+", Epoxy Creations","Here's what's happening across your business."],
  pipeline:["Lead pipeline","Move every inquiry from first contact to completed job."],
  areas:["Service area planner","Keep nearby leads and job sites together, then build an efficient day."],
  jobs:["Jobs & estimates","Quotes and confirmed work, without the lead pipeline clutter."],
  customers:["Customers","Only customers with completed jobs appear here, with their job history."],
  calendar:["Job calendar","Know what is scheduled and what's coming up."],
  tasks:["Follow-ups","Never forget to call, text or check in."],
  settings:["Workspace settings","Your business tools, integrations and information."]
 }[tab];
 function jobRow(j){
  const c=person(j.contact_id);return <div className="job-row" key={j.id}><div className="avatar">{initials(c?.name)}</div><div className="job-main"><button className="link-title" onClick={()=>openModal("job",{...j,scheduled_at:j.scheduled_at?new Date(j.scheduled_at).toISOString().slice(0,16):""})}>{c?.name||"Customer"}</button><span>{j.service} <span className="mid-dot">·</span> {j.source||"Other"}</span><span>Received {leadReceived(j.created_at)} · {leadAge(j.created_at,now)}</span></div><div className="job-money">{j.estimate_amount==null?"No estimate":money(j.estimate_amount)}</div><Pill stage={j.stage}/><button className="icon-btn light" title="Edit job" onClick={()=>openModal("job",{...j,scheduled_at:j.scheduled_at?new Date(j.scheduled_at).toISOString().slice(0,16):""})}><ArrowUpRight size={17}/></button></div>;
 }
 function taskRow(t){
  const c=person(t.contact_id);
  const job=jobs.find(j=>j.id===t.job_id);
  return <div key={t.id} className={"task-row categorized-task "+(t.completed?"task-done":"")}>
    <button title={t.completed?"Mark pending":"Mark done"} aria-label={t.completed?"Mark pending":"Mark done"} onClick={()=>toggleTask(t)} className={"task-check "+(t.completed?"is-done":"")}>{t.completed?<Check size={15}/>:null}</button>
    <div className="task-body">
     <div className="task-header"><b>{t.title}</b><span className={"followup-tag followup-"+(t.category||"follow_up")}>{followCategory(t.category)}</span></div>
     <span>{c?.name?c.name+" · ":""}Due {fullDate(t.due_at)}</span>
     {t.notes&&<p className="task-latest-note"><strong>Latest note:</strong> {t.notes}</p>}
     {job&&<button className="task-related-link" onClick={()=>editJob(job)}>Open lead <ArrowUpRight size={13}/></button>}
    </div>
    <button className="icon-btn light" aria-label="Edit follow-up" onClick={()=>openModal("task",{...t,due_at:localDateTimeInput(t.due_at||Date.now())})}><Pencil size={15}/></button>
  </div>;
 }
 function newJobForm(){openModal("job",{contact_id:contacts[0]?.id||"",service:"Epoxy flooring",stage:"booked",source:"Phone"});}
 function newEstimateForm(){openModal("job",{contact_id:contacts[0]?.id||"",service:"Epoxy flooring",stage:"estimate_sent",source:"Phone"});}
 function editJob(j,updates={}){openModal("job",{...j,...updates,scheduled_at:j.scheduled_at?new Date(j.scheduled_at).toISOString().slice(0,16):""});}
 function workRecordRow(j){
  const c=person(j.contact_id),estimate=recordView==="estimates",completed=j.stage==="completed";
  return <div className="work-record" key={j.id}>
   <div className={"work-record-icon "+(estimate?"quote-icon":"job-icon")}>{estimate?<ClipboardList size={19}/>:<Truck size={19}/>}</div>
   <div className="work-record-detail"><button className="work-record-name" onClick={()=>editJob(j)}>{j.service||"Epoxy flooring"}</button><span>{c?.name||"Customer"}{c?.address?" · "+c.address:""}</span></div>
   <div className="work-record-amount"><span>{estimate?"Estimate amount":"Job value"}</span><strong>{j.estimate_amount==null&&j.final_amount==null?"Not priced":money(completed?(j.final_amount??j.estimate_amount):(j.estimate_amount??j.final_amount))}</strong></div>
   <div className="work-record-progress"><span className={"work-label "+(estimate?"work-label-estimate":completed?"work-label-complete":"work-label-booked")}>{estimate?(j.stage==="estimate_sent"?"Awaiting reply":"Draft quote"):completed?"Completed":"Booked"}</span><small>{estimate?"":j.scheduled_at?fullDate(j.scheduled_at):"Date not set"}</small></div>
   <div className="work-record-actions">{estimate&&<button className="work-quick" onClick={()=>editJob(j,{stage:"booked"})}>Book job <ArrowRight size={14}/></button>}<button title="Edit record" aria-label="Edit record" className="icon-btn light" onClick={()=>editJob(j)}><Pencil size={16}/></button></div>
  </div>;
 }
 if(authLoading)return <div className="loading-page">Loading Epoxy Creations Command Center…</div>;
 if(connected&&!session)return <Login onLogin={()=>{}}/>;
 if(connected&&loading&& !workspace)return <div className="loading-page">Loading your workspace…</div>;
 return <div className="app-shell">
   {mobileNav&&<div className="nav-scrim" onClick={()=>setMobileNav(false)}/>}
   <aside className={"sidebar "+(mobileNav?"sidebar-open":"")}><div className="side-header"><Brand/><button className="mobile-close icon-btn" onClick={()=>setMobileNav(false)}><X size={20}/></button></div><div className="side-label">WORKSPACE</div><nav className="side-nav">
   {TABS.map(t=><button key={t.id} onClick={()=>changeTab(t.id)} className={"nav-link "+(tab===t.id?"selected":"")}><t.icon size={19} strokeWidth={2}/><span>{t.label}</span>{t.id==="tasks"&&openTasks.length>0&&<em>{openTasks.length}</em>}</button>)}
   </nav><div className="sidebar-bottom"><div className="side-help"><div className="side-help-icon"><Truck size={18}/></div><b>Built for Epoxy Creations</b><span>Less admin. More jobs done.</span></div><div className="side-profile"><div className="profile-avatar">J</div><div><b>Epoxy Creations</b><span>Service territories</span></div><ShieldCheck size={16}/></div></div></aside>
   <div className="main-shell"><header className="topbar"><div className="top-left"><button className="mobile-menu icon-btn" onClick={()=>setMobileNav(true)} aria-label="Open navigation"><Menu size={22}/></button><div className="breadcrumb">Epoxy Creations <ChevronRight size={15}/> <b>{TABS.find(t=>t.id===tab)?.label}</b></div></div><div className="top-right"><span className="today-date">{new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</span><div className="profile-avatar profile-small">J</div></div></header>
    <main className="page">
     {!connected&&<div className="demo-banner"><AlertCircle size={17}/><div><b>Preview workspace</b><span>All sample records have been removed. Secure database setup is required to load real customer leads.</span></div><button onClick={()=>changeTab("settings")}>Setup details <ArrowRight size={14}/></button></div>}
     {error&&<div className="error-banner"><AlertCircle size={17}/>{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={16}/></button></div>}
     <div className="page-heading"><div><div className="eyebrow">EPOXY CREATIONS COMMAND CENTER</div><h1>{heading[0]}</h1><p>{heading[1]}</p></div><div className="heading-actions">{tab==="jobs"&&<button className="btn btn-outline" onClick={exportJobs}><Download size={17}/> Export</button>}{(tab==="dashboard"||tab==="pipeline")&&connected&&<button className="btn btn-outline" onClick={reload}><RotateCcw size={16}/> Refresh</button>}{tab!=="settings"&&tab!=="jobs"&&<button className="btn btn-primary" onClick={()=>openModal("lead",{source:"Website"})}><Plus size={18}/> New lead</button>}</div></div>
     {tab==="dashboard"&&<div className="content-stack">
       <div className="metric-grid">
        <div className="metric-card"><div className="metric-top"><span>New leads</span><div className="metric-icon blue"><Users size={19}/></div></div><strong>{newLeads}</strong><small>New or imported, needs review</small></div>
        <div className="metric-card"><div className="metric-top"><span>Open estimates</span><div className="metric-icon orange"><ClipboardList size={19}/></div></div><strong>{estimates}</strong><small>Ready for follow-up</small></div>
        <div className="metric-card"><div className="metric-top"><span>Booked jobs</span><div className="metric-icon green"><Truck size={19}/></div></div><strong>{booked}</strong><small>Scheduled or pending date</small></div>
        <div className="metric-card"><div className="metric-top"><span>Completed job value</span><div className="metric-icon green"><DollarSign size={19}/></div></div><strong>{money(revenue)}</strong><small>Recorded completed jobs, all time</small></div>
       </div>
       <div className="dash-grid">
        <section className="panel"><div className="panel-top"><div><h2>Needs your attention</h2><p>Follow-ups waiting on you</p></div><button className="text-action" onClick={()=>changeTab("tasks")}>View all <ArrowRight size={16}/></button></div><div>{openTasks.length?openTasks.slice(0,4).map(taskRow):<Empty icon={CircleCheck} title="You're all caught up" subtitle="Add a follow-up and it will appear here."/>}</div><div className="panel-foot"><button className="subtle-action" onClick={()=>openModal("task",{due_at:new Date().toISOString().slice(0,16)})}><Plus size={16}/> Add follow-up</button></div></section>
        <section className="panel"><div className="panel-top"><div><h2>Upcoming jobs</h2><p>Booked work on your schedule</p></div><button className="text-action" onClick={()=>changeTab("calendar")}>Calendar <ArrowRight size={16}/></button></div><div>{upcomingJobs.length?upcomingJobs.slice(0,4).map(j=><div key={j.id} className="schedule-row"><div className="schedule-date"><b>{new Date(j.scheduled_at).toLocaleDateString("en-US",{day:"2-digit"})}</b><span>{new Date(j.scheduled_at).toLocaleDateString("en-US",{month:"short"})}</span></div><div><b>{j.service}</b><span>{person(j.contact_id)?.name||"Customer"}</span></div><span className="schedule-time">{new Date(j.scheduled_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</span></div>):<Empty icon={CalendarDays} title="No jobs scheduled" subtitle="Book a job to see it here."/>}</div><div className="panel-foot"><button className="subtle-action" onClick={newJobForm} disabled={!contacts.length}><Plus size={16}/> Schedule a job</button></div></section>
       </div>
       <section className="panel"><div className="panel-top"><div><h2>Recent opportunities</h2><p>Your latest incoming jobs and estimates</p></div><button className="text-action" onClick={()=>changeTab("pipeline")}>Open pipeline <ArrowRight size={16}/></button></div><div className="jobs-list">{jobs.length?jobs.slice(0,5).map(jobRow):<Empty title="No leads yet" subtitle="Add your first lead to get started."/>}</div></section>
      </div>}
     {tab==="pipeline"&&<div className="content-stack"><div className="section-utility"><div className="utility-note"><CircleDot size={16}/> Update lead stages as conversations move forward</div><button onClick={()=>openModal("lead",{source:"Phone"})} className="btn btn-outline"><Plus size={16}/> Add opportunity</button></div><div className="pipeline-board">{STAGES.filter(s=>s.id!=="lost").map(s=><div key={s.id} className="pipe-column"><div className="pipe-heading"><span className={"pipe-mark "+s.color}/><b>{s.label}</b><span>{jobs.filter(j=>j.stage===s.id).length}</span></div><div className="pipe-items">{jobs.filter(j=>j.stage===s.id).map(j=><div key={j.id} className="pipe-card"><div className="pipe-card-overline">{j.source||"Lead"}</div><div className="pipe-received" title={leadReceived(j.created_at)}><Clock size={12}/>{leadReceived(j.created_at)} <span>· {leadAge(j.created_at,now)}</span></div><button className="pipe-person" onClick={()=>openModal("job",{...j,scheduled_at:j.scheduled_at?new Date(j.scheduled_at).toISOString().slice(0,16):""})}>{person(j.contact_id)?.name||"Customer"} <ArrowUpRight size={15}/></button><span>{j.service}</span>{j.lead_details?.zip&&<span className="pipe-quote-meta">ZIP {j.lead_details.zip}{j.lead_details.timeline?" · "+j.lead_details.timeline:""}</span>}<button className="pipe-followup-action" title="Add this lead to follow-ups" onClick={()=>openFollowUpFromLead(j)}><ListTodo size={13}/> Add follow-up</button><div className="pipe-card-bottom"><b>{j.estimate_amount==null?"No quote":money(j.estimate_amount)}</b><select aria-label={"Change stage for "+j.service} value={j.stage} onChange={e=>setJobStage(j,e.target.value)}>{STAGES.map(st=><option key={st.id} value={st.id}>{st.label}</option>)}</select></div></div>)}{!jobs.some(j=>j.stage===s.id)&&<div className="pipe-empty">No opportunities</div>}</div></div>)}</div>{jobs.some(j=>j.stage==="lost")&&<div className="closed-note">Lost opportunities: {jobs.filter(j=>j.stage==="lost").length}. View and edit them in Jobs & estimates.</div>}</div>}
     {tab==="jobs"&&<div className="content-stack">
      <section className="panel list-panel">
       <div className="records-tabs" role="tablist" aria-label="Jobs and estimates">
        <button role="tab" aria-selected={recordView==="jobs"} className={recordView==="jobs"?"active":""} onClick={()=>{setRecordView("jobs");setRecordFilter("all");setQuery("");}}><Truck size={17}/> Jobs <span>{workRecords.length}</span></button>
        <button role="tab" aria-selected={recordView==="estimates"} className={recordView==="estimates"?"active":""} onClick={()=>{setRecordView("estimates");setRecordFilter("all");setQuery("");}}><ClipboardList size={17}/> Estimates <span>{estimateRecords.length}</span></button>
       </div>
       <div className="panel-top records-heading"><div><h2>{recordView==="jobs"?"Your jobs":"Your estimates"}</h2><p>{recordView==="jobs"?"Booked and completed epoxy flooring work.":"Prepared quotes and estimates awaiting a decision."}</p></div>
        <button onClick={recordView==="jobs"?newJobForm:newEstimateForm} disabled={!contacts.length} className="btn btn-primary"><Plus size={16}/> {recordView==="jobs"?"New job":"New estimate"}</button>
       </div>
       <div className="record-highlights">
        {recordView==="jobs"?<>
          <div><span><Truck size={15}/> Booked jobs</span><strong>{workRecords.filter(j=>j.stage==="booked").length}</strong></div>
          <div><span><CircleCheck size={15}/> Completed jobs</span><strong>{workRecords.filter(j=>j.stage==="completed").length}</strong></div>
          <div><span><DollarSign size={15}/> Completed value</span><strong>{money(workRecords.filter(j=>j.stage==="completed").reduce((sum,j)=>sum+Number(j.final_amount??j.estimate_amount??0),0))}</strong></div>
         </>:<>
          <div><span><ClipboardList size={15}/> Open estimates</span><strong>{estimateRecords.length}</strong></div>
          <div><span><Clock size={15}/> Awaiting reply</span><strong>{estimateRecords.filter(j=>j.stage==="estimate_sent").length}</strong></div>
          <div><span><DollarSign size={15}/> Estimated value</span><strong>{money(estimateRecords.reduce((sum,j)=>sum+Number(j.estimate_amount??0),0))}</strong></div>
         </>}
       </div>
       <div className="table-tools records-tools"><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={recordView==="jobs"?"Search jobs or customers…":"Search estimates or customers…"}/></div><div className="select-wrap"><Filter size={15}/><select aria-label={recordView==="jobs"?"Filter jobs":"Filter estimates"} value={recordFilter} onChange={e=>setRecordFilter(e.target.value)}>{recordView==="jobs"?<><option value="all">All jobs</option><option value="scheduled">Booked jobs</option><option value="completed">Completed jobs</option></>:<><option value="all">All estimates</option><option value="sent">Awaiting reply</option><option value="draft">Draft quotes</option></>}</select></div></div>
       <div className="jobs-list">{visibleRecords.length?visibleRecords.map(workRecordRow):<Empty icon={recordView==="jobs"?Truck:ClipboardList} title={query?"No matching records":recordView==="jobs"?"No jobs yet":"No estimates yet"} subtitle={query?"Try another search or filter.":recordView==="jobs"?"Booked jobs will appear here. New inquiries stay in the pipeline.":"Add an estimate to keep track of quotes in one place."}/>}</div>
       {!contacts.length&&<div className="records-hint"><Users size={16}/> Add a customer first, then create an estimate or book a job. <button onClick={()=>changeTab("customers")}>Add customer <ArrowRight size={14}/></button></div>}
      </section>
      <p className="record-footer-note"><CircleDot size={16}/> Lead stages stay in the Lead pipeline. This page focuses on estimates and confirmed work.</p>
     </div>}
     {tab==="customers"&&<section className="panel list-panel"><div className="panel-top"><div><h2>Completed customers</h2><p>{completedCustomers.length} customers with completed jobs</p></div><span className="customer-qualifier"><CircleCheck size={16}/> Completed jobs only</span></div>
       <div className="table-tools"><div className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a completed customer by name, number or address…"/></div></div>
       <div className="contact-grid">{filtered(completedCustomers,"contacts").map(c=><div className="contact-card" key={c.id}><div className="contact-top"><div className="avatar">{initials(c.name)}</div><button aria-label="Edit customer" className="icon-btn light" onClick={()=>openModal("contact",{...c})}><Pencil size={16}/></button></div><h3>{c.name}</h3>
         <div className="contact-meta">{c.phone&&<a href={"tel:"+c.phone}><Phone size={15}/>{c.phone}</a>}{c.email&&<a href={"mailto:"+c.email}><Mail size={15}/>{c.email}</a>}{c.address&&<span><MapPin size={15}/>{c.address}</span>}</div>
         <div className="contact-footer"><span>{jobs.filter(j=>j.contact_id===c.id&&j.stage==="completed").length} completed jobs</span><button onClick={()=>openModal("job",{contact_id:c.id,service:"Epoxy flooring",stage:"booked",source:"Phone"})}>New job <Plus size={15}/></button></div>
       </div>)}{!filtered(completedCustomers,"contacts").length&&<div className="grid-empty"><Empty icon={Users} title={query?"No matching customers":"No completed customers yet"} subtitle={query?"Try another search.":"Once a lead reaches Completed in the pipeline, their profile will appear here. Leads stay in the pipeline."}/></div>}</div>
      </section>}
     {tab==="tasks"&&<section className="panel list-panel">
       <div className="panel-top"><div><h2>Follow-up center</h2><p>{openTasks.length} open reminders across your leads</p></div><button className="btn btn-outline" onClick={()=>openModal("task",{category:"follow_up",due_at:localDateTimeInput(Date.now()+DAY)})}><Plus size={16}/> New follow-up</button></div>
       <div className="followup-tools"><div className="select-wrap"><Filter size={15}/><select aria-label="Filter follow-ups by category" value={taskCategoryFilter} onChange={e=>setTaskCategoryFilter(e.target.value)}><option value="all">All follow-up categories</option>{FOLLOW_UP_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div><div className="followup-count">{filteredOpenTasks.length} pending</div></div>
       <div className="task-section-label">TO DO</div>{filteredOpenTasks.length?filteredOpenTasks.map(taskRow):<Empty icon={CircleCheck} title="Nothing pending in this category" subtitle="Choose another category or create a follow-up from a lead."/>}
       <div className="task-section-label">COMPLETED FOLLOW-UPS</div>{filteredDoneTasks.length?filteredDoneTasks.map(taskRow):<div className="muted-row">Completed follow-ups will appear here.</div>}
      </section>}
     {tab==="calendar"&&<div className="content-stack">
 <section className="panel calendar-panel">
  <div className="panel-top"><div><h2>{month.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</h2><p>Select any day to see every scheduled job and its address.</p></div><div className="calendar-actions"><button className="icon-btn outline" aria-label="Previous month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={19}/></button><button className="btn btn-outline" onClick={()=>setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1))}>Today</button><button className="icon-btn outline" aria-label="Next month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={19}/></button></div></div>
  <div className="calendar-grid">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="weekday">{d}</div>)}{Array.from({length:Math.ceil((new Date(month.getFullYear(),month.getMonth(),1).getDay()+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7)*7},(_,i)=>{
   const day=i-new Date(month.getFullYear(),month.getMonth(),1).getDay()+1;
   const cur=new Date(month.getFullYear(),month.getMonth(),day);
   const isCurrent=cur.getMonth()===month.getMonth();
   const isToday=cur.toDateString()===new Date().toDateString();
   const dayJobs=jobs.filter(j=>j.scheduled_at&&new Date(j.scheduled_at).toDateString()===cur.toDateString()&&j.stage!=="lost");
   return <button type="button" key={i} aria-label={dayLabel(cur)+"; "+dayJobs.length+" scheduled jobs"} className={"cal-day cal-selectable "+(!isCurrent?"outside":"")+(isToday?" is-today":"")} onClick={()=>setSelectedDay(cur)}>
    <span className="date-num">{cur.getDate()}</span>
    {dayJobs.slice(0,3).map(j=><span key={j.id} className="cal-event">{new Date(j.scheduled_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})} · {person(j.contact_id)?.name||j.service}</span>)}
    {dayJobs.length>3&&<small>+{dayJobs.length-3} more</small>}
   </button>;
  })}</div>
 </section>
 <div className="calendar-notice"><CalendarCheck2 size={20}/><div><b>Google Calendar is not connected yet</b><p>Scheduled jobs appear inside this CRM. Two-way Google Calendar syncing will require the client's Google authorization.</p></div><a href="https://calendar.google.com/" target="_blank" rel="noreferrer">Open Google Calendar <ExternalLink size={15}/></a></div>
 </div>}

     {tab==="areas"&&<div className="area-page content-stack">
       <section className="area-hero"><div><span className="area-kicker"><Layers3 size={14}/> TERRITORY OPERATIONS</span><h2>Work by area. Not by accident.</h2><p>Create the zones you actually service, group leads by ZIP, and plan nearby stops on the same day. No more jumping across town between jobs.</p></div><button className="btn btn-primary" onClick={()=>openModal("area",{name:"",zip_codes:"",base_address:""})}><Plus size={17}/> New service area</button></section>
       <div className="area-metrics"><div><span>Service areas</span><strong>{areas.length}</strong><small>Custom routes & territories</small></div><div><span>Active opportunities</span><strong>{jobs.filter(j=>j.stage!=="completed"&&j.stage!=="lost").length}</strong><small>Across all areas</small></div><div><span>Needs an area</span><strong>{jobs.filter(j=>j.stage!=="lost"&&!areaForJob(j)).length}</strong><small>Assign or update ZIPs</small></div></div>
       <div className="area-heading"><div><h2>Territory overview</h2><p>Select a zone to see its jobs and build a practical route.</p></div><button className="btn btn-outline" onClick={()=>openModal("area",{name:"",zip_codes:"",base_address:""})}><Plus size={15}/> Add zone</button></div>
       <div className="area-tiles">
        <button className={"area-tile "+(areaFilter==="all"?"is-active":"")} onClick={()=>setAreaFilter("all")}><div className="zone-crest"><Layers3 size={19}/></div><b>All territories</b><strong>{jobs.filter(j=>j.stage!=="lost").length} <small>records</small></strong><span>Complete service coverage <ArrowRight size={14}/></span></button>
        {areas.map(a=><button key={a.id} className={"area-tile "+(areaFilter===a.id?"is-active":"")} onClick={()=>setAreaFilter(a.id)}><div className="zone-crest"><MapPin size={19}/></div><b>{a.name}</b><strong>{jobs.filter(j=>j.stage!=="lost"&&areaForJob(j)?.id===a.id).length} <small>records</small></strong><span>{a.zip_codes||"No ZIP codes yet"} <ArrowRight size={14}/></span></button>)}
        <button className={"area-tile area-tile-unassigned "+(areaFilter==="unassigned"?"is-active":"")} onClick={()=>setAreaFilter("unassigned")}><div className="zone-crest"><CircleHelp size={19}/></div><b>Unassigned</b><strong>{jobs.filter(j=>j.stage!=="lost"&&!areaForJob(j)).length} <small>records</small></strong><span>Check locations <ArrowRight size={14}/></span></button>
       </div>
       {chosenArea&&<div className="area-admin"><div><MapPinned size={18}/><span><b>{chosenArea.name}</b> · ZIP codes {chosenArea.zip_codes||"not configured"} {chosenArea.base_address?" · Start: "+chosenArea.base_address:""}</span></div><button className="btn btn-outline" onClick={()=>openModal("area",chosenArea)}><Pencil size={15}/> Edit area</button></div>}
       <div className="area-board">
        <div className="route-title"><div><span className="area-kicker">FIELD SCHEDULE</span><h2>Daily route planner</h2><p>Stops are grouped by area. Set the day's order and open the route in Google Maps to check actual drive times.</p></div><div className="route-controls"><input aria-label="Route date" type="date" value={routeDate} onChange={e=>setRouteDate(e.target.value)}/><select aria-label="Route area" value={areaFilter} onChange={e=>setAreaFilter(e.target.value)}><option value="all">All territories</option>{areas.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}<option value="unassigned">Unassigned</option></select></div></div>
        <div className="route-toolbar"><span><Route size={16}/> {routeStops.length} scheduled {routeStops.length===1?"stop":"stops"} on {new Date(routeDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric"})}</span>{areaFilter!=="all"&&routeStops.some(j=>hasStreetAddress(addressForJob(j)))&&<a className="btn btn-primary" target="_blank" rel="noopener noreferrer" href={multiStopUrl(routeStops,chosenArea?.base_address||"")}><Navigation size={16}/> Open route <ExternalLink size={14}/></a>}</div>
        {areaFilter==="all"&&<p className="area-advice"><MapPin size={15}/> Choose one service area before opening a combined route so you don't mix distant stops.</p>}
        {routeStops.length>9&&<p className="area-advice">Google Maps route links include the first 9 addressable stops. Split larger days into separate runs.</p>}
        {routeStops.length?routeStops.map((j,i)=><div className="route-stop" key={j.id}><div className="route-index">{String(i+1).padStart(2,"0")}</div><div className="route-stop-info"><b>{person(j.contact_id)?.name||"Customer"} <span>· {j.service}</span></b><p>{addressForJob(j)||"Street address missing"} · {fullDate(j.scheduled_at)}</p><div className="route-links">{hasStreetAddress(addressForJob(j))&&<a href={chosenArea?.base_address?driveUrl(chosenArea.base_address,addressForJob(j)):mapsUrl(addressForJob(j))} target="_blank" rel="noopener noreferrer"><Navigation size={13}/> Check drive in Maps</a>}<button onClick={()=>openModal("job",{...j,scheduled_at:localDateTimeInput(j.scheduled_at)})}><Pencil size={13}/> Edit job</button></div></div><div className="route-move"><button disabled={i===0} onClick={()=>moveVisit(j,-1)} aria-label="Move stop up"><ArrowUp size={16}/></button><button disabled={i===routeStops.length-1} onClick={()=>moveVisit(j,1)} aria-label="Move stop down"><ArrowDown size={16}/></button></div></div>):<div className="route-empty"><MapPinned size={29}/><b>No scheduled stops for this area and date</b><p>Pick another date or schedule a job from the queue below.</p></div>}
       </div>
       <div className="area-board"><div className="area-heading"><div><h2>Leads to place on the map</h2><p>{awaitingSchedule.length} unscheduled opportunities in this selection. Edit a lead to assign an area and booking date.</p></div></div>{awaitingSchedule.length?awaitingSchedule.slice(0,30).map(j=><div className="area-lead" key={j.id}><div className="zone-crest"><MapPin size={17}/></div><div><b>{person(j.contact_id)?.name||"Customer"}</b><p>{j.service} · {addressForJob(j)||"No job site address"}</p></div><span className="area-tag">{areaForJob(j)?.name||"Unassigned"}</span><button className="btn btn-outline" onClick={()=>openModal("job",{...j,scheduled_at:""})}>Plan job <ArrowRight size={14}/></button></div>):<div className="route-empty compact"><CircleCheck size={26}/><b>No unscheduled work in this selection</b></div>}</div>
       <p className="area-footnote"><CircleHelp size={15}/> ZIP matching suggests a service area, not mileage or traffic. Use the Maps links for real driving estimates. Route stop order is manual, not automatic route optimization.</p>
     </div>}
     {tab==="settings"&&<div className="settings-grid">

      <section className="panel settings-panel">
        <div className="panel-top"><div><h2>Import customer inquiries</h2><p>Import additional Epoxy Creations inquiries. Ten recent ad leads are already loaded.</p></div></div>
        <div className="import-content">
          <p>Duplicates are checked using original email message IDs. Customer details and project answers stay inside the private business workspace. Imported leads are marked <b>Imported · review</b>, not automatically qualified or booked.</p>
          <label className={"btn "+(connected&&session?"btn-primary":"btn-outline")}>
            <Download size={16}/> {importing?"Importing…":"Choose verified lead CSV"}
            <input type="file" accept=".csv,text/csv" disabled={!connected||!session||importing} style={{display:"none"}} onChange={e=>{importLeadsCsv(e.target.files?.[0]);e.target.value="";}}/>
          </label>
          {!connected&&<p className="import-warning"><ShieldCheck size={16}/> Customer data cannot be imported until an isolated Epoxy Creations database is configured. No files or contact details are uploaded in preview mode.</p>}
          {importReport&&<p className="import-success">{importReport}</p>}
        </div>
      </section>

      <section className="panel settings-panel"><div className="panel-top"><div><h2>Business workspace</h2><p>Personalized for your crew</p></div></div><div className="setting-business"><img src={LOGO} alt="Epoxy Creations logo"/><div><b>Epoxy Creations LLC</b><span>Service territories</span><span>Custom workspace by Ignite Co.</span></div></div><div className="setting-detail"><span>Workspace</span><b>{workspace?.epoxy_workspaces?.name||"Epoxy Creations Command Center"}</b></div><div className="setting-detail"><span>Data storage</span><b>{connected?"Private Supabase database":"Browser-only preview"}</b></div>{connected&&<button className="btn btn-outline" onClick={async()=>{await db.auth.signOut();}}><LogOut size={16}/> Sign out</button>}</section>
      <section className="panel settings-panel"><div className="panel-top"><div><h2>Integrations</h2><p>Bring the platforms you already use together</p></div></div><div className="integration-row"><div className="integration-icon"><CalendarDays size={21}/></div><div><b>Google Calendar</b><span>Two-way sync not connected</span></div><a href="https://calendar.google.com/" target="_blank" rel="noreferrer">Open <ExternalLink size={15}/></a></div><div className="integration-row"><div className="integration-icon"><Star size={21}/></div><div><b>Google Business Profile</b><span>Reviews and profile API not connected</span></div><a href="https://business.google.com/" target="_blank" rel="noreferrer">Open <ExternalLink size={15}/></a></div><div className="integration-row"><div className="integration-icon"><Link2 size={21}/></div><div><b>Epoxy Creations website forms</b><span>Automatic lead capture not connected</span></div><span className="soon">Planned</span></div></section>
      <section className="panel settings-panel"><div className="panel-top"><div><h2>Data & privacy</h2><p>Your contacts and job history belong to Epoxy Creations</p></div></div><div className="privacy-text"><ShieldCheck size={20}/><span>{connected?"CRM records are protected by sign-in and workspace row-level access policies.":"This preview stores changes only in this browser. Do not enter actual customer details until the secure database is configured."}</span></div><button onClick={exportJobs} className="btn btn-outline"><Download size={16}/> Export jobs as CSV</button></section>
     </div>}
    </main>
   </div>
   {toast&&<div className="toast"><CircleCheck size={17}/>{toast}</div>}
   {selectedDay&&<div className="modal-overlay day-schedule-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedDay(null);}}>
    <div className="modal day-schedule-panel" role="dialog" aria-modal="true" aria-label={"Pickups for "+dayLabel(selectedDay)}>
      <div className="modal-top"><div><div className="eyebrow">EPOXY CREATIONS JOB SCHEDULE</div><h2>{dayLabel(selectedDay)}</h2><p>{selectedDayJobs.length} scheduled {selectedDayJobs.length===1?"job site":"job sites"} for this day, ordered by time.</p></div><button className="icon-btn light" aria-label="Close day schedule" onClick={()=>setSelectedDay(null)}><X size={20}/></button></div>
      <div className="day-schedule-list">{selectedDayJobs.length?selectedDayJobs.map(j=>{
        const c=person(j.contact_id),addr=addressForJob(j);
        return <div key={j.id} className="day-pickup">
          <div className="day-pickup-time"><Clock size={15}/><strong>{new Date(j.scheduled_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</strong></div>
          <div className="day-pickup-info"><b>{c?.name||"Customer"}</b><span>{j.service}</span><div className="day-pickup-address"><MapPin size={16}/><span>{addr||"Job site address not added yet"}</span></div>
           <div className="day-pickup-links">{addr&&<a href={mapsUrl(addr)} target="_blank" rel="noopener noreferrer">Directions <ExternalLink size={13}/></a>}{c?.phone&&<a href={"tel:"+c.phone}>Call customer <Phone size={13}/></a>}<button onClick={()=>{setSelectedDay(null);editJob(j)}}>Open job <ArrowRight size={14}/></button></div>
          </div>
          <Pill stage={j.stage}/>
         </div>;
       }):<Empty icon={CalendarDays} title="No jobs scheduled" subtitle="There are no bookings on this day. Add a job and set its date and time to see it here."/>}</div>
      <div className="day-schedule-foot"><button className="btn btn-outline" onClick={()=>setSelectedDay(null)}>Close schedule</button><button className="btn btn-primary" disabled={!contacts.length} onClick={()=>{const when=new Date(selectedDay);when.setHours(9,0,0,0);setSelectedDay(null);openModal("job",{contact_id:contacts[0]?.id||"",service:"Epoxy flooring",stage:"booked",source:"Phone",scheduled_at:localDateTimeInput(when)});}}><Plus size={16}/> Schedule job site</button></div>
    </div>
   </div>}
   {propertyView&&<div className="modal-overlay property-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)closeProperty();}}>
    <div className="modal property-panel" role="dialog" aria-modal="true" aria-label="View house links">
     <div className="modal-top"><div><div className="eyebrow">EPOXY CREATIONS HOUSE VIEW</div><h2>View House</h2><p>Open property information or directions for the saved job site address.</p></div><button className="icon-btn light" onClick={closeProperty} aria-label="Close house links"><X size={20}/></button></div>
     <div className="house-links-content">
      <div className="house-address-heading"><div className="house-address-icon"><MapPin size={21}/></div><div><span>PICKUP ADDRESS</span><strong>{propertyView.address}</strong></div></div>
      <div className="house-destinations">
       <a href={propertySearchUrl(propertyView.address)} target="_blank" rel="noopener noreferrer" className="house-destination">
        <div className="house-destination-logo house-zillow">Z</div><div><b>Zillow</b><span>Home details, estimated value, sale history</span></div><ExternalLink size={18}/>
       </a>
       <a href={redfinSearchUrl(propertyView.address)} target="_blank" rel="noopener noreferrer" className="house-destination">
        <div className="house-destination-logo house-redfin">R</div><div><b>Redfin</b><span>Property listings, price history, public records</span></div><ExternalLink size={18}/>
       </a>
       <a href={mapsUrl(propertyView.address)} target="_blank" rel="noopener noreferrer" className="house-destination">
        <div className="house-destination-logo house-maps"><MapPin size={20}/></div><div><b>Google Maps</b><span>Map, satellite view, directions to the job site</span></div><ExternalLink size={18}/>
       </a>
      </div>
      <p className="house-links-note">Searches use the saved job site address. Zillow and Redfin may ask you to select a matching property if a direct listing is unavailable.</p>
     </div>
    </div>
   </div>}
   {modal&&<div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setModal(null);}}><div role="dialog" aria-modal="true" aria-label={modal==="lead"?"New lead":"Edit record"} className="modal"><div className="modal-top"><div><div className="eyebrow">EPOXY CREATIONS COMMAND CENTER</div><h2>{modal==="area"?(form.id?"Edit service area":"New service area"):modal==="lead"?"Add a new lead":modal==="contact"?(form.id?"Edit customer":"Add customer"):modal==="job"?(form.id?"Edit job":"New job"):(form.id?"Edit follow-up":"New follow-up")}</h2><p>{modal==="area"?"Define the ZIP codes you want to work together.":modal==="lead"?"Capture the basics. You can fill in details later.":modal==="job"?"Keep job information accurate and easy to find.":modal==="task"?"A simple reminder so nothing falls through.":"Keep your customer records organized."}</p></div><button type="button" className="icon-btn light" onClick={()=>setModal(null)}><X size={20}/></button></div><form onSubmit={save} className="record-form">
    {modal==="area"&&<>
      <label>Area name *<input autoFocus required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. North service corridor"/></label>
      <label>ZIP codes in this area<input value={form.zip_codes||""} onChange={e=>setForm({...form,zip_codes:e.target.value})} placeholder="07011, 07012, 07013"/></label>
      <label>Starting address (optional)<input value={form.base_address||""} onChange={e=>setForm({...form,base_address:e.target.value})} placeholder="Shop or daily starting address"/></label>
      <p className="area-footnote">Leads with a matching ZIP appear in this zone automatically. You can override their assignment inside any job.</p>
    </>}
    {(modal==="lead"||modal==="contact")&&<>
     <div className="form-grid"><label>Customer name *<input autoFocus required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></label><label>Phone number<input value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(555) 010-1234" type="tel"/></label></div>
     <div className="form-grid"><label>Email<input type="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} placeholder="customer@email.com"/></label><label>Job site address<input value={form.address||""} onChange={e=>setForm({...form,address:e.target.value})} placeholder="123 Main St, Clifton, NJ 07011 32601"/></label></div>
     {modal==="lead"&&<label>Service area (optional)<select value={form.route_zone||""} onChange={e=>setForm({...form,route_zone:e.target.value})}><option value="">Match automatically by ZIP</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
     {modal==="lead"&&<div className="form-grid"><label>Service needed<input value={form.service||""} onChange={e=>setForm({...form,service:e.target.value})} placeholder="e.g. Garage epoxy flooring"/></label><label>Lead source<select value={form.source||"Website"} onChange={e=>setForm({...form,source:e.target.value})}>{["Website","Google","Phone","Referral","Facebook","Other"].map(x=><option key={x}>{x}</option>)}</select></label></div>}
     <label>Notes<textarea rows={3} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Anything the team should know"/></label>
    </>}
    {modal==="job"&&<>
      {form.created_at&&<div className="lead-received-banner"><div><Clock size={18}/><div><b>Lead received</b><span>{leadReceived(form.created_at)}</span></div></div><strong>{leadAge(form.created_at,now)}</strong></div>}
      {form.lead_details&&Object.keys(form.lead_details).length>0&&<section className="intake-details">
       <div className="intake-heading"><div><b><ClipboardList size={17}/> {(form.lead_details.source_message_id||form.lead_details.gmail_message_id)?"Original email inquiry":"Customer project details"}</b><span>Project information captured from the customer's original request</span></div><span className="intake-new">{(form.lead_details.source_message_id||form.lead_details.gmail_message_id)?"Email lead":"Project lead"}</span></div>
       <div className="intake-grid">
        {[
          ["Finish type","finish_type"],["Approximate size","approx_size"],
          ["Project timeline","timeline"],["ZIP code","zip"],
          ["Date received","lead_received_at"]
        ].map(([label,key])=><div key={key}><span>{label}</span><strong>{form.lead_details[key]||"Not provided"}</strong></div>)}
       </div>
       <div className="intake-source"><MapPin size={15}/><span>Source: {form.source||"Epoxy Creations inquiry"}</span>
       {typeof form.lead_details.gmail_source_url==="string"&&form.lead_details.gmail_source_url.startsWith("https://mail.google.com/mail/")&&<a href={form.lead_details.gmail_source_url} target="_blank" rel="noopener noreferrer">Open source email <ExternalLink size={14}/></a>}
       </div>
      </section>}
      {form.contact_id&&person(form.contact_id)&&<div className="intake-customer">
       <div className="avatar">{initials(person(form.contact_id).name)}</div><div><b>{person(form.contact_id).name}</b><span>{form.stage==="completed"?"Completed customer":"Lead contact"}</span></div>
       {person(form.contact_id).phone&&<a href={"tel:"+person(form.contact_id).phone} className="intake-contact-link"><Phone size={15}/> Call</a>}
       {person(form.contact_id).email&&<a href={"mailto:"+person(form.contact_id).email} className="intake-contact-link"><Mail size={15}/> Email</a>}
      </div>}
      <div className="form-grid"><label>Customer *<select required value={form.contact_id||""} onChange={e=>setForm({...form,contact_id:e.target.value})}><option value="">Choose a customer</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Service *<input required value={form.service||""} onChange={e=>setForm({...form,service:e.target.value})} placeholder="e.g. Concrete coating"/></label></div>
      <div className="form-grid"><label>Stage<select value={form.stage||"new"} onChange={e=>setForm({...form,stage:e.target.value})}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>Lead source<select value={form.source||"Phone"} onChange={e=>setForm({...form,source:e.target.value})}>{["Website","Google","Phone","Referral","Facebook","Other"].map(x=><option key={x}>{x}</option>)}</select></label></div>
      <div className="form-grid"><label>Estimate ($)<input min="0" step="0.01" type="number" value={form.estimate_amount??""} onChange={e=>setForm({...form,estimate_amount:e.target.value})} placeholder="0"/></label><label>Final job value ($)<input min="0" step="0.01" type="number" value={form.final_amount??""} onChange={e=>setForm({...form,final_amount:e.target.value})} placeholder="0"/></label></div>
      <div className="pickup-address-block">
       <label><span className="field-label-icon"><MapPin size={15}/> Job site street address</span><input value={draftAddress(form)} onChange={e=>setForm({...form,pickup_address:e.target.value,_addressEdited:true})} placeholder="123 Main St, Clifton, NJ 07011 32601" autoComplete="street-address"/></label>
       <div className="pickup-action-links">
        {hasStreetAddress(draftAddress(form))?
         <a href={mapsUrl(draftAddress(form))} target="_blank" rel="noopener noreferrer"><MapPin size={15}/> Open in Maps <ExternalLink size={13}/></a>:
         <small>Add street, city, state and ZIP before scheduling a job site.</small>}
        {form.id&&hasStreetAddress(addressForJob(jobs.find(j=>j.id===form.id)))&&
         (draftAddress(form)===addressForJob(jobs.find(j=>j.id===form.id)))&&
         <button type="button" onClick={()=>viewHouse(jobs.find(j=>j.id===form.id))}><ExternalLink size={15}/> View House <ArrowUpRight size={13}/></button>}
       </div>
       {form.id&&form._addressEdited&&draftAddress(form)!==addressForJob(jobs.find(j=>j.id===form.id))&&<p className="pickup-save-hint">Save this address before using View House.</p>}
      </div>
      <label>Service area<select value={form.route_zone||""} onChange={e=>setForm({...form,route_zone:e.target.value})}><option value="">Match automatically by ZIP</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label>Scheduled date and time<input type="datetime-local" value={form.scheduled_at||""} onChange={e=>setForm({...form,scheduled_at:e.target.value})}/></label>
      <label>Latest contact note<textarea rows={3} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Example: Called Tuesday at 2:25 PM. No answer, left voicemail."/></label>
      {form.id&&<div className="lead-followup-cta"><div><b>Need to contact this lead again?</b><span>Add a categorized follow-up with the latest note. The lead remains in the pipeline.</span></div><button type="button" className="btn btn-outline" onClick={()=>openFollowUpFromLead(form)}><ListTodo size={17}/> Add to follow-ups <ArrowRight size={15}/></button></div>}
    </>}
    {modal==="task"&&<>
      <label>Follow-up action *<input autoFocus required value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Call customer about their estimate"/></label>
      <div className="form-grid">
       <label>Follow-up category *<select value={form.category||"follow_up"} onChange={e=>setForm({...form,category:e.target.value})}>{FOLLOW_UP_CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
       <label>Due date and time *<input required type="datetime-local" value={form.due_at||""} onChange={e=>setForm({...form,due_at:e.target.value})}/></label>
      </div>
      <label>Related lead or customer<select value={form.contact_id||""} onChange={e=>setForm({...form,contact_id:e.target.value||null,job_id:e.target.value===form.contact_id?form.job_id:null})}><option value="">No related lead</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Latest contact note<textarea rows={4} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="What happened on the last call? What should we remember next time?"/></label>
      {form.job_id&&<div className="task-job-related"><Link2 size={15}/> Linked to the corresponding lead in the pipeline</div>}
    </>}
    {error&&<p className="error-text">{error}</p>}
    <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={()=>setModal(null)}>Cancel</button><button className="btn btn-primary" type="submit" disabled={saving}>{saving?"Saving…":"Save "+(modal==="area"?"area":modal==="lead"?"lead":modal==="job"?"job":modal==="task"?"follow-up":"customer")} <Check size={17}/></button></div>
   </form></div></div>}
 </div>;
}
createRoot(document.getElementById("root")).render(<App/>);
