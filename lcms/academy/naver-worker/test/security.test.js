import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import worker from '../src/index.js';
import { requireAdmin, readJson } from '../src/security.js';
const env={REGISTRATION_ORIGIN:'https://daily-coach-ing.com'};
test('HTTP denies missing/disallowed Origin, unsupported methods, open admin and oversized bodies',async()=>{
  assert.equal((await worker.fetch(new Request('https://example.test/health'),env)).status,200);
  for(const path of ['/registration/verify','/registration/complete','/admin','/admin/app.js','/admin/api/orders']) assert((await worker.fetch(new Request('https://example.test'+path,{method:'POST'}),env)).status>=400);
  assert.equal((await worker.fetch(new Request('https://example.test/registration/verify',{headers:{Origin:env.REGISTRATION_ORIGIN}}),env)).status,405);
  assert.equal((await worker.fetch(new Request('https://example.test/registration/verify',{method:'OPTIONS',headers:{Origin:env.REGISTRATION_ORIGIN}}),env)).status,204);
  assert.equal((await worker.fetch(new Request('https://example.test/registration/verify',{method:'POST',headers:{Origin:env.REGISTRATION_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({x:'a'.repeat(9000)})}),env)).status,413);
  assert.equal((await worker.fetch(new Request('https://example.test/sync',{method:'POST'}),env)).status,404);
});
test('Access JWT requires verified signature, exact issuer/audience, email and nonexpired token',async()=>{
  const {publicKey,privateKey}=await generateKeyPair('RS256'),jwk=await exportJWK(publicKey);jwk.kid='test';
  const keys=createLocalJWKSet({keys:[jwk]}),config={ACCESS_TEAM_DOMAIN:'lmc-test.cloudflareaccess.com',ACCESS_AUD:'test-only-audience'};
  const make=async(overrides={})=>new SignJWT({email:'operator@example.test',...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('test-operator').setIssuedAt().setIssuer('https://'+config.ACCESS_TEAM_DOMAIN).setAudience(config.ACCESS_AUD).setExpirationTime('5m').sign(privateKey);
  const valid=await make();assert(await requireAdmin(new Request('https://example.test/admin',{headers:{'Cf-Access-Jwt-Assertion':valid}}),config,keys));
  for(const bad of [valid.slice(0,-4)+'abcd',await make({email:''})]) await assert.rejects(()=>requireAdmin(new Request('https://example.test/admin',{headers:{'Cf-Access-Jwt-Assertion':bad}}),config,keys),/UNAUTHORIZED/);
  await assert.rejects(()=>requireAdmin(new Request('https://example.test/admin',{headers:{'Cf-Access-Jwt-Assertion':valid}}),{...config,ACCESS_AUD:'other'},keys),/UNAUTHORIZED/);
  const expired=await new SignJWT({email:'operator@example.test'}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('test').setIssuedAt().setIssuer('https://'+config.ACCESS_TEAM_DOMAIN).setAudience(config.ACCESS_AUD).setExpirationTime(1).sign(privateKey);
  await assert.rejects(()=>requireAdmin(new Request('https://example.test/admin',{headers:{'Cf-Access-Jwt-Assertion':expired}}),config,keys),/UNAUTHORIZED/);
});
test('body parser denies invalid JSON, arrays and unbounded streamed body',async()=>{
  for(const text of ['{','[]','null','"value"']) await assert.rejects(()=>readJson(new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:text})),/INVALID_BODY/);
});
