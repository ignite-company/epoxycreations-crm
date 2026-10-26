import React, {useEffect, useMemo, useState} from "react";
import { MapPin, Navigation, CalendarDays, Check, Plus, ArrowUp, ArrowDown, ExternalLink, AlertCircle, Search, Save, Route } from "lucide-react";
import "./EstimateRoutes.css";

// A simple planner, not an automatic shortest-route engine.
// Google's directions open in the same stop order shown here.
const today=()=>new Date().toLocaleDateString("en-CA");
const zipOf=value=>(String(value||"").match(/\b\d{5}(?:-\d{4})?\b/)||[])[0]?.slice(0,5)||"";
const fullAddress=value=>Boolean(value&&String(value).trim().length>=12&&/\d/.test(value)&&!/^ZIP\s*\d{5}$/i.test(String(value).trim()));
const locationFor=(job,contact)=>{
  if(fullAddress(job.pickup_address))return {address:job.pickup_address.trim(),exact:true};
  if(fullAddress(contact?.address))return {address:contact.address.trim(),exact:true};
  const zip=zipOf(job.pickup_address)||zipOf(contact?.address)||zipOf(job.lead_details?.zip);
  return {address:zip?zip+", USA":"",exact:false,zip};
};
const mapsDirections=(origin,stops)=>{
  if(!origin.trim()||!stops.length||stops.some(s=>!s.location.address))return "";
  const params=new URLSearchParams({
    api:"1",origin:origin.trim(),
    destination:stops[stops.length-1].location.address,
    travelmode:"driving"
  });
  if(stops.length>1)params.set("waypoints",stops.slice(0,-1).map(s=>s.location.address).join("|"));
  const result="https://www.google.com/maps/dir/?"+params.toString();
  return result.length<=2048?result:"";
};

