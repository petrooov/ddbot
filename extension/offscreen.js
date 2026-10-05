import {loadProgram} from './program.js';
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(sender.id!==chrome.runtime.id||message.type!=='resolve-event')return false;
  loadProgram(message.selection.month,message.selection.year).then(p=>reply({url:p.events.find(e=>e.id===message.selection.id)?.url||null}),e=>reply({error:e.message}));return true;
});
