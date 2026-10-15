import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { definitions,type Operation,type Surface,type Result } from './contracts.ts';
export const endpoint=process.env.TASKS_URL??'http://127.0.0.1:4347';
export async function invoke(op:Operation,input:unknown,surface:Surface):Promise<Result>{
 const token=process.env.TASKS_TOKEN??readFileSync(join(process.env.TASKS_DATA??join(process.cwd(),'data'),'owner.token'),'utf8').trim();
 const response=await fetch(endpoint+definitions[op].http,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'X-Tasks-Surface':surface},body:JSON.stringify(input)});return response.json() as Promise<Result>;
}
