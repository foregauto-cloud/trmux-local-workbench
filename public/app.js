'use strict';
const $ = selector => document.querySelector(selector);
const byId = id => document.getElementById(id);
const fileList = byId('file-list');
const editor = byId('code-editor');
let activePath = '';
let original = '';
let files = [];
let chatHistory = [];
let sending = false;

function output(message) { byId('output-log').textContent = message; }
async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  let data;
  try { data = await response.json(); } catch { throw new Error(`Unexpected server response (${response.status}).`); }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function languageFor(file) {
  const ext = file.split('.').pop().toLowerCase();
  return ({ js:'JAVASCRIPT',ts:'TYPESCRIPT',json:'JSON',md:'MARKDOWN',html:'HTML',css:'CSS',py:'PYTHON',sh:'SHELL SCRIPT',java:'JAVA',gradle:'GRADLE',xml:'XML',yml:'YAML',yaml:'YAML' })[ext] || 'PLAIN TEXT';
}
function renderFiles() {
  fileList.replaceChildren();
  if (!files.length) { const p=document.createElement('p');p.className='muted pad';p.textContent='Workspace is empty. Create a file to begin.';fileList.append(p);return; }
  for (const item of files) {
    const button=document.createElement('button');button.className='file-row'+(item.path===activePath?' active':'');button.type='button';button.title=item.path;
    const glyph=document.createElement('span');glyph.className='file-icon';glyph.textContent=item.path.split('.').pop().slice(0,2).toUpperCase();
    const name=document.createElement('span');name.className='file-name';name.textContent=item.path;
    button.append(glyph,name);button.onclick=()=>openFile(item.path);fileList.append(button);
  }
}
async function refreshFiles() {
  try {
    const data=await api('/api/files');files=data.files;byId('workspace-label').textContent=data.workspace.split('/').slice(-2).join('/').toUpperCase()||'WORKSPACE';
    byId('runtime-status').textContent='LOCAL · READY';byId('runtime-dot').classList.add('online');renderFiles();output(`${files.length} workspace file${files.length===1?'':'s'} ready.`);
  } catch(error) {byId('runtime-status').textContent='LOCAL · OFFLINE';byId('runtime-dot').classList.remove('online');output(`Workspace unavailable: ${error.message}`);}
}
async function openFile(file) {
  try {
    const data=await api(`/api/file?path=${encodeURIComponent(file)}`);activePath=data.path;editor.value=data.content;original=data.content;
    byId('active-file').textContent=activePath;byId('editor-language').textContent=languageFor(activePath);byId('welcome').classList.add('hidden');byId('editor-wrap').classList.remove('hidden');
    updateGutter();updateSaveState();renderFiles();window.trmuxShowView?.('editor');output(`Opened ${activePath}.`);
  } catch(error) {output(`Could not open file: ${error.message}`);}
}
function updateGutter() {
  const count=Math.max(1,editor.value.split('\n').length);byId('line-numbers').textContent=Array.from({length:count},(_,index)=>index+1).join('\n');
}
function updateSaveState() {const dirty=editor.value!==original;byId('save-file').disabled=!dirty;byId('dirty-mark').textContent=dirty?'●':'';}
editor.addEventListener('input',()=>{updateGutter();updateSaveState();});
async function saveFile() {
  if(!activePath){output('Open or create a file before saving.');return;}
  try {await api('/api/file',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({path:activePath,content:editor.value})});original=editor.value;updateSaveState();output(`Saved ${activePath}.`);await refreshFiles();}
  catch(error){output(`Save failed: ${error.message}`);}
}
byId('save-file').onclick=saveFile;
async function newFile() {
  const name=window.prompt('File name (example: notes.md)');if(!name)return;
  const clean=name.trim();if(!clean)return;
  try {await api('/api/file',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({path:clean,content:''})});await refreshFiles();await openFile(clean);}
  catch(error){output(`Could not create file: ${error.message}`);}
}
byId('new-file').onclick=newFile;byId('new-file-side').onclick=newFile;byId('welcome-new').onclick=newFile;byId('refresh-files').onclick=refreshFiles;
function showView(view){window.trmuxShowView?.(view);}
document.querySelectorAll('.tool-link[data-view]').forEach(button=>button.onclick=()=>showView(button.dataset.view));
document.querySelectorAll('[data-open-analyzer]').forEach(button=>button.onclick=()=>showView('analyzer'));
byId('analyze-button').onclick=async()=>{
  const text=byId('log-input').value;byId('analysis-status').textContent='Analyzing locally…';byId('analysis-results').replaceChildren();
  try {
    const data=await api('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
    byId('analysis-status').textContent=`Reviewed ${data.linesAnalyzed} lines · ${data.findings.length} indicator${data.findings.length===1?'':'s'} · ${data.note}`;
    if(!data.findings.length){const p=document.createElement('p');p.className='muted';p.textContent='No configured heuristic indicators found. This does not establish that the logs are safe.';byId('analysis-results').append(p);}
    for(const finding of data.findings){const card=document.createElement('article');card.className='finding-card';const heading=document.createElement('b');heading.textContent=`Line ${finding.line} · ${finding.category}`;const excerpt=document.createElement('code');excerpt.textContent=finding.excerpt;card.append(heading,excerpt);byId('analysis-results').append(card);}
  } catch(error){byId('analysis-status').textContent=`Analysis failed: ${error.message}`;}
};
function formatModel(model){return model.name+(model.size?` · ${(model.size/1024/1024/1024).toFixed(1)} GB`: '');}
async function loadModels() {
  const select=byId('model-select');byId('model-status').textContent='Checking local model runtime…';
  try {
    const data=await api('/api/models');select.replaceChildren();
    if(!data.models.length){select.add(new Option('No local models installed',''));byId('model-status').textContent='Ollama is running; install a model to chat.';return;}
    for(const model of data.models)select.add(new Option(formatModel(model),model.id));
    byId('model-status').textContent=`${data.models.length} local model${data.models.length===1?'':'s'} available`;
  } catch(error){select.replaceChildren(new Option('Local Ollama unavailable',''));byId('model-status').textContent='Start Ollama locally, then refresh models.';}
}
byId('refresh-models').onclick=loadModels;
function addMessage(role,text) {
  const row=document.createElement('div');row.className=`chat-message ${role==='user'?'user-message':'assistant-message'}`;
  const avatar=document.createElement('span');avatar.className='message-avatar';avatar.textContent=role==='user'?'You':'✳';
  const body=document.createElement('div');const title=document.createElement('b');title.textContent=role==='user'?'You':'Local assistant';
  const paragraph=document.createElement('p');paragraph.textContent=text;body.append(title,paragraph);row.append(avatar,body);byId('chat-messages').append(row);row.scrollIntoView({block:'nearest'});return row;
}
function setSending(value){sending=value;byId('send-chat').disabled=value;byId('chat-prompt').disabled=value;byId('send-chat').textContent=value?'Thinking…':'Send ↑';}
byId('chat-form').onsubmit=async event=>{
  event.preventDefault();if(sending)return;
  const promptText=byId('chat-prompt').value.trim(),model=byId('model-select').value;if(!promptText)return;
  if(!model){byId('model-status').textContent='Select an installed local model first.';return;}
  byId('chat-prompt').value='';addMessage('user',promptText);const pending=addMessage('assistant','Thinking locally…');setSending(true);
  let prompt=promptText;
  if(byId('include-context').checked&&activePath){const context=editor.value.slice(0,12000);prompt=`The user selected this workspace file as context: ${activePath}\n--- BEGIN FILE CONTEXT ---\n${context}\n--- END FILE CONTEXT ---\n\nUser question: ${promptText}`;}
  try {
    const data=await api('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,prompt})});
    pending.querySelector('p').textContent=data.message||'(The local model returned an empty answer.)';chatHistory.push({role:'user',content:promptText},{role:'assistant',content:data.message||''});output(`Local assistant replied using ${model}.`);
  } catch(error){pending.querySelector('p').textContent=`Could not get a local response: ${error.message}`;output(`Assistant unavailable: ${error.message}`);}
  finally{setSending(false);byId('chat-prompt').focus();}
};
byId('assistant-clear').onclick=()=>{byId('chat-messages').replaceChildren();chatHistory=[];output('Local assistant conversation cleared.');};
byId('chat-prompt').addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();byId('chat-form').requestSubmit();}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();if(!byId('save-file').disabled)saveFile();}});
async function init(){try{await api('/health');}catch{}await refreshFiles();await loadModels();}
init();
