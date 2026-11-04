const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Merge: API replaces local menu without losing responsive preview, filters and details', () => {
  const nodes = {}, events = {};
  let cards = [], buttons = [], columns = 4;
  const observed = new Set();
  const element = () => ({
    hidden: false, value: '', dataset: {}, attrs: {}, listeners: {},
    classList: { remove() {}, toggle() {}, add() {} },
    setAttribute(k,v) { this.attrs[k]=v; },
    addEventListener(t,fn) { this.listeners[t]=fn; },
    showModal() { this.open=true; }, close() {}, focus() {}, scrollIntoView() {}
  });
  function node(id) {
    if (!nodes[id]) {
      const el = element(); let html='';
      Object.defineProperty(el,'innerHTML',{get:()=>html,set(value){
        html=value;
        if(id==='menuGrid') cards=[...value.matchAll(/data-cat="([^"]+)" data-name="([^"]+)"/g)].map(m=>({...element(),dataset:{cat:m[1],name:m[2]}}));
        if(id==='menuFilters') buttons=[...value.matchAll(/data-filter="([^"]+)"/g)].map(m=>({...element(),dataset:{filter:m[1]}}));
      }});
      nodes[id]=el;
    }
    return nodes[id];
  }
  const context={window:{addEventListener(){}},Event:class{constructor(type){this.type=type}},
    getComputedStyle:()=>({gridTemplateColumns:Array(columns).fill('280px').join(' ')}),
    observer:{observe(el){observed.add(el)},unobserve(el){observed.delete(el)}},
    document:{body:element(),getElementById:node,
      querySelectorAll(s){return s==='.filter-btn'?buttons:s==='.menu-card'||s.includes('#menuGrid')?cards:[]},
      addEventListener(t,fn){(events[t]??=[]).push(fn)},
      dispatchEvent(e){for(const fn of events[e.type]||[])fn(e)}
    }};
  vm.createContext(context);
  for(const file of ['assets/js/cardapio-data.js','assets/js/cardapio.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
  const source=fs.readFileSync('assets/js/boteco.js','utf8');
  vm.runInContext(source.slice(source.indexOf('// Category, search'),source.indexOf('// Gallery lightbox')),context);
  vm.runInContext(source.slice(source.indexOf("document.addEventListener('boteco:menu-will-update'"),source.indexOf('// Smooth scroll')),context);
  assert.equal(cards.length,78);
  assert.equal(cards.filter(c=>!c.hidden).length,8);
  assert(node('specialsGrid').innerHTML.includes('Feijoada'));
  const oldCards=[...cards];
  const data={categorias:[{id:1,nome:'Pratos'},{id:2,nome:'Bebidas'}],produtos:Array.from({length:12},(_,i)=>({id:100+i,categoria_id:i<9?1:2,nome:'Produto '+i,descricao:'Descrição',preco:'25.50',destaque:i===0,ordem_destaque:0})),estabelecimento:{whatsapp:'5511981904839'}};
  context.window.updateBotecoMenu(data);
  assert.equal(cards.length,12);assert.equal(buttons.length,2);
  assert.equal(cards.filter(c=>!c.hidden).length,8);
  assert(oldCards.every(c=>!observed.has(c)));
  node('menuMore').listeners.click();assert.equal(cards.filter(c=>!c.hidden).length,12);
  buttons[1].listeners.click();assert.equal(cards.filter(c=>!c.hidden).length,3);assert(node('menuMore').hidden);
  buttons[1].listeners.click();assert.equal(cards.filter(c=>!c.hidden).length,8);
  columns=1;vm.runInContext('updateMenuPreview()',context);assert.equal(cards.filter(c=>!c.hidden).length,4);
  node('menuSearch').value='Produto 11';node('menuSearch').listeners.input();assert.equal(cards.filter(c=>!c.hidden).length,1);
  for(const fn of events.click)fn({target:{closest:()=>({dataset:{product:'100'},focus(){}})}});
  assert.equal(node('productTitle').textContent,'Produto 0');assert(node('productContent').innerHTML.includes('25,50'));assert(node('productContent').innerHTML.includes('wa.me/5511981904839'));
  context.window.updateBotecoMenu({categorias:[],produtos:[]});assert.equal(cards.length,0);assert.equal(node('menuEmpty').hidden,false);
});

test('Merge: HTML is conflict-free, loads both systems and server exposes required scripts',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert(!/^(<<<<<<<|=======|>>>>>>>)/m.test(html));
  const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(scripts,['assets/js/cardapio-data.js','assets/js/cardapio.js','assets/js/boteco.js','assets/js/cms.js']);
  const server=fs.readFileSync('server/app.js','utf8');
  scripts.forEach(s=>{assert(fs.existsSync(s));assert(server.includes('"'+s+'"'))});
  assert(fs.readFileSync('assets/js/cms.js','utf8').includes('window.updateBotecoMenu(data)'));
});
