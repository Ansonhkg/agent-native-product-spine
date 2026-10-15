import { z } from 'zod';
export const taskSchema=z.object({id:z.string(),title:z.string(),completed:z.boolean(),workspace:z.string()});
export const outputSchema=z.object({workspace:z.string(),revision:z.number().int(),tasks:z.array(taskSchema)});
export const errorSchema=z.object({code:z.enum(['INVALID','DENIED','NOT_FOUND','CONFLICT','INTERNAL','CANCELLED']),message:z.string()});
const base={workspace:z.string().min(1)};
const mutation={...base,revision:z.number().int().nonnegative(),key:z.string().min(1).max(200)};
export const definitions={
 'tasks.list':{summary:'List the current workspace snapshot.',example:{workspace:'personal'},input:z.object(base).strict(),mutates:false,capability:'read',http:'/api/tasks/list',cli:'list',mcp:'tasks_list'},
 'tasks.create':{summary:'Create a task.',example:{workspace:'personal',revision:0,key:'example-request-1',title:'Review evidence'},input:z.object({...mutation,title:z.string().trim().min(1).max(200)}).strict(),mutates:true,capability:'write',http:'/api/tasks/create',cli:'create',mcp:'tasks_create'},
 'tasks.setCompleted':{summary:'Complete or reopen a task.',example:{workspace:'personal',revision:0,key:'example-request-1',id:'11111111-1111-4111-8111-111111111111',completed:true},input:z.object({...mutation,id:z.string().uuid(),completed:z.boolean()}).strict(),mutates:true,capability:'write',http:'/api/tasks/setCompleted',cli:'setCompleted',mcp:'tasks_setCompleted'},
 'tasks.delete':{summary:'Permanently delete a task.',example:{workspace:'personal',revision:0,key:'example-request-1',id:'11111111-1111-4111-8111-111111111111'},input:z.object({...mutation,id:z.string().uuid()}).strict(),mutates:true,capability:'write',http:'/api/tasks/delete',cli:'delete',mcp:'tasks_delete'}
} as const;
export type Operation=keyof typeof definitions;
export type Surface='http'|'cli'|'mcp'|'ui';
export const registry=Object.entries(definitions).map(([id,d])=>({id,...d,output:outputSchema,error:errorSchema,scope:'workspace',surfaces:['http','cli','mcp','ui'],handler:'TaskService.execute',workflow:d.mutates?'task-mutation@1':null,retry:'same key and same input only',liveDomain:'tasks'}));
export const workflow={id:'task-mutation',version:1,steps:['validate','persist'] as const,transitions:[['validate','persist'],['validate','completed-replay'],['validate','failed'],['persist','completed'],['persist','failed']],restart:'SQLite rolls back interrupted transactions; retry with same key',concurrency:1,cancellation:'Pre-commit cancellation rejects; synchronous commit is indivisible; committed state remains committed'};
export class AppError extends Error { readonly _tag='AppError'; constructor(readonly code:z.infer<typeof errorSchema>['code'],message:string){super(message);} }
export type Result={ok:true;value:z.infer<typeof outputSchema>}|{ok:false;error:z.infer<typeof errorSchema>};
