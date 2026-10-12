
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {
  status, headers: {"content-type":"application/json; charset=utf-8", "cache-control":"no-store", ...headers}
});
export const store = () => getStore({ name: "lwlat-events-data", consistency: "strong" });
export async function readJSON(key, fallback){
  const raw = await store().get(key);
  if(!raw) return fallback;
  try{return JSON.parse(raw)}catch{return fallback}
}
export async function writeJSON(key, value){ await store().set(key, JSON.stringify(value)); }
const secret = () => process.env.SESSION_SECRET || "change-this-session-secret";
function sign(value){return crypto.createHmac("sha256", secret()).update(value).digest("hex")}
export function makeToken(){
  const exp=Date.now()+1000*60*60*12; const value=String(exp); return `${value}.${sign(value)}`;
}
export function validToken(token){
  if(!token) return false; const [value,sig]=token.split("."); if(!value||!sig||Number(value)<Date.now()) return false;
  const expected=sign(value); try{return crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected))}catch{return false}
}
export function cookieValue(request,name){
  const cookie=request.headers.get("cookie")||"";
  return cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.split("=").slice(1).join("=") || "";
}
export function requireAdmin(request){return validToken(cookieValue(request,"lwlat_admin"))}
export const slug = text => String(text||"course").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70);
export const defaults = {
  eduhub:{title:"EduHub 2027: Better Together",date:"2027-01-05",time:"",venue:"Babington Academy",description:"Our annual Trust-wide event for Learning Without Limits Academy Trust staff.",capacity:0,bookingOpen:true}
};
