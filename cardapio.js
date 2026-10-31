// Rendered before boteco.js so filters and Scroll Reveal include the complete menu.
(() => {
    const {categories,products,formatPrice,priceLabel}=window.BOTECO_MENU;
    const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const category = id => categories.find(c=>c.id===id);
    document.getElementById('menuFilters').innerHTML = categories.map(c=>`<button class="filter-btn" data-filter="${c.id}" aria-pressed="false">${c.name}</button>`).join('');
    document.getElementById('menuGrid').innerHTML = products.map(p=>`<article class="menu-card menu-card-text fade-in" data-cat="${p.category}" data-name="${escape(p.name)}"><div class="menu-body"><div class="menu-card-heading"><span class="menu-symbol" aria-hidden="true"><i class="fas ${category(p.category).icon}"></i></span><p class="menu-cat">${category(p.category).name}</p></div><h3>${escape(p.name)}</h3><p>${escape(p.description||'Confira as opções e os detalhes deste item.')}</p>${p.availability?`<span class="menu-availability">${escape(p.availability)}</span>`:''}<div class="menu-foot"><span class="menu-price">${priceLabel(p)}</span><button class="menu-details-button" data-product="${p.id}" aria-label="Ver detalhes de ${escape(p.name)}">Ver detalhes <span aria-hidden="true">↗</span></button></div></div></article>`).join('');
    document.getElementById('specialsGrid').innerHTML = ['baiao-especial','feijoada','torresmo'].map(id=>{const p=products.find(p=>p.id===id);return `<article class="special-card fade-in"><div class="special-body"><p class="sec-sub">${category(p.category).name}</p><h3>${escape(p.name)}</h3><p>${escape(p.description||'Disponível em porções pequena e grande.')}</p>${p.availability?`<span class="menu-availability">${escape(p.availability)}</span>`:''}<div class="special-footer"><span class="special-price">${priceLabel(p)}</span><button class="menu-details-button" data-product="${id}">Ver detalhes ↗</button></div></div></article>`}).join('');
    const dialog=document.getElementById('productDialog');
    let trigger=null;
    document.addEventListener('click',event=>{
        const button=event.target.closest('[data-product]');
        if(!button)return;
        const p=products.find(p=>p.id===button.dataset.product);if(!p)return;
        trigger=button;
        document.getElementById('productTitle').textContent=p.name;
        document.getElementById('productContent').innerHTML=`<p class="sec-sub">${category(p.category).name}</p>${p.description?`<p>${escape(p.description)}</p>`:''}${p.availability?`<p class="menu-availability">${escape(p.availability)}</p>`:''}<h3>Tamanhos e valores</h3><dl class="product-prices">${p.variants.map(v=>`<div><dt>${escape(v.name)}</dt><dd>${v.price===null?'Consultar valor':formatPrice(v.price)}</dd></div>`).join('')}</dl>${p.options.map(o=>`<h3>${escape(o.name)}</h3><p>${o.values.map(escape).join(' · ')}</p>`).join('')}${p.addons.length?`<h3>Adicionais opcionais</h3><dl class="product-prices">${p.addons.map(a=>`<div><dt>${escape(a.name)}</dt><dd>+ ${formatPrice(a.price)}</dd></div>`).join('')}</dl><p class="product-note">Adicionais não estão incluídos no preço base.</p>`:''}<a class="btn btn-whatsapp" href="https://wa.me/5511940068689?text=${encodeURIComponent('Olá! Gostaria de informações sobre '+p.name+'.')}" target="_blank" rel="noopener">Consultar pelo WhatsApp</a>`;
        dialog.showModal();document.body.classList.add('product-dialog-open');
    });
    document.getElementById('closeProduct').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
    dialog.addEventListener('close',()=>{document.body.classList.remove('product-dialog-open');trigger?.focus({preventScroll:true})});
})();
