(function(root){
  const slug=value=>String(value||'').trim().toLocaleLowerCase();
  function routeMatch(route,from,to){
    const path=route.stops||[route.from,route.to],stops=path.map(slug),a=stops.indexOf(slug(from)),b=stops.indexOf(slug(to));
    if(a<0||b<0||a===b)return null;
    let segment,inferredReverse=false;
    if(route.loop&&a>b)segment=path.slice(a).concat(path.slice(1,b+1));
    else if(a<b)segment=path.slice(a,b+1);
    else{segment=path.slice(b,a+1).reverse();inferredReverse=true;}
    return{route,from:segment[0],to:segment[segment.length-1],inferredReverse,directionWarning:!!route.loop,stopCount:segment.length-1};
  }
  function buildRoutePlanner(routes){
    const edges=new Map(),normalizedStops=new Map();for(const route of routes)for(const stop of route.stops||[route.from,route.to])if(!normalizedStops.has(slug(stop)))normalizedStops.set(slug(stop),String(stop).trim());const stops=[...normalizedStops.values()].sort((a,b)=>a.localeCompare(b));
    for(const route of routes){const routeStops=[...new Set(route.stops||[route.from,route.to])];for(const from of routeStops)for(const to of routeStops){if(slug(from)===slug(to))continue;const leg=routeMatch(route,from,to);if(!leg)continue;const key=slug(from);if(!edges.has(key))edges.set(key,[]);edges.get(key).push(leg);}}
    const cache=new Map();
    function reachableFrom(from){const origin=slug(from);if(cache.has(origin))return cache.get(origin);const plansByStop=new Map(),queue=[{at:from,legs:[],routeIds:new Set(),visited:new Set([origin])}];let cursor=0;
      while(cursor<queue.length){const state=queue[cursor++];if(state.legs.length>=3)continue;for(const edge of edges.get(slug(state.at))||[]){if(state.routeIds.has(edge.route.id)||state.visited.has(slug(edge.to)))continue;const legs=[...state.legs,edge],key=slug(edge.to),previous=plansByStop.get(key)||[];const signature=legs.map(leg=>`${leg.route.id}:${slug(leg.from)}>${slug(leg.to)}`).join('|');if(!previous.some(plan=>plan.id===signature)){const transfers=legs.slice(0,-1).map(leg=>leg.to),plan={...legs[0].route,id:signature,number:legs.map(leg=>leg.route.number).join(' + '),from:origin,to:edge.to,transfer:transfers[0],transfers,rideMinutes:null,stopCount:legs.reduce((sum,leg)=>sum+leg.stopCount,0),directionWarning:legs.some(leg=>leg.directionWarning),legs:legs.map(leg=>({route:leg.route.number,from:leg.from,to:leg.to,inferredReverse:leg.inferredReverse,directionWarning:leg.directionWarning}))};previous.push(plan);plansByStop.set(key,previous);}
        if(legs.length>=3)continue;const routeIds=new Set(state.routeIds);routeIds.add(edge.route.id);const visited=new Set(state.visited);visited.add(key);queue.push({at:edge.to,legs,routeIds,visited});}}
      for(const [key,plans] of plansByStop)plans.sort((a,b)=>a.legs.length-b.legs.length);cache.set(origin,plansByStop);return plansByStop;
    }
    function plans(from,to){return slug(from)===slug(to)?[]:(reachableFrom(from).get(slug(to))||[]).slice(0,4);}
    function destinations(from){return [...reachableFrom(from).keys()].map(key=>stops.find(stop=>slug(stop)===key)).filter(Boolean);}
    return{stops,plans,reachableFrom,destinations};
  }
  root.KovaiPlanner={buildRoutePlanner};
  if(typeof module!=='undefined'&&module.exports)module.exports={buildRoutePlanner};
})(globalThis);
