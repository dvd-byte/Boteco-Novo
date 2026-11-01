# Boteco da Vila — site e painel unificado

O painel oficial é `/admin/`: tema escuro, visão geral numérica, análises com gráficos e gerenciamento conectado à API. Não há cadastros demonstrativos nem gravação administrativa em localStorage.

## Ativar em um banco existente

1. Configure `.env` a partir de `.env.example`, com a conexão MariaDB e `PUBLIC_ORIGIN` correspondente ao endereço usado no navegador. Não versione senhas.
2. Execute `npm ci` e `npm run migrate`. A migração adiciona os campos do cardápio e permite preço sob consulta, sem excluir registros.
3. Execute `npm start` e abra `http://localhost:3000/admin/` (ou a porta configurada). Entre com o administrador já existente.
4. Para trazer os 78 itens do PDF, use **Importar cardápio do PDF** em Cardápio, ou `npm run catalog:import`. A importação não sobrescreve produtos previamente importados, nem exclui produtos existentes. Oculte no painel os exemplos antigos que não devem aparecer.

Opcionalmente, `npm run catalog:import -- --replace-menu` importa o catálogo e **oculta** os produtos anteriores sem código do catálogo. Não exclui registros; use apenas se deseja substituir a vitrine anterior pelo PDF.

## Banco novo

Depois de configurar o MariaDB e executar `npm run migrate`, use `npm run seed` para cadastrar o cardápio atual, textos, fotos, contatos e horários iniciais. O seed recusa um banco com categorias existentes e executa a carga em transação. Para criar um administrador, configure `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 12 caracteres) e execute `npm run admin:create`.

## Funcionalidades

- Visão geral: produtos, categorias, média das avaliações aprovadas e pendências.
- Gráficos: barras para categorias/notas, rosca para status e linha para avaliações recebidas por dia; período de 7 ou 30 dias.
- Produtos: categoria, ordem, imagem opcional, destaques, selo, variantes de tamanho/preço, preço sob consulta, adicionais, grupos de opções e dias disponíveis.
- Os preços das variações determinam o menor preço publicado. Campos `variacoes`, `adicionais`, `opcoes` e `dias_disponiveis` são listas JSON validadas pelo backend. O preço único continua compatível com cadastros anteriores.
- Categorias, textos das seções, fotos da galeria/Instagram, eventos, moderação das avaliações, informações e dois contatos WhatsApp.
- Horários: dias de funcionamento e múltiplos intervalos por dia, incluindo encerramento no dia seguinte.
- Upload de imagem preenche o formulário; a publicação ocorre quando o cadastro é salvo. JPEG, PNG e WebP, até 5 MB.

O frontend preserva busca, filtros desmarcáveis em quatro colunas, prévia de duas linhas com mínimo de quatro cards, Ver mais/menos, centralização do card isolado em duas colunas, detalhes, Scroll Reveal e navegação responsiva. Sem API disponível, o cardápio local do PDF continua sendo usado. Quando a API responde, seus cadastros são a fonte de dados.

Os valores de whisky ambíguos no PDF permanecem sob consulta até confirmação. O horário inicial informado pelo PDF é o da cozinha.

## Testes

`npm run test:unit` executa regressões de catálogo, validação, renderização, autenticação simulada, formulários, gráficos e moderação, sem conexão com MariaDB.

`npm test` também executa testes de integração com MariaDB e exige um **banco exclusivo de testes**, com administrador configurado. Não execute a suíte de integração em produção. A migração SQL e a conexão real precisam ser verificadas no ambiente onde o MariaDB estiver configurado.

## API e operação

- `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`: autenticação por cookie HttpOnly.
- `/api/public/conteudo`: conteúdo publicado; `/api/public/avaliacoes`: envio para moderação.
- `/api/admin/modelos`, `/api/admin/:recurso`: consulta e CRUD autenticados.
- `/api/admin/importar-cardapio`: importação autenticada e transacional do PDF, com propriedade booleana `replace`.
- `/api/admin-upload`: upload autenticado, campo multipart `imagem`.

As mutações exigem Origin igual a PUBLIC_ORIGIN. Senhas e fontes do servidor não são servidas. Faça backup do banco e da pasta de uploads; use armazenamento persistente em produção. Consulte os exemplos em `deploy/` para serviço Node e proxy Nginx. Não há loja, pedidos, pagamentos, cupons ou blog.
