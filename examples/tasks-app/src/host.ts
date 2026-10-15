import { DatabaseSync } from 'node:sqlite';
import { mkdirSync,readFileSync,writeFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID,randomBytes } from 'node:crypto';
import { Context,Effect } from 'effect';
import { AppError,definitions,registry,workflow,outputSchema,type Operation,type Surface,type Result } from './contracts.ts';
export const dataDir=process.env.TASKS_DATA ?? join(process.cwd(),'data');
mkdirSync(dataDir,{recursive:true});
const tokenPath=join(dataDir,'owner.token');
if(!existsSync(tokenPath))writeFileSync(tokenPath,randomBytes(32).toString('hex'),{mode:0o600});
export const ownerToken=readFileSync(tokenPath,'utf8').trim();
export const db=new DatabaseSync(join(dataDir,'tasks.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS grants(actor TEXT,workspace TEXT,capability TEXT,PRIMARY KEY(actor,workspace,capability));
 CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY,workspace TEXT NOT NULL REFERENCES workspaces(id),title TEXT NOT NULL,completed INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,workspace TEXT,actor TEXT,operation TEXT,revision INTEGER,at TEXT);
 CREATE TABLE IF NOT EXISTS receipts(key TEXT,actor TEXT,workspace TEXT,operation TEXT,input TEXT,result TEXT,PRIMARY KEY(key,actor,workspace));
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,run TEXT,operation TEXT,step TEXT,attempt INTEGER,at TEXT,kind TEXT,definition TEXT);
 INSERT OR IGNORE INTO workspaces(id) VALUES ('personal'),('work');`);
if(!existsSync(join(dataDir,'initialized'))){
 for(const w of ['personal','work'])for(const c of ['read','write'])db.prepare('INSERT OR IGNORE INTO grants VALUES (?,?,?)').run('owner',w,c);
 db.prepare('INSERT OR IGNORE INTO grants VALUES (?,?,?)').run('reader','personal','read');
 writeFileSync(join(dataDir,'initialized'),'1');
}
export function authenticate(token:string|undefined){if(token===ownerToken)return 'owner';if(process.env.TASKS_READER_TOKEN && token===process.env.TASKS_READER_TOKEN)return 'reader';throw new AppError('DENIED','Authentication required');}
export function allowed(actor:string,workspace:string,capability:string){return !!db.prepare('SELECT 1 FROM grants WHERE actor=? AND workspace=? AND capability=?').get(actor,workspace,capability);}
export function discovery(actor:string,workspace:string){return registry.filter(r=>allowed(actor,workspace,r.capability)).map(r=>({id:r.id,scope:r.scope,http:r.http,cli:r.cli,mcp:r.mcp}));}
function snapshot(workspace:string){const w=db.prepare('SELECT revision FROM workspaces WHERE id=?').get(workspace);if(!w)throw new AppError('NOT_FOUND','Workspace missing');return outputSchema.parse({workspace,revision:w.revision,tasks:db.prepare('SELECT * FROM tasks WHERE workspace=? ORDER BY rowid').all(workspace).map(t=>({...t,completed:!!t.completed}))});}
function event(run:string,operation:string,step:string,kind:string){db.prepare('INSERT INTO events VALUES (?,?,?,?,?,?,?,?)').run(randomUUID(),run,operation,step,1,new Date().toISOString(),kind,`${workflow.id}@${workflow.version}`);}
export const TaskService=Context.Service<{execute:(op:Operation,input:any,actor:string,signal?:AbortSignal)=>Effect.Effect<ReturnType<typeof snapshot>,AppError>}>('TaskService');
const service={execute:(op:Operation,input:any,actor:string,signal?:AbortSignal)=>Effect.try({try:()=>{
 const def=definitions[op];const parsed=def.input.safeParse(input);if(!parsed.success)throw new AppError('INVALID','Input does not match the operation contract');const p=parsed.data as any;
 if(signal?.aborted)throw new AppError('CANCELLED','Cancelled before execution');
 if(!allowed(actor,p.workspace,def.capability))throw new AppError('DENIED','Workspace capability denied');
 if(!def.mutates)return snapshot(p.workspace);
 const run=randomUUID();event(run,op,'validate','started');
 db.exec('BEGIN IMMEDIATE');
 let phase='validate';
 try {
 // Recheck authority and resource identity at the atomic commit boundary.
 if(!allowed(actor,p.workspace,def.capability))throw new AppError('DENIED','Grant revoked');
 if(signal?.aborted)throw new AppError('CANCELLED','Cancelled before commit');
 const receipt=db.prepare('SELECT * FROM receipts WHERE key=? AND actor=? AND workspace=?').get(p.key,actor,p.workspace);
 const signature=JSON.stringify(p);
 if(receipt){if(receipt.operation!==op || receipt.input!==signature)throw new AppError('CONFLICT','Idempotency key already used for different input');db.exec('ROLLBACK');event(run,op,'validate','completed');return outputSchema.parse(JSON.parse(String(receipt.result)));}
 const prior=snapshot(p.workspace);if(prior.revision!==p.revision)throw new AppError('CONFLICT','Workspace changed; reload and retry');
 if(op!=='tasks.create' && !prior.tasks.some(t=>t.id===p.id))throw new AppError('NOT_FOUND','Task missing in this workspace');
 event(run,op,'validate','completed');phase='persist';event(run,op,'persist','started');
 if(op==='tasks.create')db.prepare('INSERT INTO tasks VALUES (?,?,?,0)').run(randomUUID(),p.workspace,p.title);
 if(op==='tasks.setCompleted')db.prepare('UPDATE tasks SET completed=? WHERE id=? AND workspace=?').run(p.completed?1:0,p.id,p.workspace);
 if(op==='tasks.delete')db.prepare('DELETE FROM tasks WHERE id=? AND workspace=?').run(p.id,p.workspace);
 db.prepare('UPDATE workspaces SET revision=revision+1 WHERE id=?').run(p.workspace);
 const result=snapshot(p.workspace);
 db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?)').run(randomUUID(),p.workspace,actor,op,result.revision,new Date().toISOString());
 db.prepare('INSERT INTO receipts VALUES (?,?,?,?,?,?)').run(p.key,actor,p.workspace,op,signature,JSON.stringify(result));
 event(run,op,'persist','committed');event(run,op,'persist','completed');db.exec('COMMIT');return result;
 }catch(e){
 const observed=db.prepare('SELECT * FROM events WHERE run=?').all(run);db.exec('ROLLBACK');
 // Preserve actually observed phase entries after rollback without claiming a commit.
 for(const row of observed)if(row.kind==='started'||(row.step==='validate'&&row.kind==='completed'))db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?,?)').run(row.id,row.run,row.operation,row.step,row.attempt,row.at,row.kind,row.definition);
 event(run,op,phase,'failed');throw e;}
},catch:e=>e instanceof AppError?e:new AppError('INTERNAL','Host operation failed')})};
export async function execute(op:string,input:unknown,token:string|undefined,surface:Surface,signal?:AbortSignal):Promise<Result>{
 if(!(op in definitions))return {ok:false,error:{code:'INVALID',message:'Unknown operation'}};
 let actor:string;try{actor=authenticate(token);}catch(e){return {ok:false,error:{code:'DENIED',message:(e as Error).message}};}
 const definition=registry.find(r=>r.id===op)!;if(!definition.surfaces.includes(surface))return {ok:false,error:{code:'DENIED',message:'Unsupported surface'}};
 const program=Effect.gen(function*(){const tasks=yield* TaskService;return yield* tasks.execute(op as Operation,input,actor,signal);});
 if(signal?.aborted)return {ok:false,error:{code:'CANCELLED',message:'Cancelled before execution'}};
 try{return await Effect.runPromise(Effect.match(Effect.provideService(program,TaskService,service),{onFailure:error=>({ok:false,error:{code:error.code,message:error.message}} as Result),onSuccess:value=>({ok:true,value} as Result)}),{signal});}catch{return {ok:false,error:{code:signal?.aborted?'CANCELLED':'INTERNAL',message:signal?.aborted?'Execution interrupted':'Host runtime failed'}};}
}
