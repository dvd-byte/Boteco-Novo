# Backend: contratos e operação

Escopo desta revisão: apenas server/, testes, dependências e infraestrutura. Nenhuma alteração nos arquivos cliente. Não houve commit, push, publicação ou alteração de DNS.

## Diagnóstico

Express 5, MariaDB com pool, sessões persistidas (token aleatório com hash SHA-256 no banco), senhas scrypt, cookies HttpOnly/SameSite Strict, proteção Origin e rate limiting já existiam. A API do conteúdo continua compatível. O catálogo estático ainda é dependência do importador; não removê-lo no frontend sem coordenar essa substituição. Não desativamos produtos de origem desconhecida. O modo replace do importador desativa TODOS os registros sem codigo_cardapio: o responsável deve revisar sua origem antes de acioná-lo.

## Autenticação e erros

POST /api/auth/login com {"email":"admin@example.com","password":"senha"}; resposta 200 {"nome":"Administrador"} e cookie. POST /api/auth/logout invalida a sessão e retorna 204. GET /api/auth/me retorna id, nome e email, nunca senha_hash. Frontend no mesmo domínio envia cookie automaticamente; mutações precisam de Origin igual a PUBLIC_ORIGIN. Não há CORS liberado para terceiros. Login limitado a 10 tentativas/15 minutos/IP; API 180 requisições/minuto/IP. Cookies Secure em NODE_ENV=production, HTTPS obrigatório. Sessão expira em oito horas.

Erros usam {"error":"mensagem"}: 400 entrada inválida, 401 sessão ausente/inválida, 403 origem inválida, 404 recurso ausente, 409 duplicidade/vínculo, 429 limite, 500 falha interna. Algumas rotas antigas retornam texto em 404 e o middleware de rate limiting pode retornar texto em 429: o consumidor deve checar Content-Type antes de chamar json().

## Cardápio

GET /api/public/conteudo mantém o contrato existente: categorias, produtos, secoes, fotos, avaliacoes, estabelecimento, horarios (incluindo intervalos). Somente categorias/produtos/fotos ativos e avaliações aprovadas são publicados.

GET /api/public/categorias retorna array ordenado por ordem,id.
GET /api/public/produtos?page=1&limit=24&categoria_id=1 retorna {"items":[],"total":78,"page":1,"limit":24}. O total mostrado é apenas um exemplo do formato; valores são calculados no banco. limit máximo 100; categoria_id opcional; ordem fixa ordem,id. GET /api/public/produtos/123 retorna um produto ativo ou 404; categoria inativa também impede acesso individual.

Produto: id, categoria_id, nome, descricao, preco (decimal em string ou null), imagem_url/imagem_alt opcionais, destaque, selo, ordem, ordem_destaque, ativo, datas, variacoes [{nome,preco}], adicionais [{nome,preco}], opcoes [{nome,valores:[]}], dias_disponiveis [0..6]. Lista de dias vazia significa sem restrição de dia. Preço null significa sob consulta; variações determinam o menor preço ou null se houver variação sob consulta. Os preços dentro das listas são números; o preço principal usa DECIMAL no MariaDB. O frontend decide a apresentação “A partir de”.

GET/POST /api/admin/:recurso e PATCH/DELETE /api/admin/:recurso/:id exigem sessão. Recursos: categorias, produtos, secoes, fotos, estabelecimento, horarios_funcionamento, intervalos_funcionamento. GET /api/admin/modelos descreve os campos aceitos. POST retorna 201 {id}; PATCH 200 {ok:true}; DELETE 204. Para preservar histórico, prefira PATCH {"ativo":false} para produtos. Exclusão física existente foi preservada para compatibilidade; categorias vinculadas não podem ser excluídas. Estabelecimento é singleton id=1 e não pode ser excluído.

Exemplo de cadastro de produto: {"categoria_id":1,"nome":"Nome confirmado","descricao":"Descrição confirmada","preco":"20.00","imagem_url":null,"imagem_alt":null,"destaque":false,"selo":null,"ordem":0,"ordem_destaque":0,"ativo":true}. Listas de detalhes omitidas recebem []. Para atualizar, envie somente os campos alterados.

## Imagens

