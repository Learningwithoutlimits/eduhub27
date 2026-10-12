// Speaker photos. Administrators upload (POST), anyone can view (GET).
import { json, store, requireAdmin } from "./_utils.mjs";

const TYPES={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
const MAX_BYTES=700*1024;
const validId=id=>/^[a-f0-9-]{36}$/.test(String(id||""));

export default async request => {
 if(request.method==="GET"){
   const id=new URL(request.url).searchParams.get("id");
   if(!validId(id)) return new Response("Not found",{status:404});
   const entry=await store().getWithMetadata(`photos/${id}`,{type:"arrayBuffer"});
   if(!entry?.data) return new Response("Not found",{status:404});
   const type=TYPES[entry.metadata?.contentType]?entry.metadata.contentType:"image/jpeg";
   // Each upload gets a new id, so the browser can keep the image indefinitely.
   return new Response(entry.data,{headers:{"content-type":type,"cache-control":"public, max-age=31536000, immutable","x-content-type-options":"nosniff"}});
 }
 if(!requireAdmin(request)) return json({error:"Not signed in"},401);
 if(request.method!=="POST") return json({error:"Method not allowed"},405);
 const {dataUrl=""}=await request.json().catch(()=>({}));
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl));
 if(!match) return json({error:"Please choose a JPEG, PNG or WebP photo."},400);
 const bytes=Buffer.from(match[2],"base64");
 if(bytes.length>MAX_BYTES) return json({error:"That photo is too large. Please use a smaller image."},400);
 // Check the file really is the image type it claims to be.
 const sig=bytes.subarray(0,12).toString("hex");
 const real=sig.startsWith("ffd8ff")?"image/jpeg":sig.startsWith("89504e47")?"image/png":(sig.startsWith("52494646")&&bytes.subarray(8,12).toString()==="WEBP")?"image/webp":"";
 if(real!==match[1]) return json({error:"That file does not look like a valid photo."},400);
 const id=crypto.randomUUID();
 await store().set(`photos/${id}`,bytes,{metadata:{contentType:real}});
 return json({ok:true,id});
};
