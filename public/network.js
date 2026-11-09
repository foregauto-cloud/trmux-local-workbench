'use strict';
(() => {
  const KEY = 'trmux.network-profiles.v1';
  const $ = id => document.getElementById(id);
  const form = $('profile-form');
  if (!form) return;
  const list = $('profile-list');
  const fields = { id: $('profile-id'), name: $('profile-name'), type: $('profile-type'), host: $('profile-host'), port: $('profile-port'), notes: $('profile-notes') };
  const types = new Set(['wireguard','openvpn','socks5','http-connect']);
  let profiles = [];
  let storageAvailable = true;
  function validHost(host) {
    if (typeof host !== 'string' || !host || host.length > 253 || /[\s/@?#\\]/.test(host) || host.includes('://')) return false;
    if (host.startsWith('[') && host.endsWith(']')) {
      try { return new URL(`http://${host}`).hostname.length > 2; } catch { return false; }
    }
    if (/^[0-9.]+$/.test(host)) return host.split('.').length === 4 && host.split('.').every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
    return host.split('.').every(label => label.length > 0 && label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
  }
  function validProfile(p) {
    return p && typeof p === 'object' && typeof p.id === 'string' && p.id.length <= 80 && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 80 && types.has(p.type) && validHost(p.host) && Number.isInteger(p.port) && p.port > 0 && p.port <= 65535 && typeof p.notes === 'string' && p.notes.length <= 300;
  }
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    profiles = Array.isArray(value) ? value.filter(validProfile).slice(0, 100) : [];
  } catch (error) {
    storageAvailable = false;
    $('profile-status').textContent = `Browser storage unavailable: ${error.message}`;
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(profiles)); storageAvailable = true; return true; }
    catch (error) { storageAvailable = false; $('profile-status').textContent = `Could not save drafts in this browser: ${error.message}`; return false; }
  }
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
      const remove=document.createElement('button');remove.type='button';remove.className='profile-remove';remove.textContent='×';remove.title='Delete profile';remove.onclick=()=>removeProfile(profile.id);
      row.append(open,remove);list.append(row);
    }
  }
  function clear() { form.reset();fields.id.value='';$('delete-profile').disabled=true;$('export-template').disabled=true;$('profile-status').textContent='New draft. No connection will be made.'; }
  function fill(p) { fields.id.value=p.id;fields.name.value=p.name;fields.type.value=p.type;fields.host.value=p.host;fields.port.value=p.port;fields.notes.value=p.notes;$('delete-profile').disabled=false;$('export-template').disabled=false;$('profile-status').textContent='Editing local draft.'; }
  function removeProfile(id) { profiles=profiles.filter(x=>x.id!==id);if(!persist())return;render();if(fields.id.value===id)clear(); }
  function showNetworks(show) {
    const network=$('network-view'), editor=document.querySelector('.editor-panel'), analyzer=$('analyzer-view');
    network.classList.toggle('hidden',!show);editor.classList.toggle('hidden',show);
    if(show) analyzer.classList.add('hidden');
    $('network-config-button').classList.toggle('selected',show);
    document.querySelectorAll('.tool-link').forEach(b=>b.classList.toggle('selected',show?b.dataset.view==='networks':b.dataset.view==='editor'));
  }
  window.trmuxShowView = view => {
    if(view==='networks') { showNetworks(true); return; }
    showNetworks(false);
    $('analyzer-view').classList.toggle('hidden',view!=='analyzer');
    $('editor-view').classList.toggle('hidden',view==='analyzer');
    document.querySelectorAll('.tool-link').forEach(b=>b.classList.toggle('selected',b.dataset.view===view));
  };
  $('network-config-button').addEventListener('click',()=>window.trmuxShowView('networks'));
  document.querySelectorAll('[data-open-networks]').forEach(b=>b.addEventListener('click',()=>window.trmuxShowView('networks')));
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const host=fields.host.value.trim(),port=Number(fields.port.value),name=fields.name.value.trim(),notes=fields.notes.value.trim();
    if(!name||name.length>80||!validHost(host)||!Number.isInteger(port)||port<1||port>65535){$('profile-status').textContent='Enter a profile name, valid hostname/IP, and port 1–65535.';return;}
    const existing=profiles.findIndex(p=>p.id===fields.id.value);
    const profile={id:fields.id.value||crypto.randomUUID(),name,type:fields.type.value,host,port,notes:notes.slice(0,300)};
    if(existing>=0)profiles[existing]=profile;else profiles.unshift(profile);
    profiles=profiles.slice(0,100);if(!persist())return;render();fill(profile);$('profile-status').textContent='Draft saved only in this browser. No network connection was made.';
  });
  $('new-profile').onclick=clear;$('clear-profile').onclick=clear;
  $('delete-profile').onclick=()=>fields.id.value&&removeProfile(fields.id.value);
  $('export-profiles').onclick=()=>{
    const blob=new Blob([JSON.stringify({format:'trmux-network-profile-drafts-v1',profiles},null,2)],{type:'application/json'});
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='trmux-network-profile-drafts.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  $('export-template').onclick=()=>{
    const profile=profiles.find(p=>p.id===fields.id.value);
    if(!profile){$('profile-status').textContent='Save a draft before exporting a template.';return;}
    let content,filename;
    if(profile.type==='wireguard'){
      content=`# Draft only. Replace placeholders in the trusted WireGuard client.\n# No keys or peer configuration are generated.\n[Interface]\nPrivateKey = <ADD_PRIVATE_KEY_IN_CLIENT_ONLY>\nAddress = <ADD_ASSIGNED_ADDRESS>\n\n[Peer]\nPublicKey = <ADD_SERVER_PUBLIC_KEY>\nEndpoint = ${profile.host}:${profile.port}\nAllowedIPs = <ADD_AUTHORIZED_ROUTES>\n`;
      filename=`${profile.name.replace(/[^A-Za-z0-9_-]/g,'_')}.conf`;
    } else if(profile.type==='openvpn') {
      content=`# Draft only. Add certificate/key material using your trusted OpenVPN client.\nclient\nremote ${profile.host} ${profile.port}\nproto udp\n# Add auth, CA, certificate, and routing settings from your authorized provider.\n`;
      filename=`${profile.name.replace(/[^A-Za-z0-9_-]/g,'_')}.ovpn`;
    } else {
      content=`# Proxy endpoint draft only; not a credential or active connection.\n${profile.type==='socks5'?'socks5':'http-connect'}://${profile.host}:${profile.port}\n`;
      filename=`${profile.name.replace(/[^A-Za-z0-9_-]/g,'_')}.txt`;
    }
    const blob=new Blob([content],{type:'text/plain'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    $('profile-status').textContent='Exported a non-secret template. Complete and import it only in a trusted native client; Trmux did not connect.';
  };
  $('profile-import-file').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try {
      if(file.size>100000)throw new Error('Import file is too large (100 KB max).');
      const doc=JSON.parse(await file.text());const items=Array.isArray(doc)?doc:doc.profiles;
      if(!Array.isArray(items)||items.length>100||!items.every(validProfile))throw new Error('File must contain up to 100 valid Trmux draft records; secret fields are not supported.');
      const normalized=items.map(p=>({id:crypto.randomUUID(),name:p.name, type:p.type,host:p.host,port:p.port,notes:p.notes}));
      profiles=[...normalized,...profiles].slice(0,100);if(!persist())return;render();$('profile-status').textContent=`Imported ${normalized.length} local drafts. No network settings were changed.`;
    } catch(err) {$('profile-status').textContent=`Import failed: ${err.message}`;} finally {e.target.value='';}
  };
  render();
})();
