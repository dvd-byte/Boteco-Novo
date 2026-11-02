# Integração de fotografias — entrega ao frontend

Revisão de 02/11/2026. Somente backend, scripts e testes foram modificados.

## Produtos e fotos

GET /api/public/conteudo retorna produtos e fotos junto ao restante do conteúdo. GET /api/public/produtos?page=1&limit=24 retorna {items,total,page,limit}; GET /api/public/produtos/:id retorna um produto ativo cuja categoria também esteja ativa.

Exemplo de campos de fotografia do produto (ID ilustrativo):

```json
{"id":123,"nome":"Produto","imagem_url":"/uploads/arquivo.png","imagem_alt":"Descrição da fotografia"}
```

imagem_url e imagem_alt podem ser null. URLs de imagens locais são relativas ao mesmo domínio da API: /uploads/... ou imagens/.... URLs externas HTTP(S) também são permitidas, mas sua disponibilidade depende do provedor. O backend não baixa essas URLs. Em produção use HTTPS para evitar bloqueio de conteúdo misto.

POST/PATCH de produtos, fotos, seções e estabelecimento validam a existência das referências locais fornecidas em imagem_url/logo_url; travessia de diretórios e arquivos ausentes retornam 400 {error}. URLs externas não são verificadas por requisição, evitando SSRF. Arquivos compartilhados não são apagados ao substituir a imagem de um produto. Referências antigas não foram regravadas automaticamente.

## Pendência específica de cardapio.js (responsabilidade do frontend)

O mapeamento em updateBotecoMenu atualmente descarta imagem_url e imagem_alt; renderMenu gera menu-card-text sem elemento img. O responsável deve:

1. Preservar imagem_url e imagem_alt ao converter cada produto da API.
2. Usar esses campos na renderização do card e do destaque quando houver imagem.
3. Manter fallback sem imagem para null e erro de carregamento, sem usar uma imagem de outro prato.
4. Preservar filtros, detalhes, preços e Scroll Reveal.

Essas alterações NÃO foram feitas nesta entrega. Fotografias no banco não tornam os cards visuais automaticamente.

## Galeria e Instagram

Não há integração oficial nem token do Instagram. Ambas as áreas são cadastros manuais na tabela fotos, retornados por GET /api/public/conteudo no array fotos, com ativo=1 e ordem crescente por ordem,id.

```json
{"fotos":[{"id":10,"grupo":"galeria","imagem_url":"imagens/ambiente1.jpeg","texto_alternativo":"Ambiente","legenda":null,"link_url":null,"ordem":0,"ativo":1},{"id":11,"grupo":"instagram","imagem_url":"/uploads/arquivo.png","texto_alternativo":"Fotografia","legenda":null,"link_url":"https://www.instagram.com/","ordem":1,"ativo":1}]}
```

IDs e conteúdo acima são ilustrativos. O cliente separa por grupo; array vazio é válido. Administração: GET/POST /api/admin/fotos, PATCH/DELETE /api/admin/fotos/:id, sempre com sessão. Campos obrigatórios no POST: grupo (galeria/instagram), imagem_url, texto_alternativo, ordem, ativo; legenda/link_url opcionais. Uma sincronização real com Instagram exigiria um projeto próprio de integração e configuração da conta Meta; não é necessária para a faixa manual existente.

## Login, upload e moderação

POST /api/auth/login com {email,password} cria cookie HttpOnly; GET /api/auth/me verifica a sessão; POST /api/auth/logout a invalida. Em produção o cookie é Secure e exige HTTPS. Mutações exigem cabeçalho Origin igual ao PUBLIC_ORIGIN; usar o mesmo domínio para frontend e API. Não expor senha de banco nem token administrativo no código cliente.

POST /api/admin-upload recebe FormData com campo imagem. Não defina Content-Type manualmente: o navegador precisa incluir o boundary. JPEG/PNG/WebP de até 5 MB, decodificados por sharp, até 40 megapixels. Retorna 201 {"url":"/uploads/arquivo-aleatorio.png"}. Em seguida PATCH /api/admin/produtos/:id com {"imagem_url":"/uploads/arquivo-aleatorio.png","imagem_alt":"Descrição"}. O arquivo é publicado pelo servidor em /uploads/...; salvar a referência é uma segunda operação. Na falha da gravação pode ficar um arquivo órfão, que deve ser revisado antes de excluir.

GET /api/admin/avaliacoes lista avaliações; PATCH /api/admin/avaliacoes/:id com {"status":"aprovada"} ou rejeitada registra o moderador. Visitantes usam POST /api/public/avaliacoes com nome_cliente, nota, comentario, website vazio e started_at real do formulário. A resposta pública em /api/public/conteudo contém apenas aprovadas. Veja BACKEND.md para limites e códigos HTTP.

## Evidências e limites

npm ci concluiu usando o lockfile, com zero vulnerabilidades reportadas pelo npm. Node local atende engines >=22. npm test: 11 testes passaram, incluindo MariaDB real, importação idempotente em transação revertida, publicação/ordenação das fotos, autenticação, moderação, associação de upload PNG e imagens nulas/inexistentes. Banco local consultado tinha 15 produtos com referências de imagem, 5 fotos de galeria e 6 de Instagram. Essas contagens não confirmam dados comerciais nem disponibilidade de todas as URLs externas.

Nenhum catálogo foi importado permanentemente, nenhum produto desconhecido foi desativado e nenhuma estrutura de banco foi recriada. Testes usam a instância isolada local já existente; fixtures de fotos e produtos são removidas e a importação é revertida.
