import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationRegion,nearestTargets,orbitAppearance} from '../src/context-navigation.js';
import {LY_KM} from '../src/cosmic-data.js';
import {prepareRecord} from '../src/catalog.js';
test('las capas siguen escala y foco sin confundir una estrella cercana con la Tierra',()=>{
 assert.equal(navigationRegion(20000,{id:'earth'}),'earth');
 assert.equal(navigationRegion(20000,{id:'mars'}),'solar');
 assert.equal(navigationRegion(1e9,{id:'earth'}),'solar');
 assert.equal(navigationRegion(LY_KM,{id:'earth'}),'nearby');
 assert.equal(navigationRegion(1,{item:{cosmic:true,kind:'star'}}),'nearby');
 assert.equal(navigationRegion(1e5*LY_KM,{}),'galactic');
 assert.equal(navigationRegion(1e7*LY_KM,{}),'galaxies');
 assert.equal(navigationRegion(3e9*LY_KM,{}),'lensing');
 assert.equal(navigationRegion(50e9*LY_KM,{}),'horizon');
});
test('las distancias del árbol se recalculan respecto a otra estrella y se acotan',()=>{
 const items=[{id:'sun',position:[0,0,0]},{id:'b',position:[10,0,0]},{id:'c',position:[12,0,0]},{id:'unknown',noLocation:true}];
 assert.deepEqual(nearestTargets(items,[11,0,0],2).map(x=>x.item.id),['b','c']);
 assert.equal(nearestTargets(items,[0,0,0],1)[0].item.id,'sun');
});
test('intensidad cero oculta las órbitas y la ISS tiene identificación española e inglesa',()=>{
 assert.equal(orbitAppearance(.2,0,true).opacity,0);assert.ok(orbitAppearance(.2,1).opacity>orbitAppearance(.2,.2).opacity);
 const iss=prepareRecord({NORAD_CAT_ID:25544,OBJECT_NAME:'ISS (ZARYA)'},{});
 assert.match(iss.name,/Estación Espacial Internacional/);assert.match(iss.aliases,/ISS EEI/);
 assert.doesNotMatch(prepareRecord({NORAD_CAT_ID:25575,OBJECT_NAME:'ISS (UNITY)'},{}).name,/Internacional/);
});
