import {LY_KM} from './cosmic-data.js';

// Context follows both zoom and the object being inspected, never its name alone.
export function navigationRegion(distanceKm,focus={}){
 const ly=distanceKm/LY_KM,item=focus.item;
 if(item?.kind==='mass-map')return 'lensing';
 if(ly>=8e9||item?.kind==='cmb')return 'horizon';
 if(ly>=1.8e9)return 'lensing';
 if(ly>=8e5)return 'galaxies';
 if(ly>=8000)return 'galactic';
 if(item?.cosmic&&!item.solarRegion)return item.kind==='galaxy'?'galactic':'nearby';
 if(ly>=.03)return 'nearby';
 const earth=focus.id==='earth'||focus.id==='moon'||item?.satrec||item?.body==='earth';
 return distanceKm<2e6&&earth?'earth':'solar';
}

export function nearestTargets(items,origin,limit=32){
 return items.filter(x=>x.position&&!x.noLocation).map(item=>({item,d:Math.hypot(...item.position.map((v,i)=>v-origin[i]))}))
  .sort((a,b)=>a.d-b.d).slice(0,limit);
}

export function orbitAppearance(baseOpacity,intensity,selected=false){
 const value=Math.max(0,Math.min(1,intensity));
 return {opacity:value===0?0:Math.min(1,(selected?.85:baseOpacity)*value*3),brightness:1+value*.8};
}
