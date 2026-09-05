import test from 'node:test';
import assert from 'node:assert/strict';
import { createResultCache } from '../result-cache.js';
test('cache isolates users, expires freshness and stale data, clears on logout', () => {
  const values = new Map();
  const storage = {getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  let time=1000;
  const cache=createResultCache(storage,()=>time);
  cache.put('alice','feed',{items:[{id:'a'}]});
  assert.equal(cache.get('alice','feed').fresh,true);
  assert.equal(cache.get('bob','feed'),null);
  assert.equal(cache.get('alice','search'),null);
  time+=600001;
  assert.equal(cache.get('alice','feed').fresh,false);
  time+=86400000;
  assert.equal(cache.get('alice','feed'),null);
  cache.put('alice','feed',{items:[]});
  cache.clear();
  assert.equal(cache.get('alice','feed'),null);
});
test('unavailable storage and invalid data do not break the app', () => {
  const cache=createResultCache({getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}});
  assert.doesNotThrow(()=>cache.put('a','feed',{items:[]}));
  assert.equal(cache.get('a','feed'),null);
  assert.doesNotThrow(()=>cache.clear());
});