POST /api/admin-upload: multipart/form-data com campo imagem e sessão. Até 5 MB; JPEG/PNG/WebP, decodificação real e limite de 40 megapixels. Retorna 201 {"url":"/uploads/nome-aleatorio.png"}. Grave essa URL com PATCH do produto/foto/seção; substituição usa o mesmo fluxo. Upload e gravação do cadastro são operações separadas: falha no cadastro pode deixar arquivo órfão. Não apagamos imagens antigas automaticamente, pois podem estar compartilhadas. Revisão de órfãos é tarefa operacional. UPLOAD_DIR deve ser persistente e gravável pelo usuário Node; não usar disco efêmero.

## Avaliações

POST /api/public/avaliacoes: {"nome_cliente":"Visitante","nota":5,"comentario":"Comentário do visitante","website":"","started_at":1760000000000}. started_at é o instante real de abertura do formulário em milissegundos (3 segundos a 24 horas antes do envio). Limite 5 envios/IP/hora. Sempre pendente; campos extras de status não concedem aprovação. Resposta 201 {message}. GET /api/admin/avaliacoes retorna a lista administrativa; PATCH /api/admin/avaliacoes/:id com {"status":"aprovada"} ou rejeitada/pendente registra moderador e data. Consultas públicas nunca incluem pendentes/rejeitadas.

## Indicadores

GET /api/admin/indicadores?dias=30 exige sessão, dias de 1 a 90. Resposta: produtos {total,ativos,inativos}, categorias {total}, avaliacoes {total,aprovadas,pendentes,rejeitadas,media_aprovadas}, produtos_por_categoria [{id,nome,total}], avaliacoes_por_dia [{dia:"YYYY-MM-DD",total}], periodo_dias. Média sem avaliações é null. Dias sem avaliações são omitidos; frontend pode preencher zero. Contagens derivam do banco; médias podem vir como string decimal. Séries usam o fuso da sessão MariaDB: alinhar servidor/banco a America/Sao_Paulo na hospedagem. Indicadores gerais são de todo o histórico; dias afeta somente a série diária. A interface existente pode continuar usando suas rotas atuais.

## MariaDB e migrações

As migrações existentes foram aplicadas apenas à instância local de testes, sem carga de catálogo, limpeza ou substituição dos dados. Antes de aplicá-las em outro banco, o responsável precisa revisar schema.sql, especialmente MODIFY que permite preço/imagem nulos e a coluna UNIQUE codigo_cardapio. O executor atual é idempotente, mas não possui tabela de versões nem rollback automático de DDL. Backup e revisão do responsável pelo banco são necessários para produção. Não criamos índices adicionais sem evidência de carga; avaliar EXPLAIN para filtros ativo/categoria/ordem conforme o volume real.

## Produção e backups

Hostinger: confirmar plano com execução contínua Node >=22 e acesso MariaDB; se plano compartilhado não oferecer Node, usar VPS ou hospedagem Node compatível. Configurações de exemplo deploy/nginx.conf e boteco.service exigem domínio, caminhos e usuário reais. PUBLIC_ORIGIN deve ser HTTPS sem barra final. TRUST_PROXY=1 somente atrás de exatamente um proxy confiável que sobrescreva X-Forwarded-For. Fechar portas Node/MariaDB ao público. Não ativamos serviços de produção.

Banco remoto deve usar rede privada ou TLS com certificado validado; não desabilite verificação de certificados. Arquivos .env, dados e uploads não entram no Git. O usuário do banco deve ter privilégios apenas no schema da aplicação; separar permissões de migração das de execução em produção.

Backup preparado: deploy/backup.sh, boteco-backup.service e .timer para VPS Linux. Instalar mariadb-client, gzip, tar, sha256sum. Credenciais em /etc/boteco/backup.cnf (600, seção [client], user/password/host); nunca em argumentos do processo. Copiar unidades para systemd e ativar timer somente quando o operador aprovar. Horário 03h usa fuso do servidor. Dumps transacionais requerem InnoDB; evitar migrações durante backup. Banco e uploads não formam snapshot atômico: executar em janela sem alterações administrativas para consistência entre ambos. Copiar backups para destino externo criptografado, definir retenção/custo e monitorar falhas. Script não apaga cópias existentes.

Restauração: em ambiente isolado, confira SHA256SUMS com sha256sum -c; crie banco vazio; descompacte database.sql.gz e importe com mariadb --defaults-extra-file=... BANCO_TESTE; extraia uploads.tar.gz em pasta vazia de uploads; ajuste permissões e .env; execute /api/health, login, consulta e download de uma foto. Só substitua produção após validar restauração e obter autorização. Restauração local isolada foi validada posteriormente; veja BACKUP-VALIDACAO.md. Agendamento e restauração em produção não foram executados.
