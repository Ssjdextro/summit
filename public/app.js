const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => [...root.querySelectorAll(s)];
let routes=[];
let knownStops=[];
let routePlanner=null;
let apiAvailable=false;
let googleMapsApiKey=window.KOVAI_MAPS_API_KEY||'';
let toastTimer;

async function api(url,options={}) {
  const res=await fetch(url,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});
  const data=await res.json();
  if(!res.ok) throw new Error(data.error||'Something went wrong.');
  return data;
}
const mapsConfigReady=(async()=>{try{const config=await api('/api/config');if(config.googleMapsApiKey)googleMapsApiKey=config.googleMapsApiKey}catch{}})();
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000)}
function fillStops(stops){const unique=new Map();for(const stop of stops){const key=String(stop).trim().toLocaleLowerCase();if(key&&!unique.has(key))unique.set(key,String(stop).trim())}knownStops=[...unique.values()].sort((a,b)=>a.localeCompare(b));routePlanner=window.KovaiPlanner.buildRoutePlanner(routes);refreshStopSuggestions();}
function refreshStopSuggestions(changed){let from=$('#fromStop').value.trim(),to=$('#toStop').value.trim(),knownFrom=knownStops.find(s=>s.toLocaleLowerCase()===from.toLocaleLowerCase()),knownTo=knownStops.find(s=>s.toLocaleLowerCase()===to.toLocaleLowerCase());if(knownFrom&&knownTo&&!routePlanner.plans(knownFrom,knownTo).length){if(changed==='from'){$('#toStop').value='';to='';knownTo=null}else if(changed==='to'){$('#fromStop').value='';from='';knownFrom=null}}const fromChoices=knownTo?knownStops.filter(s=>s.toLocaleLowerCase()!==knownTo.toLocaleLowerCase()&&routePlanner.plans(s,knownTo).length):knownStops;const toChoices=knownFrom?knownStops.filter(s=>s.toLocaleLowerCase()!==knownFrom.toLocaleLowerCase()&&routePlanner.plans(knownFrom,s).length):knownStops;$('#fromStopOptions').innerHTML=fromChoices.map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');$('#toStopOptions').innerHTML=toChoices.map(s=>`<option value="${escapeHtml(s)}"></option>`).join('');}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function mapPlace(value){return /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(value)?value:`${value}, Coimbatore, Tamil Nadu, India`}
function googleMapsTransitUrl(from,to){return `https://www.google.com/maps/dir/?api=1&${new URLSearchParams({origin:mapPlace(from),destination:mapPlace(to),travelmode:'transit'})}`}
function googleMapsTransitLink(from,to){return `<a class="google-transit-link" href="${escapeHtml(googleMapsTransitUrl(from,to))}" target="_blank" rel="noopener noreferrer">Check transit options on Google Maps <span>↗</span></a>`}
function googleMapsEmbed(from,to){if(!googleMapsApiKey)return '<div class="map-connect-note">Embedded map is ready to connect. Add a Maps Embed API key to show Google Maps here.</div>';const src=`https://www.google.com/maps/embed/v1/directions?${new URLSearchParams({key:googleMapsApiKey,origin:mapPlace(from),destination:mapPlace(to),mode:'transit',region:'IN'})}`;return `<div class="google-map-frame"><iframe title="Google Maps transit directions from ${escapeHtml(from)} to ${escapeHtml(to)}" src="${escapeHtml(src)}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`}
function card(r){return `<article class="route-card" style="--route-color:${escapeHtml(r.color)}"><div class="route-dots"></div><div class="route-card-top"><span class="route-number">BUS ${escapeHtml(r.number)}</span><span class="route-category">${escapeHtml(r.category.toUpperCase())}</span></div><div class="route-stops"><div class="route-end"><strong>${escapeHtml(r.from)}</strong><small>ORIGIN IN PDF</small></div><div class="route-arrow">⟶</div><div class="route-end"><strong>${escapeHtml(r.to)}</strong><small>DESTINATION IN PDF</small></div></div><div class="route-card-line"></div><div class="route-card-bottom"><span>2 endpoints listed</span><span class="service-pill">Timings unavailable</span></div></article>`}
function renderRoutes(){
  const featured=routes.filter(r=>r.featured).slice(0,6);
  $('#featuredRoutes').innerHTML=featured.map(card).join('');
  const q=$('#routeSearch').value.trim().toLocaleLowerCase();
  const list=routes.filter(r=>!q||[r.number,r.sourceNumber,r.from,r.to,r.category,...r.stops,...(r.landmarks||[])].join(' ').toLocaleLowerCase().includes(q)).sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true}));
  $('#directoryCount').textContent=`${list.length} of ${routes.length} entries`;
  $('#routeDirectory').innerHTML=list.length?list.map(r=>`<div class="directory-row"><span class="directory-badge">${escapeHtml(r.number)}</span><div class="directory-route">${escapeHtml(r.from)} <span style="color:#9aa49b">→</span> ${escapeHtml(r.to)}<small>${r.sourceNumber!==r.number?`PDF code ${escapeHtml(r.sourceNumber)} · normalized`:escapeHtml(r.category)} · ${r.landmarks?`loop landmarks: ${escapeHtml(r.landmarks.join(', '))} · check direction`:'endpoints only'}</small></div><span class="directory-meta">TIMING<br/>NOT PROVIDED</span></div>`).join(''):'<p class="empty-directory">No routes match that search. Try a stop name or route number.</p>';
  renderAdminRoutes();
}
function renderAdminRoutes(){
  $('#routeCount').textContent=`(${routes.length})`;
  $('#adminRoutes').innerHTML=[...routes].sort((a,b)=>a.number.localeCompare(b.number,undefined,{numeric:true})).map(r=>{const source=r.verified.startsWith('User-provided PDF')?'from supplied PDF':r.verified.toLowerCase().startsWith('community')?'community supplied':'verified';return `<div class="admin-route-row"><strong>${escapeHtml(r.number)}</strong><span>${escapeHtml(r.from)} → ${escapeHtml(r.to)}<small>${escapeHtml(r.category)} · ${source}</small></span><button type="button" data-delete="${escapeHtml(r.id)}" aria-label="Delete route ${escapeHtml(r.number)}">Remove</button></div>`}).join('');
}
async function loadData(){
  try{const data=await api('/api/routes');routes=data.routes;apiAvailable=true;fillStops(data.stops);renderRoutes();}
  catch(apiError){
    try{let data;try{const response=await fetch('./routes.json');if(!response.ok)throw new Error('Static route data was not found.');data=await response.json()}catch{data=window.KOVAI_ROUTE_DATA}if(!data?.routes)throw new Error('Route data is unavailable.');let saved;try{saved=JSON.parse(localStorage.getItem('kovai-connect-routes')||'null')}catch{}routes=Array.isArray(saved)?saved.map(cached=>{const fresh=data.routes.find(r=>r.id===cached.id);return fresh?{...fresh,...cached,stops:(fresh.stops?.length||0)>(cached.stops?.length||0)?fresh.stops:(cached.stops||fresh.stops),landmarks:fresh.landmarks||cached.landmarks}:cached}):data.routes;apiAvailable=false;fillStops(routes.flatMap(r=>r.stops||[r.from,r.to]));renderRoutes();}
    catch(fileError){toast(`Could not load route choices. Start the app with npm start. ${fileError.message||apiError.message}`)}
  }
  const info=$('.admin-info p');if(info)info.textContent=apiAvailable?'Route changes save to the route database. Add timings only when you have verified information.':'Preview mode: route changes are saved in this browser only. Use npm start for the shared route database.';
}
function persistOfflineRoutes(){try{localStorage.setItem('kovai-connect-routes',JSON.stringify(routes));fillStops(routes.flatMap(r=>r.stops||[r.from,r.to]));renderRoutes();return true}catch{toast('This browser could not save route changes.');return false}}
function planCard(p,index){
  const legs=p.legs||[];
  const title=legs.length===1?`${escapeHtml(legs[0].from)} to ${escapeHtml(legs[0].to)}`:`Change at ${(p.transfers||[p.transfer]).filter(Boolean).map(escapeHtml).join(' and ')}`;
  return `<article class="result-card"><div class="result-main"><div class="bus-badge">${escapeHtml(p.number)}</div><div><div class="result-title">${title}</div><div class="result-sub">${legs.length===1?`Bus ${escapeHtml(p.number)} · ${escapeHtml(p.direction||'Route in supplied directory')}${legs[0].inferredReverse?' · return direction inferred':''}`:legs.map(l=>`Bus ${escapeHtml(l.route.number||l.route)} · ${escapeHtml(l.from)} → ${escapeHtml(l.to)}${l.inferredReverse?' · return direction inferred':''}`).join(' &nbsp; / &nbsp; ')}${p.directionWarning?' · loop direction must be confirmed at the stop':''}</div></div></div><div class="result-stats"><div class="result-stat"><strong>Not listed</strong><span>RIDE TIME</span></div><div class="result-stat"><strong>Not listed</strong><span>BUS TIMING</span></div><div class="result-stat"><strong>${legs.length===1?'Direct':`${legs.length-1} ${legs.length===2?'transfer':'transfers'}`}</strong><span>ROUTE MATCH</span></div></div></article>`;
}
$('#plannerForm').addEventListener('submit',async e=>{
  e.preventDefault();const fromValue=$('#fromStop').value.trim(),toValue=$('#toStop').value.trim();if(!fromValue||!toValue)return;
  await mapsConfigReady;
  const from=knownStops.find(s=>s.toLocaleLowerCase()===fromValue.toLocaleLowerCase())||fromValue,to=knownStops.find(s=>s.toLocaleLowerCase()===toValue.toLocaleLowerCase())||toValue;
  if(from.toLocaleLowerCase()===to.toLocaleLowerCase()){toast('Choose two different points for your journey.');return;}
  $('#fromStop').value=from;$('#toStop').value=to;
  const section=$('#resultsSection'),list=$('#resultsList');section.classList.remove('hidden');list.innerHTML='<div class="result-card">Finding a way through the network…</div>';section.scrollIntoView({behavior:'smooth',block:'start'});
  let data;if(knownStops.some(s=>s.toLocaleLowerCase()===from.toLocaleLowerCase())&&knownStops.some(s=>s.toLocaleLowerCase()===to.toLocaleLowerCase())){try{data=await api(`/api/plan?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)}catch{data={from,to,plans:routePlanner.plans(from,to),note:'Matched using listed route stops/endpoints. Confirm directions and service details; timings are not provided.'}}}else data={plans:[],note:'These points are not both in the verified city-bus route directory. Google Maps can check available public transit for the exact places.'};
  $('#resultsTitle').textContent=`${from} to ${to}.`;
  list.innerHTML=data.plans.length?data.plans.map(planCard).join('')+googleMapsEmbed(from,to)+`<div class="result-followup"><p class="result-disclaimer">${escapeHtml(data.note)} Most routes only have published endpoints; Route 111 has separately sourced landmark stops. Timetables are unavailable.</p>${googleMapsTransitLink(from,to)}</div>`:`<div class="result-card"><div><strong>No matching route is in the verified data.</strong><div class="result-sub">The route list does not include enough intermediate stops for this pair. Check exact places in Google Maps, or ask at the nearest bus stand.</div></div></div>`+googleMapsEmbed(from,to)+`<div class="result-followup"><p class="result-disclaimer">The local data did not confirm a route. Google Maps may have additional transit information.</p>${googleMapsTransitLink(from,to)}</div>`;
});
$('#swapStops').addEventListener('click',()=>{const a=$('#fromStop'),b=$('#toStop'),temp=a.value;a.value=b.value;b.value=temp;refreshStopSuggestions()});
$('#clearResults').addEventListener('click',()=>$('#resultsSection').classList.add('hidden'));
$('#routeSearch').addEventListener('input',renderRoutes);
$('#fromStop').addEventListener('input',()=>refreshStopSuggestions('from'));$('#toStop').addEventListener('input',()=>refreshStopSuggestions('to'));
$('#useLocation').addEventListener('click',()=>{
  if(!navigator.geolocation)return toast('Location is not available in this browser. Choose a stop from the list instead.');
  toast('Checking your location…');
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude}=pos.coords;
    $('#fromStop').value=`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    toast('Your exact location is set as the boarding point. Choose a destination and find transit.');
  },()=>toast('Location permission was unavailable. Choose your starting stop manually.'),{timeout:8000,maximumAge:300000});
});
$('#adminOpen').addEventListener('click',()=>$('#adminDialog').showModal());$('#adminClose').addEventListener('click',()=>$('#adminDialog').close());
$('#adminDialog').addEventListener('click',e=>{if(e.target===$('#adminDialog'))$('#adminDialog').close()});
$('#addRouteForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);const from=f.get('from').trim(),to=f.get('to').trim();const stops=String(f.get('stops')).split(',').map(s=>s.trim()).filter(Boolean);
  if(!stops.some(s=>s.toLowerCase()===from.toLowerCase()))stops.unshift(from);if(!stops.some(s=>s.toLowerCase()===to.toLowerCase()))stops.push(to);
  const body={number:f.get('number'),category:f.get('category'),from,to,stops,first:f.get('first'),last:f.get('last'),frequency:f.get('frequency'),duration:f.get('duration')};
  if(apiAvailable){try{await api('/api/routes',{method:'POST',body:JSON.stringify(body)});e.currentTarget.reset();await loadData();toast('Route saved to the local database.');return}catch{apiAvailable=false}}
  routes.push({id:`local-${Date.now()}`,number:String(body.number).trim(),from,to,stops,first:body.first||null,last:body.last||null,frequency:body.frequency?Number(body.frequency):null,duration:body.duration?Number(body.duration):null,category:body.category||'Community route',color:'#147d70',verified:'Community supplied - verify with operator',featured:false});
  if(persistOfflineRoutes()){e.currentTarget.reset();toast('Route saved in this browser.');}
});
$('#adminRoutes').addEventListener('click',async e=>{const btn=e.target.closest('[data-delete]');if(!btn)return;if(apiAvailable){try{await api(`/api/routes/${encodeURIComponent(btn.dataset.delete)}`,{method:'DELETE'});await loadData();toast('Route removed from the local database.');return}catch{apiAvailable=false}}routes=routes.filter(r=>r.id!==btn.dataset.delete);if(persistOfflineRoutes())toast('Route removed in this browser.');});
$('#mobileMenu').addEventListener('click',()=>$('.nav-links').classList.toggle('open'));
$$('.nav-links a').forEach(a=>a.addEventListener('click',()=>$('.nav-links').classList.remove('open')));
loadData();
