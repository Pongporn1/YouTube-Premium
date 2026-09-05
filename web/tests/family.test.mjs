import test from "node:test";
import assert from "node:assert/strict";
import { allowedAccounts } from "../lib/family-policy.js";
import { accountStorageKey, migrateOwnerStorage } from "../account-storage.js";
import { createSession, readSession } from "../lib/session-core.js";
import verify from "../api/auth/youtube-account.js";
test("approved family only, deduplication and hard ten-account limit", () => {
  assert.equal(allowedAccounts({}).size, 2);
  assert.equal(allowedAccounts({}).has("stranger@gmail.com"), false);
  assert.equal(allowedAccounts({ALLOWED_GOOGLE_EMAIL: "BALLBOSS6184@gmail.com"}).size, 2);
  assert.equal(allowedAccounts({ALLOWED_GOOGLE_EMAIL: Array.from({length:8},(_,i)=>`u${i}@test.com`).join(",")}).size, 10);
  assert.equal(allowedAccounts({ALLOWED_GOOGLE_EMAIL: Array.from({length:9},(_,i)=>`u${i}@test.com`).join(",")}).size, 0);
});
test("storage isolation and legacy migration exclusively to original owner", () => {
  const data = new Map([["history", "old-owner-data"]]);
  const storage = {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  migrateOwnerStorage(storage,"bossy.2549s@gmail.com",["history"]);
  assert.equal(storage.getItem(accountStorageKey("bossy.2549s@gmail.com","history")),null);
  migrateOwnerStorage(storage,"ballboss6184@gmail.com",["history"]);
  assert.equal(storage.getItem(accountStorageKey("ballboss6184@gmail.com","history")),"old-owner-data");
  assert.equal(storage.getItem("history"),null);
  assert.equal(accountStorageKey("","history"),null);
});
test("removing approval revokes an already signed session", () => {
  process.env.SESSION_SECRET = "family-test-secret-at-least-32-characters";
  process.env.ALLOWED_GOOGLE_EMAIL = "temporary@test.com";
  const req = {headers:{cookie:`mytube_session=${createSession({sub:"u",email:"temporary@test.com"})}`}};
  assert.ok(readSession(req));
  delete process.env.ALLOWED_GOOGLE_EMAIL;
  assert.equal(readSession(req),null);
});
test("YouTube authorization must match the signed in Google identity", async () => {
  process.env.SESSION_SECRET = "family-test-secret-at-least-32-characters";
  const original = globalThis.fetch;
  const req = {method:"POST",headers:{cookie:`mytube_session=${createSession({sub:"owner-id",email:"ballboss6184@gmail.com"})}`},body:{accessToken:"test-token-long-enough"}};
  const res = {setHeader(){},status(n){this.code=n;return this;},json(v){this.data=v;return this;}};
  try {
    globalThis.fetch = async()=>({ok:true,json:async()=>({sub:"other-id",email:"bossy.2549s@gmail.com",email_verified:true})});
    await verify(req,res); assert.equal(res.code,403);
    globalThis.fetch = async()=>({ok:true,json:async()=>({sub:"owner-id",email:"ballboss6184@gmail.com",email_verified:true})});
    await verify(req,res); assert.equal(res.code,200);
  } finally {globalThis.fetch=original;}
});
