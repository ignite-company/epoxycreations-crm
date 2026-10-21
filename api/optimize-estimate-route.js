import { createClient } from "@supabase/supabase-js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const zipOf=x=>(String(x||"").match(/\b\d{5}(?:-\d{4})?\b/)||[])[0]?.slice(0,5)||"";
const street=x=>typeof x==="string"&&x.trim().length>=12&&/\d/.test(x)&&!/^ZIP[\s-]*\d{5}$/i.test(x.trim());
function place(job,contact){
 if(street(job.pickup_address))return {address:job.pickup_address.trim(),precise:true};
 if(street(contact?.address))return {address:contact.address.trim(),precise:true};
 const zip=zipOf(job.pickup_address)||zipOf(contact?.address)||zipOf(job.lead_details?.zip);
 return zip?{address:zip+", USA",precise:false}:null;
}
const send=(res,status,result)=>res.status(status).json(result);
export default async function handler(req,res){
 if(req.method!=="POST"){res.setHeader("Allow","POST");return send(res,405,{error:"Only POST requests are supported."});}
 res.setHeader("Cache-Control","private, no-store");
 const token=(req.headers.authorization||"").match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return send(res,401,{error:"Sign in to optimize a route."});
 const url=process.env.VITE_SUPABASE_URL;
 const key=process.env.VITE_SUPABASE_ANON_KEY;
 if(!url||!key)return send(res,503,{error:"The private CRM is not connected to Supabase."});
 let client;
 try{client=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});}
 catch{return send(res,503,{error:"The CRM authentication service is not available."});}
 const auth=await client.auth.getUser(token);
 const user=auth.data?.user;
 if(!user)return send(res,401,{error:"Your session expired. Please sign in again."});
 const {workspaceId,origin,jobIds,returnToStart}=typeof req.body==="string"?JSON.parse(req.body||"{}"):(req.body||{});
 if(!UUID.test(workspaceId||"")||typeof origin!=="string"||origin.trim().length<8||origin.length>250
    ||!Array.isArray(jobIds)||jobIds.length<1||jobIds.length>8
    ||jobIds.some(id=>typeof id!=="string"||!UUID.test(id))
    ||new Set(jobIds).size!==jobIds.length||typeof returnToStart!=="boolean"){
    return send(res,400,{error:"Provide a starting street address and between 1 and 8 valid estimate stops."});
 }
 const member=await client.from("epoxy_workspace_members").select("user_id")
 .eq("user_id",user.id).eq("workspace_id",workspaceId).maybeSingle();
 if(member.error||!member.data)return send(res,403,{error:"You do not have access to this business route."});
 const jobsResult=await client.from("epoxy_jobs")
 .select("id,contact_id,pickup_address,lead_details,stage").eq("workspace_id",workspaceId).in("id",jobIds);
 if(jobsResult.error)return send(res,500,{error:"Could not load selected estimates."});
 const jobs=jobsResult.data||[];
 if(jobs.length!==jobIds.length||jobs.some(job=>["lost","completed","booked"].includes(job.stage)))
 return send(res,400,{error:"At least one selected lead is unavailable."});
 const cids=[...new Set(jobs.map(j=>j.contact_id))];
 const contacts=await client.from("epoxy_contacts").select("id,address").eq("workspace_id",workspaceId).in("id",cids);
 if(contacts.error)return send(res,500,{error:"Could not load customer locations."});
 const byContact=new Map((contacts.data||[]).map(c=>[c.id,c]));
 const ordered=jobIds.map(id=>jobs.find(job=>job.id===id));
 const locations=ordered.map(job=>place(job,byContact.get(job.contact_id)));
 if(locations.some(p=>!p))return send(res,400,{error:"Every stop needs a street address or ZIP code."});
 // Billing is enabled only by a server-side secret, never exposed through the Vite client bundle.
 const googleKey=process.env.GOOGLE_MAPS_ROUTES_API_KEY;
 if(!googleKey)return send(res,503,{error:"Automatic drive-time optimization is not enabled yet. You can still save, reorder, and open this route in Google Maps. To enable automatic ordering, add a billed Google Maps Routes API key as GOOGLE_MAPS_ROUTES_API_KEY in Vercel (server environment variable)."});
 const waypoints=locations.map(x=>({address:x.address}));
 const intermediate=returnToStart?waypoints:waypoints.slice(0,-1);
 const body={
  origin:{address:origin.trim()},
  destination:{address:returnToStart?origin.trim():waypoints[waypoints.length-1].address},
  intermediates:intermediate,
  travelMode:"DRIVE",
  routingPreference:"TRAFFIC_AWARE",
  optimizeWaypointOrder:intermediate.length>1
 };
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  let response;
  try{response=await fetch("https://routes.googleapis.com/directions/v2:computeRoutes",{
    method:"POST",signal:controller.signal,
    headers:{"Content-Type":"application/json","X-Goog-Api-Key":googleKey,
       "X-Goog-FieldMask":"routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration"},
    body:JSON.stringify(body)
  });}finally{clearTimeout(timeout);}
  const result=await response.json();
  if(!response.ok||!result?.routes?.length)return send(res,502,{error:response.status===429?"Google routing is busy. Try again shortly.":"Could not calculate a road route. Check that all addresses are valid and Routes API billing is enabled."});
  const route=result.routes[0];
  const indices=intermediate.length>1?route.optimizedIntermediateWaypointIndex:intermediate.map((_,i)=>i);
  if(!Array.isArray(indices)||indices.length!==intermediate.length||new Set(indices).size!==intermediate.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=intermediate.length))
    return send(res,502,{error:"The routing service did not return a complete stop order."});
  const ids=indices.map(i=>jobIds[i]);
  if(!returnToStart)ids.push(jobIds[jobIds.length-1]);
  const distanceMeters=route.distanceMeters;
  const durationSeconds=Math.round(parseFloat(String(route.duration||"0").replace(/s$/,"")));
  if(!Number.isInteger(distanceMeters)||!Number.isFinite(durationSeconds))return send(res,502,{error:"Google did not return complete route measurements."});
  return send(res,200,{orderedIds:ids,distanceMeters,durationSeconds,
    approximateCount:locations.filter(x=>!x.precise).length});
 }catch(err){return send(res,502,{error:err?.name==="AbortError"?"Google routing timed out. Try again.":"The routing service is temporarily unavailable."});}
}
