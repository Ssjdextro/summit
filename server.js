const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildRoutePlanner } = require('./public/planner.js');

const ROOT = __dirname;
const DB = path.join(ROOT, 'db', 'routes.json');
const PORT = Number(process.env.PORT || 4173);
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };
let plannerCache={updatedAt:null,planner:null};
function readDb() { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
function writeDb(data) { data.updatedAt = new Date().toISOString(); const snapshot=JSON.stringify(data, null, 2) + '\n'; fs.writeFileSync(DB, snapshot); fs.writeFileSync(path.join(ROOT,'public','routes.json'), snapshot); fs.writeFileSync(path.join(ROOT,'public','routes-data.js'), `window.KOVAI_ROUTE_DATA = ${snapshot};\n`); }
function send(res, status, data, type='application/json; charset=utf-8') { res.writeHead(status, { 'content-type':type, 'cache-control':'no-store' }); res.end(type.startsWith('application/json') ? JSON.stringify(data) : data); }
function slug(v) { return String(v || '').trim().toLocaleLowerCase(); }
function handleApi(req, res, url) {
  const db = readDb();
  if (req.method === 'GET' && url.pathname === '/api/config') return send(res, 200, { googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' });
  if (req.method === 'GET' && url.pathname === '/api/routes') return send(res, 200, { routes:db.routes, updatedAt:db.updatedAt, stops:[...new Set(db.routes.flatMap(r=>r.stops))].sort((a,b)=>a.localeCompare(b)) });
  if (req.method === 'GET' && url.pathname === '/api/plan') {
    const from=url.searchParams.get('from'), to=url.searchParams.get('to');
    if (!from || !to || slug(from)===slug(to)) return send(res,400,{error:'Choose two different stops to plan your ride.'});
    if(plannerCache.updatedAt!==db.updatedAt){plannerCache={updatedAt:db.updatedAt,planner:buildRoutePlanner(db.routes)};}
    const plans=plannerCache.planner.plans(from,to);
    return send(res,200,{from,to,plans,note:plans.length?'Matched using published route stops/endpoints. Return directions inferred from endpoint pairs and loop direction should be confirmed; bus timings are not provided.':'No connection found in the currently listed route records.'});
  }
  if (req.method === 'POST' && url.pathname === '/api/routes') return readBody(req,res,body=>{
    if(!body.number||!body.from||!body.to||!Array.isArray(body.stops)||body.stops.length<2) return send(res,400,{error:'Add a route number, endpoints, and at least two stops.'});
    const route={id:crypto.randomUUID(),number:String(body.number).trim(),from:String(body.from).trim(),to:String(body.to).trim(),stops:body.stops.map(s=>String(s).trim()).filter(Boolean),first:body.first||null,last:body.last||null,frequency:body.frequency?Math.max(5,Number(body.frequency)):null,duration:body.duration?Math.max(5,Number(body.duration)):null,category:body.category||'Community route',color:body.color||'#147d70',verified:'Community supplied - verify with operator',featured:false};
    db.routes.push(route); writeDb(db); return send(res,201,route);
  });
  const match=url.pathname.match(/^\/api\/routes\/([^/]+)$/);
  if(match&&req.method==='DELETE') { const before=db.routes.length; db.routes=db.routes.filter(r=>r.id!==decodeURIComponent(match[1])); if(before===db.routes.length)return send(res,404,{error:'Route not found.'}); writeDb(db); return send(res,200,{ok:true}); }
  if(match&&req.method==='PATCH') return readBody(req,res,body=>{const r=db.routes.find(x=>x.id===decodeURIComponent(match[1]));if(!r)return send(res,404,{error:'Route not found.'});Object.assign(r,body);writeDb(db);return send(res,200,r);});
  return send(res,404,{error:'Not found'});
}
function readBody(req,res,fn) { let text=''; req.on('data',chunk=>{text+=chunk;if(text.length>100000){send(res,413,{error:'Request too large'});req.destroy();}});req.on('end',()=>{try{fn(JSON.parse(text||'{}'));}catch{send(res,400,{error:'Invalid JSON.'});}}); }
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return handleApi(req,res,url);const requested=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);const file=path.resolve(ROOT,'public',`.${requested}`);if(!file.startsWith(path.resolve(ROOT,'public')+path.sep)){res.writeHead(403);return res.end('Forbidden');}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}send(res,200,data,MIME[path.extname(file)]||'application/octet-stream');});});
server.listen(PORT,()=>console.log(`Kovai Connect is ready at http://localhost:${PORT}`));
