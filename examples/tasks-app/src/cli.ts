import { invoke } from './client.ts';
import { definitions,type Operation } from './contracts.ts';
const [command,...args]=process.argv.slice(2);
if(!command || command==='--help'){console.log('Usage: npm run cli -- <list|create|setCompleted|delete> --workspace <personal|work> [--title text] [--id UUID] [--completed true|false] [--revision N] [--key key]');process.exit(0);}
const op=Object.keys(definitions).find(k=>definitions[k as Operation].cli===command) as Operation|undefined;
if(!op){console.error('Unknown command');process.exit(1);}
const flags:Record<string,string>={};for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--') || args[i+1]===undefined){console.error('Expected flag/value pairs');process.exit(1);}flags[args[i].slice(2)]=args[i+1];}
if(!flags.workspace){console.error('Explicit --workspace required');process.exit(1);}
let input:any={workspace:flags.workspace};
if(definitions[op].mutates){if(flags.revision===undefined){const snapshot=await invoke('tasks.list',input,'cli');if(!snapshot.ok){console.error(JSON.stringify(snapshot));process.exit(1);}input.revision=snapshot.value.revision;}else input.revision=Number(flags.revision);input.key=flags.key??crypto.randomUUID();}
if(op==='tasks.create')input.title=flags.title;
if(op==='tasks.delete'||op==='tasks.setCompleted')input.id=flags.id;
if(op==='tasks.setCompleted'){if(!['true','false'].includes(flags.completed)){console.error('--completed must be true or false');process.exit(1);}input.completed=flags.completed==='true';}
const result=await invoke(op,input,'cli');console.log(JSON.stringify(result,null,2));process.exitCode=result.ok?0:1;
