// Cardápio transcrito do PDF fornecido. Preços ambíguos permanecem sob consulta.
// Variações e opções estão separadas para a futura integração com o banco.
window.BOTECO_MENU = (() => {
    const categories = [
        ['tipicas','Comidas típicas','fa-utensils'], ['caldos','Caldos','fa-bowl-food'],
        ['mar','Frutos do mar','fa-fish'], ['vivenda','Vivenda do Camarão','fa-shrimp'],
        ['porcoes','Porções','fa-utensils'], ['drinks','Bebidas e drinks','fa-martini-glass-citrus'],
        ['sem-alcool','Sem álcool','fa-glass-water'], ['vinhos','Vinhos','fa-wine-glass']
    ].map(([id,name,icon])=>({id,name,icon}));
    const products = [];
    const add = (id,category,name,prices,description='',extra={}) => products.push({id,category,name,description,
        variants: prices.map(([name,price])=>({name,price})), options:[],addons:[],days:[],...extra});
    const unique = price => [['Único',price]];
    const sizes = (small,large) => [['Pequeno',small],['Grande',large]];
    add('fava','tipicas','Fava',[['Grande',70]]);
    add('dobradinha','tipicas','Dobradinha',[['Grande',70]]);
    add('baiao','tipicas','Baião de dois',sizes(79,89));
    add('baiao-especial','tipicas','Baião de dois especial',sizes(109,139),'Com picanha e queijo coalho.');
    add('picanha','tipicas','Picanha do Boteco',[['Individual',49]],'Acompanha vinagrete, arroz, farofa e fritas.');
    add('arroz','tipicas','Porção de arroz',sizes(8,10));
    add('feijao','tipicas','Porção de feijão',sizes(8,10));
    add('feijoada','tipicas','Feijoada',[['Média',85],['Grande',95]],'Acompanha arroz, torresmo de rolo, farofa, couve e vinagrete.',{days:[3,6],availability:'Às quartas e aos sábados'});
    ['Frango','Carne seca','Mocotó','Camarão'].forEach((name,i)=>add('caldo-'+i,'caldos','Caldo de '+name.toLowerCase(),[['Médio',26],['Grande',28]],'Acompanha pão francês.'));
    [['camarao','Camarão',75],['tilapia','Isca de tilápia',65],['bolinho-camarao','Bolinho de camarão',55],['bacalhau','Bolinho de bacalhau',55]].forEach(([id,name,p])=>add(id,'mar',name,unique(p)));
    add('casquinha','vivenda','Casquinha de peixe',unique(15));
    add('sem-casca','vivenda','Camarão sem casca',unique(75));
    add('strogonoff','vivenda','Strogonoff de camarão',[['Individual',40]],'Acompanha arroz e batata frita.');
    add('bobo','vivenda','Bobó de camarão',[['Individual',40]],'Acompanha arroz e batata frita.');
    add('tabua','porcoes','Tábua de picanha',unique(140),'Picanha na tábua com vinagrete, fritas, farofa e pão.');
    add('batata','porcoes','Batata frita',sizes(25,35),'Cheddar e bacon disponíveis como adicional.',{addons:[{name:'Cheddar e bacon',price:18}]});
    ['Carne seca','Costela','Cupim'].forEach((name,i)=>add('bolinho-'+i,'porcoes','Bolinho de '+name.toLowerCase(),unique(55)));
    add('carne-seca','porcoes','Carne seca',sizes(55,65),'Com mandioca ou batata.',{options:[{name:'Acompanhamento',values:['Mandioca','Batata']}]});
    add('calabresa','porcoes','Calabresa',sizes(25,35));
    add('costelinha','porcoes','Costelinha suína',unique(55));
    add('carneiro','porcoes','Carneiro',unique(69),'Com mandioca ou batata.',{options:[{name:'Acompanhamento',values:['Mandioca','Batata']}]});
    add('frango','porcoes','Frango à passarinho',sizes(35,45));
    add('mandioca','porcoes','Mandioca',unique(25),'Tamanho único.');
    [['salame','Salame',34],['provolone','Provolone à milanesa',40],['tulipa','Tulipa',50],['isca-frango','Isca de frango',45],['azeitonas','Azeitonas',8],['moela','Moela',48]].forEach(([id,name,p])=>add(id,'porcoes',name,unique(p)));
    add('torresmo','porcoes','Torresmo de rolo',sizes(28,38));
    add('cerveja-600','drinks','Cervejas 600 mL',[['600 mL',null]],'Consulte o valor da marca desejada.',{options:[{name:'Marcas',values:['Heineken','Serramalte','Stella Pure Gold','Corona','Original','Spaten','Amstel','Brahma Chopp','Skol']}]});
    add('long-neck','drinks','Cervejas long neck',[['Long neck',null]],'Consulte o valor da marca desejada.',{options:[{name:'Marcas',values:['Heineken','Corona','Heineken Zero','Amstel Ultra','Stella Gold']}]});
    const flavors=['Limão','Morango','Kiwi','Manga com maracujá','Dois limões com rapadura'];
    add('gin','drinks','Gin',unique(45),'Acompanha água tônica ou energético.',{options:[{name:'Sabores',values:['Tropical',...flavors]},{name:'Acompanhamento',values:['Água tônica','Energético']}]});
    add('caipirinha','drinks','Caipirinhas',unique(28),'Escolha o sabor e a base da bebida.',{options:[{name:'Sabores',values:flavors},{name:'Base',values:['Vodka','Saquê','Velho Barreiro']}]});
    // O alinhamento dos valores desses whiskies precisa de confirmação do estabelecimento.
    ['Jack Daniel’s','Buchanan’s','Old Parr','Gold Label Reserve','Red Label'].forEach((name,i)=>add('whisky-'+i,'drinks',name,[['Dose',i===4?25:null]],i===4?'':'Consulte o valor da dose.',{addons:[{name:'Gelo de coco',price:5}]}));
    add('doses','drinks','Doses da casa',[['Dose',10]],'',{options:[{name:'Opções',values:['Cabaré','Seleta','Salinas','Marimbondo','Dreher','São João da Barra','Velho Barreiro','São Francisco','Caribé','Ypióca','Conhaque']}]});
    [['dom-julio','Dom Júlio',35],['1800','1800',30],['cuervo','José Cuervo',20],['campari','Campari',15],['vodka','Vodka',12],['beats','Skol Beats',15],['ice','Ice',15],['draft','Draft — chopp de vinho',20]].forEach(([id,name,p])=>add(id,'drinks',name,unique(p)));
    add('licores','drinks','Licores',unique(27),'',{options:[{name:'Opções',values:['Amarula','Licor 43','Sheridan’s']}]});
    ['Água com ou sem gás','Água tônica','Refrigerante em lata / Coca-Cola KS','Suco de lata','Coca-Cola 1 L — vidro','Itubaína 355 mL','H2OH! / Sprite Lemon Fresh','Suco Pratz natural 900 mL','Suco Pratz natural 300 mL','Água de coco 1 L','Água de coco 200 mL','Gatorade','Red Bull'].forEach((name,i)=>add('na-'+i,'sem-alcool',name,unique(null),'Consulte o valor com a equipe.'));
    [['reservado','Reservado',90,'Fino tinto meio seco.'],['casal-garcia','Casal Garcia',90,''],['santa-carolina','Santa Carolina',55,'Fino tinto meio seco.'],['santa-helena','Santa Helena',75,'Fino tinto meio seco.'],['frisante','Frisante',90,''],['vinas','Viñas del Tango',70,'Fino tinto meio seco.']].forEach(([id,name,p,d])=>add(id,'vinhos',name,[['Garrafa',p]],d));
    add('dom-bosco','vinhos','Dom Bosco',[['Taça',10],['Garrafa',35]],'Vinho de mesa tinto meio seco.');
    add('santome','vinhos','Santomé',[['Taça',10],['Garrafa',35]],'Vinho de mesa tinto seco.');
    const formatPrice = value => value.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const priceLabel = product => {
        const prices = product.variants.map(v=>v.price);
        if (prices.some(p=>p===null)) return 'Consultar valor';
        const min = Math.min(...prices);
        return (new Set(prices).size > 1 ? 'A partir de ' : '') + formatPrice(min);
    };
    return {categories,products,formatPrice,priceLabel};
})();
