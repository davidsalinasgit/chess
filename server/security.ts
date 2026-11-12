import { createHash,createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { HttpError } from './validation.js';
export interface CoachConfig { apiKey:string;model:string;origin:string;code:string;secret:string;redisUrl:string;redisToken:string;daily:number }
export function configuration(env:NodeJS.ProcessEnv):CoachConfig|undefined {
 const {OPENAI_API_KEY:apiKey,COACH_ALLOWED_ORIGIN:origin,COACH_ACCESS_CODE:code,COACH_SESSION_SECRET:secret,UPSTASH_REDIS_REST_URL:redisUrl,UPSTASH_REDIS_REST_TOKEN:redisToken}=env;
 if(!apiKey || !origin || !code || code.length<16 || code.length>256 || !secret || secret.length<32 || !redisUrl || !redisToken)return;
 try {if(new URL(origin).origin!==origin || !['https:','http:'].includes(new URL(origin).protocol) || new URL(redisUrl).protocol!=='https:')return;}catch{return;}
 const requested=Number(env.COACH_DAILY_LIMIT??100);
 return {apiKey,origin,code,secret,redisUrl,redisToken,model:env.OPENAI_MODEL||'gpt-4.1-mini',daily:Number.isInteger(requested)?Math.min(500,Math.max(1,requested)):100};
}
export const COOKIE='__Host-chess-coach';
const digest=(text:string)=>createHash('sha256').update(text).digest();
export function sameSecret(a:string,b:string){return timingSafeEqual(digest(a),digest(b));}
export function identity(value:string,secret:string){return createHmac('sha256',secret).update(value).digest('hex');}
export function issueSession(secret:string,now=Date.now()) {
 const payload=Buffer.from(JSON.stringify({id:randomBytes(16).toString('hex'),exp:now+8*3600000})).toString('base64url');
 return `${payload}.${identity(payload,secret)}`;
}
export function sessionId(cookie:string|undefined,secret:string,now=Date.now()):string|undefined {
 const token=cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!token || token.length>400)return;
 const [payload,signature,...extra]=token.split('.');
 if(!payload || !signature || extra.length || !sameSecret(signature,identity(payload,secret)))return;
 try {const data=JSON.parse(Buffer.from(payload,'base64url').toString());if(typeof data.exp==='number' && data.exp>now && data.exp<=now+8*3600000 && /^[a-f0-9]{32}$/.test(data.id))return data.id;}catch{ /* Invalid or expired cookie. */ }
}
const LUA=`
for i,key in ipairs(KEYS) do
 if tonumber(redis.call('GET',key) or '0') >= tonumber(ARGV[(i-1)*2+1]) then return 0 end
end
for i,key in ipairs(KEYS) do
 local value=redis.call('INCR',key)
 if value == 1 then redis.call('EXPIRE',key,tonumber(ARGV[(i-1)*2+2])) end
end
return 1`;
/** Atomic shared counters; never fall back to per-instance memory. */
export async function consume(config:CoachConfig,ip:string,session:string|undefined,fetcher:typeof fetch=fetch,now=Date.now()) {
 const ipKey=identity(ip,config.secret),period=Math.floor(now/600000),minute=Math.floor(now/60000),day=Math.floor(now/86400000);
 const prefix=`chess-coach:{${identity(config.origin,config.secret).slice(0,16)}}`;
 const limits: [string,number,number][] = session ? [
  [`ip-minute:${ipKey}:${minute}`,3,120], [`ip-day:${ipKey}:${day}`,30,90000],
  [`session-day:${session}:${day}`,20,90000], [`global-day:${day}`,config.daily,90000],
 ] : [[`unlock-ip:${ipKey}:${period}`,8,1200],[`unlock-global:${period}`,100,1200]];
 let response:Response;
 try {
  response=await fetcher(config.redisUrl,{method:'POST',headers:{Authorization:`Bearer ${config.redisToken}`,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',LUA,String(limits.length),...limits.map(l=>`${prefix}:${l[0]}`),...limits.flatMap(l=>[String(l[1]),String(l[2])])]),signal:AbortSignal.timeout(2500),redirect:'error'});
  if(!response.ok)throw Error();
  const data=await response.json();
  if(data.result===0)throw new HttpError(429,'Se alcanzó el límite de consultas. Espera o vuelve a intentarlo mañana.');
  if(data.result!==1)throw Error();
 }catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'La protección de consumo no está disponible. La IA se ha pausado; puedes seguir usando Stockfish.');}
}