export default function EstimateRoutes({db,workspaceId,jobs=[],contacts=[],onAddressSaved}){
  const [date,setDate]=useState(today);
  const [start,setStart]=useState("");
  const [selected,setSelected]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const [search,setSearch]=useState("");
  const [reorder,setReorder]=useState(false);
  const [editingAddress,setEditingAddress]=useState(null);
  const [addressValue,setAddressValue]=useState("");
  const [addressSaving,setAddressSaving]=useState(false);
  const [addressError,setAddressError]=useState("");
  const contactIndex=useMemo(()=>new Map(contacts.map(c=>[c.id,c])),[contacts]);
  const leads=useMemo(()=>jobs
    .filter(j=>!["lost","completed","booked"].includes(j.stage))
    .map(j=>({...j,contact:contactIndex.get(j.contact_id),location:locationFor(j,contactIndex.get(j.contact_id))}))
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),[jobs,contactIndex]);
  const leadsById=useMemo(()=>new Map(leads.map(j=>[j.id,j])),[leads]);
  const selectedIds=selected.filter(id=>leadsById.has(id));
  const stops=selectedIds.map(id=>leadsById.get(id));
  const visible=leads.filter(j=>{
    const term=search.trim().toLowerCase();
    return !term||[j.contact?.name,j.service,j.location.address,j.contact?.phone].some(v=>String(v||"").toLowerCase().includes(term));
  });
  const zipOnly=stops.filter(j=>j.location.address&&!j.location.exact);
  const missing=stops.filter(j=>!j.location.address);
  const url=mapsDirections(start,stops);
  const ready=Boolean(start.trim().length>=8&&stops.length&&url&&!missing.length&&!loading);

  useEffect(()=>{
    let active=true;
    async function load(){
      setLoading(true);setError("");setStatus("");
      if(!db||!workspaceId){setLoading(false);return;}
      const plan=await db.from("epoxy_estimate_routes").select("*")
        .eq("workspace_id",workspaceId).eq("plan_date",date).maybeSingle();
      if(!active)return;
      if(plan.error){setError("We couldn't load your saved route. Please refresh.");setLoading(false);return;}
      // Restore selected stops for this day, but never prefill the starting address.
      // A prior customer's location should not appear as the next route's origin.
      setSelected(plan.data ? (plan.data.stop_ids||[]).slice(0,4) : []);
      setLoading(false);
    }
    load();
    return()=>{active=false;};
  },[db,workspaceId,date]);

  function toggle(id){
    setStatus("");setError("");
    if(selectedIds.includes(id)){setSelected(items=>items.filter(x=>x!==id));return;}
    if(selectedIds.length>=4){setError("You can add up to 4 visits to one route. Open a second route for more stops.");return;}
    setSelected(items=>[...items,id]);
  }
  function move(index,diff){
    const next=[...selectedIds],other=index+diff;
    if(other<0||other>=next.length)return;
    [next[index],next[other]]=[next[other],next[index]];
    setSelected(next);setStatus("");
  }
  async function saveStreetAddress(job){
    const address=addressValue.trim();
    if(!fullAddress(address)||address.length<15){
      setAddressError("Please enter the street number, street name, city and state.");
      return;
    }
    if(!db||!workspaceId){setAddressError("Sign in to update customer addresses.");return;}
    setAddressSaving(true);setAddressError("");setError("");
    const result=await db.from("epoxy_jobs").update({pickup_address:address})
      .eq("workspace_id",workspaceId).eq("id",job.id).select("id").single();
    setAddressSaving(false);
    if(result.error){setAddressError("Could not save this address. Please try again.");return;}
    setEditingAddress(null);setAddressValue("");
    setStatus("Address saved for "+(job.contact?.name||"customer")+".");
    if(onAddressSaved)await onAddressSaved();
  }
  async function save(showMessage=true){
    if(!db||!workspaceId){setError("Please sign in to save your visits.");return;}
    if(start.trim().length<8||!selectedIds.length){
      setError("Enter a starting address and choose at least one customer.");
      return;
    }
    setSaving(true);setError("");
    const result=await db.from("epoxy_estimate_routes").upsert({
      workspace_id:workspaceId,
      plan_date:date,
      start_address:start.trim(),
      return_to_start:false,
      stop_ids:selectedIds,
      total_distance_meters:null,
      total_duration_seconds:null,
      optimized_at:null,
      updated_at:new Date().toISOString()
    },{onConflict:"workspace_id,plan_date"}).select("id").single();
    setSaving(false);
    if(result.error)setError("We couldn't save your plan. Try again.");
    else if(showMessage)setStatus("Saved. You can come back to this date anytime.");
  }

  return <div className="easy-route">
    <div className="easy-route-header">
      <div className="easy-route-header-icon"><Route size={24}/></div>
      <div><h2>Plan your estimate visits</h2>
      <p>Choose your customers, then open the drive in Google Maps.</p></div>
    </div>

    <section className="easy-step">
      <div className="easy-step-header"><span className="easy-number">1</span><div><h3>Where are you starting?</h3><p>Enter the address you're leaving from for this route.</p></div></div>
      <div className="easy-start-grid">
        <label className="easy-field easy-start"><span>Starting address</span><input
          autoComplete="off"
          value={start} onChange={e=>{setStart(e.target.value);setStatus("");}} /></label>
        <label className="easy-field easy-date-field"><span>Day of estimates</span>
          <span className="easy-date-control">
            <span className="easy-date-display" aria-hidden="true">
              <span>{date ? new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "Choose a date"}</span>
              <CalendarDays size={18}/>
            </span>
            <input className="easy-date-input" aria-label="Day of estimates"
              type="date" value={date} onChange={e=>{setDate(e.target.value);setSearch("");setReorder(false);}} />
          </span>
        </label>
      </div>
    </section>

    <section className="easy-step">
      <div className="easy-step-header"><span className="easy-number">2</span>
        <div><h3>Who do you want to visit?</h3><p>Tap <b>Add</b> next to the customers you need to see.</p></div>
        <span className="easy-count">{selectedIds.length}/4 chosen</span>
      </div>
      <div className="easy-search"><Search size={16}/><input placeholder="Find a customer by name or ZIP" aria-label="Search estimate leads" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="easy-customer-list">
        {loading&&<div className="easy-empty">Loading your customers…</div>}
        {!loading&&visible.length===0&&<div className="easy-empty">No matching leads. Clear the search or add a new lead.</div>}
        {!loading&&visible.map(j=>{
          const isChosen=selectedIds.includes(j.id);
          return <div className={"easy-customer "+(isChosen?"easy-chosen":"")} key={j.id}>
            <span className="easy-avatar">{(j.contact?.name||"?").split(" ").slice(0,2).map(n=>n[0]).join("").toUpperCase()}</span>
            <div className="easy-customer-info">
              <strong>{j.contact?.name||"Unnamed customer"}</strong>
              <span>{j.service||"Epoxy estimate"}</span>
              <small><MapPin size={12}/>{j.location.exact?j.location.address:j.location.zip?"ZIP "+j.location.zip+" only":"Address missing"}</small>
              {!j.location.exact&&<button className="easy-address-edit" onClick={()=>{
                setEditingAddress(j.id);setAddressValue("");setAddressError("");
              }}>+ Add street address</button>}
            </div>
            <button className={"easy-add "+(isChosen?"active":"")} onClick={()=>toggle(j.id)}
              aria-pressed={isChosen}>{isChosen?<><Check size={15}/> Added</>:<><Plus size={15}/> Add</>}</button>
            {editingAddress===j.id&&<div className="easy-address-inline">
              <label>Customer's full address<input autoFocus value={addressValue}
                placeholder="123 Main St, Binghamton, NY 13901"
                onChange={e=>setAddressValue(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void saveStreetAddress(j);}}}/></label>
              <button className="easy-address-save" disabled={addressSaving} onClick={()=>{void saveStreetAddress(j);}}>{addressSaving?"Saving…":"Save address"}</button>
              <button className="easy-address-cancel" onClick={()=>{setEditingAddress(null);setAddressError("");}}>Cancel</button>
              {addressError&&<div className="easy-address-error">{addressError}</div>}
            </div>}
          </div>;
        })}
      </div>
    </section>

    <section className="easy-step easy-last-step">
      <div className="easy-step-header"><span className="easy-number">3</span><div><h3>Open your route</h3><p>We'll send your selected stops to Google Maps.</p></div></div>
      {stops.length>0&&<div className="easy-summary">
        <div className="easy-summary-title"><strong>Your {stops.length} {stops.length===1?"stop":"stops"}</strong>
          {stops.length>1&&<button onClick={()=>setReorder(v=>!v)}>{reorder?"Done":"Change order"}</button>}</div>
        {stops.map((j,i)=><div className="easy-stop" key={j.id}>
          <span className="easy-stop-num">{i+1}</span>
          <span className="easy-stop-name">{j.contact?.name||"Customer"}</span>
          <span className="easy-stop-zip">{j.location.zip||j.location.address}</span>
          {reorder?<span className="easy-move">
            <button disabled={i===0} onClick={()=>move(i,-1)} aria-label="Move stop earlier"><ArrowUp size={16}/></button>
            <button disabled={i===stops.length-1} onClick={()=>move(i,1)} aria-label="Move stop later"><ArrowDown size={16}/></button>
          </span>:<button className="easy-remove" onClick={()=>toggle(j.id)}>Remove</button>}
        </div>)}
      </div>}
      {zipOnly.length>0&&<div className="easy-warning"><AlertCircle size={17}/>
        <span>{zipOnly.length} {zipOnly.length===1?"customer has":"customers have"} only a ZIP code. Maps can show the general area, but you need their street addresses for accurate directions.</span>
      </div>}
      {missing.length>0&&<div className="easy-warning"><AlertCircle size={17}/>Some selected customers don't have a location yet. Add an address before opening Maps.</div>}
      {ready?<a className="easy-open-maps" href={url} target="_blank" rel="noopener noreferrer"
        onClick={()=>{void save(false);}}>
        <Navigation size={21}/> {zipOnly.length?"Preview route in Google Maps":"Open route in Google Maps"} <ExternalLink size={16}/>
      </a>:<div className="easy-button-disabled"><Navigation size={19}/> Enter a starting address and select customers</div>}
      <div className="easy-after"><button disabled={saving||!start.trim()||!selectedIds.length} onClick={()=>{void save();}}>
        <Save size={14}/> {saving?"Saving…":"Save for later"}</button>
        <span>Your selected stops stay together for this date.</span>
      </div>
      {error&&<div className="easy-error">{error}</div>}
      {status&&<div className="easy-success"><Check size={15}/>{status}</div>}
      <p className="easy-note">Google Maps shows the drive in the order listed above. It does not automatically rearrange the stops for the shortest trip.</p>
    </section>
  </div>;
}
