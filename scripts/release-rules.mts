import nextEnv from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { getApps } from "firebase-admin/app";
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}});
if(!process.argv.includes("--production")||process.env.FIRESTORE_EMULATOR_HOST)throw Error("Explicit production required");
const {adminDb}=await import("../app/lib/firebaseAdmin");
adminDb();
const {access_token}=await getApps()[0].options.credential!.getAccessToken();
const base="https://firebaserules.googleapis.com/v1/projects/highagency-62e67";
async function call(path:string,method="GET",body?:unknown){const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${access_token}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`Rules API ${r.status}`);return r.json();}
const current=await call("/releases/cloud.firestore");
const content=readFileSync("firestore.rules","utf8");
if(process.argv.includes("--apply")){
 const rules=await call("/rulesets","POST",{source:{files:[{name:"firestore.rules",content}]}});
 await call("/releases/cloud.firestore","PATCH",{release:{name:current.name,rulesetName:rules.name}});
 console.log(JSON.stringify({previous:current.rulesetName,current:rules.name}));
}
const live=await call("/releases/cloud.firestore");
const r=await fetch(`https://firebaserules.googleapis.com/v1/${live.rulesetName}`,{headers:{Authorization:`Bearer ${access_token}`}});
if(!r.ok)throw Error(`Rules read ${r.status}`);
const source=await r.json();
if(process.argv.includes("--inspect"))writeFileSync("/tmp/ha-live-firestore.rules",source.source.files.find((f:{name:string})=>f.name==="firestore.rules")?.content??source.source.files[0].content);
console.log(JSON.stringify({rulesMatch:source.source.files.some((f:{content:string})=>f.content===content),ruleset:live.rulesetName}));
