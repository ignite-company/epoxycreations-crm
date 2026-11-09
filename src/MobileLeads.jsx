import React, { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, Clock3, ListTodo, Mail, MapPin, Phone, Search } from "lucide-react";

// Mobile-first lead list. The desktop Kanban board remains unchanged.
const fmtDate = value => value ? new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric"
}).format(new Date(value)) : "Unknown date";
const fmtMoney = value => value == null ? "Not quoted" :
  new Intl.NumberFormat("en-US", {style:"currency", currency:"USD", maximumFractionDigits:0}).format(Number(value)||0);
const valueOrDash = value => String(value ?? "").trim() || "Not provided";

export default function MobileLeads({ jobs = [], contacts = [], stages = [], onEdit, onAddFollowUp }) {
  const [search,setSearch] = useState("");
  const [stage,setStage] = useState("all");
  const [expanded,setExpanded] = useState(null);
  const [limit,setLimit] = useState(12);
  const contactMap = useMemo(() => new Map(contacts.map(c => [c.id,c])), [contacts]);
  const rows = useMemo(() => jobs.map(job => ({job, contact:contactMap.get(job.contact_id)||{}}))
    .filter(({job,contact}) => {
      if(stage !== "all" && job.stage !== stage) return false;
      const q=search.trim().toLocaleLowerCase();
      if(!q) return true;
      return [
        contact.name,contact.phone,contact.email,contact.address,
        job.service,job.source,job.notes,job.lead_details?.zip,
        job.lead_details?.finish_type,job.lead_details?.timeline
      ].some(v=>String(v||"").toLocaleLowerCase().includes(q));
    })
    .sort((a,b)=>new Date(b.job.created_at||0)-new Date(a.job.created_at||0)),
    [jobs,contactMap,stage,search]);
  const resetLimit = () => setLimit(12);
  return <section className="mobile-leads" aria-label="Mobile customer leads">
    <div className="ml-tools">
      <label className="ml-search"><Search size={17} aria-hidden="true"/><span className="ml-sr">Search leads</span>
        <input type="search" placeholder="Search name, phone or ZIP" value={search}
          onChange={e=>{setSearch(e.target.value);resetLimit();}}/>
      </label>
      <label className="ml-stage-label"><span className="ml-sr">Filter by lead stage</span>
        <select aria-label="Filter leads by stage" value={stage} onChange={e=>{setStage(e.target.value);resetLimit();}}>
          <option value="all">All stages</option>
          {stages.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}
        </select>
      </label>
    </div>
    <div className="ml-summary"><strong>{rows.length}</strong> matching lead{rows.length===1?"":"s"}<span>Tap a customer for details</span></div>
    <div className="ml-list">
      {rows.slice(0,limit).map(({job,contact})=>{
        const open = expanded===job.id;
        const detail=job.lead_details||{};
        const displayName=contact.name||"Unnamed customer";
        const stageName=stages.find(s=>s.id===job.stage)?.label||job.stage||"New lead";
        return <article className={"ml-card"+(open?" ml-card-open":"")} key={job.id}>
          <div className="ml-card-main">
            <div className="ml-card-heading">
              <div><h3>{displayName}</h3><p>{job.service||"Epoxy flooring"}</p></div>
              <span className={"ml-stage ml-stage-"+(job.stage||"new")}>{stageName}</span>
            </div>
            <div className="ml-card-meta">
              {detail.zip&&<span><MapPin size={13} aria-hidden="true"/> ZIP {detail.zip}</span>}
              {detail.timeline&&<span><Clock3 size={13} aria-hidden="true"/> {detail.timeline}</span>}
              {!detail.zip&&!detail.timeline&&<span><Clock3 size={13} aria-hidden="true"/> Received {fmtDate(job.created_at)}</span>}
            </div>
            <div className="ml-card-actions">
              {contact.phone&&<a href={"tel:"+contact.phone} className="ml-contact"><Phone size={16}/> Call</a>}
              {contact.email&&<a href={"mailto:"+contact.email} className="ml-contact"><Mail size={16}/> Email</a>}
              <button type="button" className="ml-details-toggle" aria-expanded={open}
                aria-label={(open?"Hide":"Show")+" details for "+displayName}
                onClick={()=>setExpanded(open?null:job.id)}>
                {open?"Hide details":"View details"} {open?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
              </button>
            </div>
          </div>
          {open&&<div className="ml-details">
            <dl>
              <div><dt>Phone</dt><dd>{contact.phone?<a href={"tel:"+contact.phone}>{contact.phone}</a>:"Not provided"}</dd></div>
              <div><dt>Email</dt><dd>{contact.email?<a href={"mailto:"+contact.email}>{contact.email}</a>:"Not provided"}</dd></div>
              <div><dt>Finish</dt><dd>{valueOrDash(detail.finish_type)}</dd></div>
              <div><dt>Project size</dt><dd>{valueOrDash(detail.approx_size)}</dd></div>
              <div><dt>Timeline</dt><dd>{valueOrDash(detail.timeline)}</dd></div>
              <div><dt>ZIP</dt><dd>{valueOrDash(detail.zip)}</dd></div>
              <div><dt>Estimate</dt><dd>{fmtMoney(job.estimate_amount)}</dd></div>
              <div><dt>Received</dt><dd>{fmtDate(job.created_at)}</dd></div>
            </dl>
            {contact.address&&<p className="ml-address"><strong>Address:</strong> {contact.address}</p>}
            {job.notes&&!/historical inquiry imported from email/i.test(job.notes)&&<p className="ml-note"><strong>Notes:</strong> {job.notes}</p>}
            <div className="ml-footer-actions">
              <button type="button" onClick={()=>onEdit(job)}><ArrowUpRight size={16}/> Open full record</button>
              <button type="button" onClick={()=>onAddFollowUp(job)}><ListTodo size={16}/> Add follow-up</button>
            </div>
          </div>}
        </article>;
      })}
      {!rows.length&&<div className="ml-empty">No leads match your search. Try another name, phone number, ZIP or stage.</div>}
    </div>
    {rows.length>limit&&<button type="button" className="ml-show-more" onClick={()=>setLimit(n=>n+12)}>
      Show 12 more leads ({rows.length-limit} remaining) <ChevronDown size={17}/>
    </button>}
  </section>;
}
