import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { invoke,endpoint } from './client.ts';
import { definitions,type Operation } from './contracts.ts';
import type { ZodRawShape } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const server=new McpServer({name:'workspace-tasks',version:'1.0.0'});
const token=process.env.TASKS_TOKEN??readFileSync(join(process.env.TASKS_DATA??join(process.cwd(),'data'),'owner.token'),'utf8').trim();
const workspace=process.env.TASKS_WORKSPACE;if(!workspace)throw new Error('Explicit TASKS_WORKSPACE required for filtered MCP discovery');
const discovered=await fetch(endpoint+'/api/discover?workspace='+encodeURIComponent(workspace),{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()) as {id:Operation}[];
if(!Array.isArray(discovered))throw new Error('Discovery denied');
for(const {id} of discovered){const d=definitions[id];server.tool(d.mcp,`Execute ${id} in the selected workspace. Mutations require revision and idempotency key.`,d.input.shape as ZodRawShape,async input=>{if(input.workspace!==workspace)return {isError:true,content:[{type:'text' as const,text:'Selected workspace mismatch'}]};const result=await invoke(id,input,'mcp');return {isError:!result.ok,content:[{type:'text' as const,text:JSON.stringify(result)}]};});}
await server.connect(new StdioServerTransport());
