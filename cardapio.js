// Rendered before boteco.js so filters and Scroll Reveal include the complete menu.
(() => {
    const {formatPrice,priceLabel}=window.BOTECO_MENU;
    let {categories,products}=window.BOTECO_MENU;
    let featuredIds=['baiao-especial','feijoada','torresmo'];
    let whatsapp='5511940068689';
    const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const category = id => categories.find(c=>c.id===id);
    const renderMenu = () => {
    document.getElementById('menuFilters').innerHTML = categories.map(c=>`<button class="filter-btn" data-filter="${escape(c.id)}" aria-pressed="false">${escape(c.name)}</button>`).join('');
    document.getElementById('menuGrid').innerHTML = products.map(p=>`<article class="menu-card menu-card-text fade-in" data-cat="${escape(p.category)}" data-name="${escape(p.name)}"><div class="menu-body"><div class="menu-card-heading"><span class="menu-symbol" aria-hidden="true"><i class="fas ${category(p.category).icon}"></i></span><p class="menu-cat">${escape(category(p.category).name)}</p></div><h3>${escape(p.name)}</h3><p>${escape(p.description||'Confira as opções e os detalhes deste item.')}</p>${p.availability?`<span class="menu-availability">${escape(p.availability)}</span>`:''}<div class="menu-foot"><span class="menu-price">${priceLabel(p)}</span><button class="menu-details-button" data-product="${escape(p.id)}" aria-label="Ver detalhes de ${escape(p.name)}">Ver detalhes <span aria-hidden="true">↗</span></button></div></div></article>`).join('');
    document.getElementById('specialsGrid').innerHTML = featuredIds.filter(id=>products.some(p=>p.id===id)).map(id=>{const p=products.find(p=>p.id===id);return `<article class="special-card fade-in"><div class="special-body"><p class="sec-sub">${escape(category(p.category).name)}</p><h3>${escape(p.name)}</h3><p>${escape(p.description||'Disponível em porções pequena e grande.')}</p>${p.availability?`<span class="menu-availability">${escape(p.availability)}</span>`:''}<div class="special-footer"><span class="special-price">${priceLabel(p)}</span><button class="menu-details-button" data-product="${escape(id)}">Ver detalhes ↗</button></div></div></article>`}).join('');
    };
    renderMenu();
    window.updateBotecoMenu = data => {
        const nextCategories = data.categorias.map(c=>({id:String(c.id),name:c.nome,icon:'fa-utensils'}));
        const nextProducts = data.produtos.map(p=>({
            id:String(p.id),category:String(p.categoria_id),name:p.nome,description:p.descricao,
            variants:[{name:'Único',price:p.preco == null ? null : Number(p.preco)}],
            options:[],addons:[],days:[]
        }));
        if(nextProducts.some(p=>!nextCategories.some(c=>c.id===p.category))) throw Error('Categoria inválida na API');
        categories=nextCategories;products=nextProducts;
        featuredIds=data.produtos.filter(p=>p.destaque).sort((a,b)=>a.ordem_destaque-b.ordem_destaque).map(p=>String(p.id));
        whatsapp=String(data.estabelecimento?.whatsapp||whatsapp).replace(/\D/g,'');
        document.dispatchEvent(new Event('boteco:menu-will-update'));
        renderMenu();
        document.dispatchEvent(new Event('boteco:menu-updated'));
    };
    const dialog=document.getElementById('productDialog');
    let trigger=null;
    document.addEventListener('click',event=>{
        const button=event.target.closest('[data-product]');
        if(!button)return;
        const p=products.find(p=>p.id===button.dataset.product);if(!p)return;
        trigger=button;
        document.getElementById('productTitle').textContent=p.name;
        document.getElementById('productContent').innerHTML=`<p class="sec-sub">${escape(category(p.category).name)}</p>${p.description?`<p>${escape(p.description)}</p>`:''}${p.availability?`<p class="menu-availability">${escape(p.availability)}</p>`:''}<h3>Tamanhos e valores</h3><dl class="product-prices">${p.variants.map(v=>`<div><dt>${escape(v.name)}</dt><dd>${v.price===null?'Consultar valor':formatPrice(v.price)}</dd></div>`).join('')}</dl>${p.options.map(o=>`<h3>${escape(o.name)}</h3><p>${o.values.map(escape).join(' · ')}</p>`).join('')}${p.addons.length?`<h3>Adicionais opcionais</h3><dl class="product-prices">${p.addons.map(a=>`<div><dt>${escape(a.name)}</dt><dd>+ ${formatPrice(a.price)}</dd></div>`).join('')}</dl><p class="product-note">Adicionais não estão incluídos no preço base.</p>`:''}<a class="btn btn-whatsapp" href="https://wa.me/${whatsapp}?text=${encodeURIComponent('Olá! Gostaria de informações sobre '+p.name+'.')}" target="_blank" rel="noopener">Consultar pelo WhatsApp</a>`;
        dialog.showModal();document.body.classList.add('product-dialog-open');
    });
    document.getElementById('closeProduct').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
    dialog.addEventListener('close',()=>{document.body.classList.remove('product-dialog-open');trigger?.focus({preventScroll:true})});
})();
