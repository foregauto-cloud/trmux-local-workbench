'use strict';
(() => {
  const KEY = 'trmux.network-profiles.v1';
  const $ = id => document.getElementById(id);
  const form = $('profile-form');
  if (!form) return;
  const list = $('profile-list');
  const fields = { id: $('profile-id'), name: $('profile-name'), type: $('profile-type'), host: $('profile-host'), port: $('profile-port'), notes: $('profile-notes') };
  let profiles = load();
  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value.filter(validProfile).slice(0, 100) : [];
    } catch { return []; }
  }
  function validProfile(p) {
    return p && typeof p.id === 'string' && typeof p.name === 'string' && ['wireguard','openvpn','socks5','http-connect'].includes(p.type) && typeof p.host === 'string' && Number.isInteger(p.port) && p.port > 0 && p.port <= 65535 && typeof p.notes === 'string';
  }
  function persist() { localStorage.setItem(KEY, JSON.stringify(profiles)); }
  function safeText(tag, text, cls) { const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el; }
  function typeName(type) { return ({wireguard:'WireGuard',openvpn:'OpenVPN',socks5:'SOCKS5', 'http-connect':'HTTP CONNECT'})[type]; }
  function render() {
    list.replaceChildren();
    if (!profiles.length) { list.append(safeText('p','No network profiles yet.','muted pad')); return; }
    for (const profile of profiles) {
      const row=document.createElement('div');row.className='profile-row';
      const open=document.createElement('button');open.type='button';open.className='profile-open';
      open.append(safeText('b',profile.name),safeText('span',`${typeName(profile.type)} · ${profile.host}:${profile.port}`),safeText('small',profile.notes || 'No notes'));
      open.onclick=()=>fill(profile);
      const remove=document.createElement('button');remove.type='button';remove.className='profile-remove';remove.textContent='×';remove.title='Delete profile';remove.onclick=()=>{profiles=profiles.filter(x=>x.id!==profile.id);persist();render();if(fields.id.value===profile.id)clear();};
      row.append(open,remove);list.append(row);
    }
  }
  function clear() { form.reset();fields.id.value='';$('delete-profile').disabled=true;$('profile-status').textContent='New draft. No connection will be made.'; }
  function fill(p) { fields.id.value=p.id;fields.name.value=p.name;fields.type.value=p.type;fields.host.value=p.host;fields.port.value=p.port;fields.notes.value=p.notes;$('delete-profile').disabled=false;$('profile-status').textContent='Editing local draft.'; }
  function validateHost(host) {
    if (!host || host.length>253 || /[\s/@?#]/.test(host) || host.includes('://')) return false;
    return /^[A-Za-z0-9._:[\]-]+$/.test(host) && !host.startsWith('.') && !host.endsWith('.');
  }
  $('network-config-button').addEventListener('click',()=>showNetworks(true));
  document.querySelectorAll('[data-open-networks]').forEach(b=>b.addEventListener('click',()=>showNetworks(true)));
  function showNetworks(show) {
    const network=$('network-view'), editor=document.querySelector('.editor-panel'), analyzer=$('analyzer-view');
    network.classList.toggle('hidden',!show);editor.classList.toggle('hidden',show);
    if(show) analyzer.classList.add('hidden');
    $('network-config-button').classList.toggle('selected',show);
    document.querySelectorAll('.tool-link[data-view]').forEach(b=>b.classList.toggle('selected',!show&&b.dataset.view==='editor'));
  }
  document.querySelectorAll('.tool-link[data-view]').forEach(b=>b.addEventListener('click',()=>showNetworks(false)));
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const host=fields.host.value.trim(),port=Number(fields.port.value),name=fields.name.value.trim();
    if(!name||name.length>80||!validateHost(host)||!Number.isInteger(port)||port<1||port>65535){$('profile-status').textContent='Enter a profile name, valid hostname/IP, and port 1–65535.';return;}
    const existing=profiles.findIndex(p=>p.id===fields.id.value);
    const profile={id:fields.id.value||crypto.randomUUID(),name,type:fields.type.value,host,port,notes:fields.notes.value.trim().slice(0,500)};
    if(existing>=0)profiles[existing]=profile;else profiles.unshift(profile);
    profiles=profiles.slice(0,100);persist();render();fill(profile);$('profile-status').textContent='Draft saved only in this browser. No network connection was made.';
  });
  $('new-profile').onclick=clear;$('clear-profile').onclick=clear;
  $('delete-profile').onclick=()=>{const id=fields.id.value;if(id){profiles=profiles.filter(p=>p.id!==id);persist();render();clear();}};
  $('export-profiles').onclick=()=>{
    const blob=new Blob([JSON.stringify({format:'trmux-network-profile-drafts-v1',profiles},null,2)],{type:'application/json'});
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='trmux-network-profile-drafts.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  $('profile-import-file').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try {
      if(file.size>100000)throw new Error('Import file is too large (100 KB max).');
      const doc=JSON.parse(await file.text());const items=Array.isArray(doc)?doc:doc.profiles;
      if(!Array.isArray(items)||items.length>100||!items.every(validProfile))throw new Error('File must contain up to 100 valid Trmux profile drafts.');
      const normalized=items.map(p=>({id:crypto.randomUUID(),name:p.name.slice(0,80),type:p.type,host:p.host,port:p.port,notes:p.notes.slice(0,500)}));
      profiles=[...normalized,...profiles].slice(0,100);persist();render();$('profile-status').textContent=`Imported ${normalized.length} local drafts. No network settings were changed.`;
    } catch(err) {$('profile-status').textContent=`Import failed: ${err.message}`;} finally {e.target.value='';}
  };
  render();
})();
