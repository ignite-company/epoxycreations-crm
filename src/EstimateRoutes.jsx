import React, {useEffect, useMemo, useState} from "react";
import { MapPin, Route, Plus, Navigation, Check, ChevronUp, ChevronDown, ArrowRight, CalendarDays, CircleHelp, ExternalLink, Loader2, Save, LocateFixed, AlertCircle, Clock3 } from "lucide-react";
import "./EstimateRoutes.css";

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const today=()=>new Date().toLocaleDateString("en-CA");
const getZip=(value="")=>(String(value).match(/\b\d{5}(?:-\d{4})?\b/)||[])[0]?.slice(0,5)||"";
const isStreet=(value="")=>value.trim().length>=12&&/\d/.test(value)&&!/^ZIP[\s-]*\d{5}$/i.test(value.trim());
const goDate=val=>new Date(val+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
const getPlace=(job,contact)=>{
 const candidate=job.pickup_address?.trim()||"";
 if(isStreet(candidate))return {place:candidate,accurate:true};
 const inherited=contact?.address?.trim()||"";
 if(isStreet(inherited))return {place:inherited,accurate:true};
 const zip=getZip(candidate)||getZip(inherited)||getZip(job.lead_details?.zip);
 return {place:zip?zip+", USA":"",accurate:false,zip};
};
const mapsLink=(start,stops,returnToStart)=>{
 if(!start.trim()||!stops.length)return "";
 const locations=stops.map(s=>s.place).filter(Boolean);
 if(locations.length!==stops.length)return "";
 const end=returnToStart?start.trim():locations[locations.length-1];
 const intermediates=returnToStart?locations:locations.slice(0,-1);
 const params=new URLSearchParams({api:"1",origin:start.trim(),destination:end,travelmode:"driving"});
 if(intermediates.length)params.set("waypoints",intermediates.join("|"));
 const link="https://www.google.com/maps/dir/?"+params.toString();
 return link.length<=2048?link:"";
};

export default function EstimateRoutes({db,session,workspaceId,jobs=[],contacts=[],areas=[],onEditJob}){
 const[date,setDate]=useState(today);
 const[start,setStart]=useState("");
 const[returnHome,setReturnHome]=useState(true);
 const[ids,setIds]=useState([]);
 const[savedId,setSavedId]=useState(null);
 const[zone,setZone]=useState("all");
 const[loading,setLoading]=useState(true);
 const[saving,setSaving]=useState(false);
 const[optimizing,setOptimizing]=useState(false);
 const[notice,setNotice]=useState("");
 const[error,setError]=useState("");
 const[summary,setSummary]=useState(null);
 const contactsById=useMemo(()=>new Map(contacts.map(c=>[c.id,c])),[contacts]);
 const eligible=useMemo(()=>jobs.filter(j=>j.stage!=="lost"&&j.stage!=="completed"&&j.stage!=="booked").map(j=>({...j,contact:contactsById.get(j.contact_id),location:getPlace(j,contactsById.get(j.contact_id))})),[jobs,contactsById]);
 const eligibleById=useMemo(()=>new Map(eligible.map(j=>[j.id,j])),[eligible]);
 const currentIds=ids.filter(id=>eligibleById.has(id));
 const stops=currentIds.map(id=>eligibleById.get(id));
 const incomplete=stops.filter(s=>!s.location.place);
 const approximate=stops.filter(s=>s.location.place&&!s.location.accurate);
 const exactCount=stops.length-incomplete.length-approximate.length;
 const routeLink=mapsLink(start,stops.map(s=>s.location),returnHome);
 const filtered=eligible.filter(j=>{
   if(zone==="all")return true;
   if(zone==="unassigned")return !areaFor(j);
   return areaFor(j)?.id===zone;
 });
 function areaFor(j){
   if(j.route_zone){const a=areas.find(a=>a.id===j.route_zone);if(a)return a;}
   const zip=j.location.zip||getZip(j.location.place);
   return areas.find(a=>String(a.zip_codes||"").split(/[,;\s]+/).includes(zip))||null;
 }
 useEffect(()=>{
   let active=true;
   async function loadPlan(){
     if(!db||!workspaceId){setLoading(false);return;}
     setLoading(true);setError("");setNotice("");
     const result=await db.from("epoxy_estimate_routes").select("*").eq("workspace_id",workspaceId).eq("plan_date",date).maybeSingle();
     if(!active)return;
     if(result.error){setError("Could not load route plan: "+result.error.message);setLoading(false);return;}
     const plan=result.data;
     if(plan){
       setStart(plan.start_address||"");
       setReturnHome(plan.return_to_start!==false);
       setIds(Array.isArray(plan.stop_ids)?plan.stop_ids:[]);
       setSavedId(plan.id);
       setSummary(plan.optimized_at&&plan.total_distance_meters!=null?{meters:plan.total_distance_meters,seconds:plan.total_duration_seconds}:null);
     }else{
       const previous=await db.from("epoxy_estimate_routes").select("start_address,return_to_start").eq("workspace_id",workspaceId).neq("start_address","").order("updated_at",{ascending:false}).limit(1);
       if(!active)return;
       setStart(previous.data?.[0]?.start_address||"");
       setReturnHome(previous.data?.[0]?.return_to_start!==false);
       setIds([]);
       setSavedId(null);
       setSummary(null);
     }
     setLoading(false);
   }
   loadPlan();
   return ()=>{active=false;};
 },[db,workspaceId,date]);
 function invalidate(){setSummary(null);setNotice("");}
 function addStop(id){
   if(currentIds.includes(id)){setIds(prev=>prev.filter(i=>i!==id));invalidate();return;}
   if(currentIds.length>=8){setError("Plan up to 8 stops at a time. Create another day's route for the remaining estimates.");return;}
   setIds(prev=>[...prev,id]);setError("");invalidate();
 }
 function moveStop(index,direction){
   const next=[...currentIds];const other=index+direction;
   if(other<0||other>=next.length)return;
   [next[index],next[other]]=[next[other],next[index]];
   setIds(next);invalidate();
 }
 async function persist(nextIds=currentIds,nextSummary=summary,{silent=false}={}){
   if(!db||!workspaceId)throw Error("Sign in to save your estimate route.");
   if(!start.trim()||start.trim().length<8)throw Error("Enter a complete starting address with a street, town and state.");
   if(nextIds.length>8||nextIds.some(id=>!uuidPattern.test(id)))throw Error("A route supports up to 8 valid stops.");
   const payload={
      ...(savedId?{id:savedId}:{}),
      workspace_id:workspaceId,plan_date:date,start_address:start.trim(),
      return_to_start:returnHome,stop_ids:nextIds,
      total_distance_meters:nextSummary?.meters??null,
      total_duration_seconds:nextSummary?.seconds??null,
      optimized_at:nextSummary?new Date().toISOString():null,
      updated_at:new Date().toISOString()
   };
   const res=await db.from("epoxy_estimate_routes").upsert(payload,{onConflict:"workspace_id,plan_date"}).select("id").single();
   if(res.error)throw Error(res.error.message);
   setSavedId(res.data.id);
   if(!silent)setNotice("Estimate route saved for "+goDate(date)+".");
 }
 async function savePlan(){
   try{setSaving(true);setError("");await persist();}catch(e){setError(e.message||"Could not save route.");}finally{setSaving(false);}
 }
 async function optimize(){
   setError("");setNotice("");
   if(start.trim().length<8){setError("Enter a full starting address first.");return;}
   if(!currentIds.length){setError("Select at least one estimate first.");return;}
   if(incomplete.length){setError("Some selected leads have no address or ZIP. Add their location before optimizing.");return;}
   try{
     setOptimizing(true);
     const {data:{session:activeSession}}=await db.auth.getSession();
     if(!activeSession?.access_token)throw Error("Please sign in again.");
     const response=await fetch("/api/optimize-estimate-route",{
       method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+activeSession.access_token},
       body:JSON.stringify({workspaceId,date,origin:start.trim(),returnToStart:returnHome,jobIds:currentIds})
     });
     const data=await response.json();
     if(!response.ok)throw Error(data.error||"Could not optimize route.");
     if(!Array.isArray(data.orderedIds)||data.orderedIds.length!==currentIds.length)throw Error("Routing service returned an incomplete route.");
     const result={meters:data.distanceMeters,seconds:data.durationSeconds};
     setIds(data.orderedIds);setSummary(result);
     await persist(data.orderedIds,result,{silent:true});
     setNotice(data.approximateCount
       ?"Optimized using road routes for "+data.orderedIds.length+" stops. "+data.approximateCount+" ZIP-only location(s) are approximate. Confirm street addresses before driving."
       :"Optimized the driving order and saved your route.");
   }catch(e){setError(e.message||"Optimization was unavailable.");}
   finally{setOptimizing(false);}
 }
 return <div className="estimate-page">
   <div className="estimate-cover">
      <div><span className="estimate-eyebrow"><Route size={15}/> FIELD OPERATIONS / ESTIMATES</span>
       <h2>One trip. Every estimate.</h2>
       <p>Pick your leads, enter where you're leaving from, and build a drive that keeps you moving forward rather than backtracking.</p>
      </div><div className="estimate-cover-mark"><Navigation size={39}/></div>
   </div>
   <div className="estimate-layout">
    <section className="estimate-panel estimate-main">
      <div className="estimate-panel-heading"><div><span className="estimate-section-label">01 / ROUTE SETUP</span><h3>Plan the estimate day</h3></div><span className="estimate-saving-status"><CalendarDays size={14}/> Saved per date</span></div>
      <div className="estimate-fields">
       <label>Estimate date<input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
       <label>Starting address<input placeholder="Street address, city, state and ZIP" value={start} onChange={e=>{setStart(e.target.value);invalidate();}} /></label>
      </div>
      <label className="estimate-return-option"><input type="checkbox" checked={returnHome} onChange={e=>{setReturnHome(e.target.checked);invalidate();}} /><div><b>Return to starting address</b><span>Include the drive home when finding the shortest practical loop. Turn off to finish at the last selected stop.</span></div></label>
      <div className="estimate-mini-tip"><LocateFixed size={16}/> Use a precise street address for the starting point. The last stop is fixed if you choose a one-way route.</div>
      <div className="estimate-heading-line"><div><span className="estimate-section-label">02 / PICK YOUR STOPS</span><h3>Available estimate leads <span>{eligible.length}</span></h3></div>
       <select value={zone} aria-label="Filter leads by service area" onChange={e=>setZone(e.target.value)}><option value="all">All service areas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}<option value="unassigned">Unassigned</option></select>
      </div>
      <p className="estimate-guidance">Select up to 8 customers. Only leads and open estimates appear here, not confirmed jobs.</p>
      <div className="estimate-available">
       {filtered.length===0&&<div className="estimate-empty">No available estimate leads in this area. Try another service area or add a lead.</div>}
       {filtered.map(j=><div className={"estimate-available-row "+(currentIds.includes(j.id)?"chosen":"")} key={j.id}>
        <div className="estimate-initials">{(j.contact?.name||"?").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}</div>
        <div className="estimate-lead-desc"><b>{j.contact?.name||"Unnamed contact"}</b><span>{j.service} · {areaFor(j)?.name||"No saved territory"}</span><small><MapPin size={12}/>{j.location.accurate?j.location.place:j.location.place? "ZIP "+j.location.zip+" (approximate)":"Address needed"}</small></div>
        <div className="estimate-row-actions">
         <button className="estimate-icon-action" onClick={()=>onEditJob(j)} title="Edit project address">Edit</button>
         <button className={"estimate-select "+(currentIds.includes(j.id)?"selected":"")} onClick={()=>addStop(j.id)} aria-pressed={currentIds.includes(j.id)}>{currentIds.includes(j.id)?<><Check size={13}/> Added</>:<><Plus size={13}/> Add</>}</button>
        </div>
       </div>)}
      </div>
    </section>
    <section className="estimate-panel estimate-itinerary">
      <div className="estimate-panel-heading"><div><span className="estimate-section-label">03 / ITINERARY</span><h3>{goDate(date)}</h3></div><span className="estimate-stop-count">{currentIds.length} of 8 stops</span></div>
      {loading?<div className="estimate-empty">Loading saved route…</div>:<>
       <div className="estimate-departure"><span className="estimate-departure-icon"><MapPin size={17}/></span><div><b>Start</b><span>{start.trim()||"Enter your starting address"}</span></div></div>
       {stops.length?stops.map((j,i)=><div className="estimate-itinerary-row" key={j.id}>
         <span className="estimate-number">{i+1}</span>
         <div><b>{j.contact?.name||"Customer"}</b><span>{j.location.accurate?j.location.place:j.location.place?"ZIP "+j.location.zip+" · Approximate stop":"No location saved"}</span></div>
         <div className="estimate-reorder">
          <button aria-label={"Move "+j.contact?.name+" earlier"} disabled={i===0} onClick={()=>moveStop(i,-1)}><ChevronUp size={17}/></button>
          <button aria-label={"Move "+j.contact?.name+" later"} disabled={i===stops.length-1} onClick={()=>moveStop(i,1)}><ChevronDown size={17}/></button>
         </div>
       </div>):<div className="estimate-empty">Choose leads from the left to build the day's estimate route.</div>}
       {returnHome&&<div className="estimate-departure estimate-finish"><span className="estimate-departure-icon"><Check size={16}/></span><div><b>Finish back at start</b><span>{start.trim()||"Same starting address"}</span></div></div>}
       <div className="estimate-quality"><span><MapPin size={15}/>{exactCount} street address{exactCount===1?"":"es"}</span><span>{approximate.length} ZIP-only</span>{incomplete.length>0&&<span>{incomplete.length} missing</span>}</div>
       {summary&&<div className="estimate-summary"><div><b>{(summary.meters/1609.344).toFixed(1)} mi</b><span>Estimated road distance</span></div><div><b>{Math.round(summary.seconds/60)} min</b><span>Estimated driving time, excluding visits</span></div></div>}
       <button className="btn btn-primary estimate-wide-button" disabled={saving||!start.trim()} onClick={savePlan}><Save size={15}/>{saving?"Saving…":"Save route plan"}</button>
       <button className="btn btn-outline estimate-wide-button" disabled={optimizing||!start.trim()||currentIds.length===0||incomplete.length>0} onClick={optimize}>{optimizing?<Loader2 size={15} className="estimate-spinning"/>:<Route size={15}/>} {optimizing?"Calculating…":"Optimize driving order"}</button>
       {routeLink?<a className="estimate-maps-link" href={routeLink} target="_blank" rel="noopener noreferrer"><Navigation size={17}/> Open directions in Google Maps <ExternalLink size={14}/></a>:<div className="estimate-maps-disabled">Add a starting address and at least one located stop to open Maps.</div>}
       {error&&<div className="estimate-message error"><AlertCircle size={15}/>{error}</div>}
       {notice&&<div className="estimate-message success"><Check size={15}/>{notice}</div>}
       {approximate.length>0&&<div className="estimate-foot"><CircleHelp size={16}/> ZIP-only entries route to the general postal area, not the customer's driveway. Add street addresses to each lead for reliable routing.</div>}
       <div className="estimate-foot"><Clock3 size={16}/> Google Maps shows current routes and travel times in the selected order. Automatic reordering requires a Google Routes API key with billing, configured privately in Vercel. Mobile browsers can ignore some waypoints, so check the route in the Maps app.</div>
      </>}
    </section>
   </div>
 </div>;
}
