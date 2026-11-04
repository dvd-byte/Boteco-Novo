# Armazenamento externo — Hostinger Business

> Situação atual (04/11/2026): site e banco implantados na Hostinger; imagens públicas no R2 em https://imagens.verols.com.br. Administrador será cadastrado depois. Relatos de testes e pendências de provisionamento abaixo descrevem a entrega técnica original, não novos testes de produção. Consulte o README para o fluxo atual.

## Arquitetura e compatibilidade

POST /api/admin-upload continua recebendo multipart imagem, exige sessão e Origin e retorna 201 {"url":"https://imagens.exemplo.com/images/<sha256>.webp"}. O dashboard já usa essa URL no formulário e salva a associação com POST/PATCH do registro. Não houve alteração de frontend. Upload não conhece o ID do registro: a associação continua sendo a segunda requisição existente, sem nova etapa manual.

server/storage.js desacopla armazenamento do controlador, usa @aws-sdk/client-s3 oficial e Sharp. Imagens JPEG/PNG/WebP até 5 MB e 40 MP são decodificadas, orientadas e recodificadas para WebP, removendo metadados por padrão; animações/múltiplas páginas são recusadas. A transformação pode alterar qualidade (85). Chave pelo SHA256 do resultado, em images/, evita duplicação do mesmo conteúdo; PutObject com IfNoneMatch=* evita sobrescrever objeto existente e HeadObject confirma tamanho/metadados. Falhas retornam 503 genérico sem segredos. Nenhuma linha do produto é gravada no upload.

Em produção STORAGE_PROVIDER=s3 é obrigatório. Não há fallback silencioso para disco. STORAGE_PROVIDER=local permanece exclusivamente para desenvolvimento, respeitando os arquivos legados. Com S3, os bytes são processados em memória e enviados ao serviço; o backend não grava novos uploads no disco. O diretório legado /uploads continua disponível para compatibilidade enquanto arquivos existirem.

As URLs públicas estáveis são persistidas nos campos existentes imagem_url/logo_url. Sem URLs assinadas e sem migração estrutural de banco. A chave do objeto é derivável da URL e do STORAGE_PUBLIC_BASE_URL; não adicionar colunas evita quebrar contratos. Ao alterar provedor/domínio, preservar esse mapeamento e fazer migração planejada. URLs antigas continuam válidas enquanto seus arquivos/provedores existirem.

## Provedor e custos

Arquitetura genérica S3. R2 é o candidato de referência pelo tráfego de saída sem cobrança e compatibilidade S3, mas não foi contratado nem configurado. Limites gratuitos e cobrança de armazenamento/operações precisam ser conferidos antes da ativação; não há garantia de custo zero. Preços oficiais: https://developers.cloudflare.com/r2/pricing/. Utilizar domínio público próprio para produção; r2.dev tem limites e é destinado a desenvolvimento: https://developers.cloudflare.com/r2/buckets/public-buckets/.

Bucket de imagens públicas deve conter somente conteúdo público; não colocar dumps de banco, .env ou documentos privados. Permissões da aplicação: escrita/leitura dos objetos no bucket escolhido (PutObject/HeadObject), sem administração da conta. Credencial de exclusão pode ser separada e usada somente na manutenção. Permissões exatas dependem do provedor. Não aplicar expiração automática a imagens ainda referenciadas.

## Variáveis e configuração no hPanel

No painel da aplicação Node, abra Environment Variables (na implantação ou edição da aplicação). Configure as variáveis abaixo como segredos de servidor, sem aspas extras, sem arquivo .env no repositório. Salve e faça a nova implantação somente após autorização. Guia oficial: https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/.

- STORAGE_PROVIDER=s3
- STORAGE_ENDPOINT: endpoint HTTPS da API S3 (no R2, fornecido pela conta; não confundir com URL pública).
- STORAGE_REGION: região do provedor; normalmente auto no R2.
- STORAGE_BUCKET: bucket existente autorizado.
- STORAGE_ACCESS_KEY_ID e STORAGE_SECRET_ACCESS_KEY: credenciais restritas ao bucket, somente no servidor.
- STORAGE_PUBLIC_BASE_URL: endereço HTTPS estável público, sem query/fragmento, servindo a raiz do bucket/prefixo correspondente.
- STORAGE_FORCE_PATH_STYLE: false por padrão; true apenas se exigido pelo provedor.

Preservar NODE_ENV=production, PUBLIC_ORIGIN=https://dominio-do-site, DB_* e a configuração de proxy validada para a Hostinger. npm ci instala o SDK e Sharp; npm start inicia a aplicação. O armazenamento exige HTTPS e falha na inicialização se faltarem variáveis. /api/health verifica MariaDB; não certifica bucket, credenciais nem a URL pública. Não usar UPLOAD_DIR como destino definitivo na Business.

Antes de publicar: ativar bucket e leitura pública somente de imagens, configurar domínio, inserir variáveis, executar upload de homologação e abrir sua URL numa sessão sem autenticação. HeadObject valida existência via credenciais, mas não comprova que o domínio público está configurado.

## Migração e rollback

node scripts/migrate-storage.js faz somente inventário. Examina produtos.imagem_url, fotos.imagem_url, secoes.imagem_url e estabelecimento.logo_url. Nesta máquina encontrou 18 referências locais disponíveis; arquivos estáticos que aparecem apenas no HTML/CSS não são reescritos. URLs remotas existentes são preservadas.

Após autorização e backup, com STORAGE_PROVIDER=s3 e credenciais configuradas: node scripts/migrate-storage.js --apply. O script verifica cada arquivo, envia uma cópia por conteúdo, confirma upload e só então atualiza referências em transação, com comparação da URL anterior para não sobrescrever edições concorrentes. Arquivos locais não são apagados. Reexecução não reinsere linhas nem sobrescreve objetos; chaves por conteúdo permitem repetir uploads em caso de interrupção. Falha antes do commit mantém o banco anterior; objetos já enviados podem ficar sem referência.

O manifesto .data/storage-migration-<timestamp>.json é escrito ANTES das alterações. Copie-o para armazenamento privado durável fora da aplicação antes de redeploy. Rollback: node scripts/migrate-storage.js --rollback CAMINHO_DO_MANIFESTO. O rollback altera apenas registros ainda apontando para a URL migrada, preservando edições posteriores; arquivos antigos precisam estar disponíveis. Não executamos --apply ou rollback reais neste trabalho. O script deve rodar de uma cópia que ainda tenha as imagens locais; pode ser esta máquina, com acesso autorizado ao banco correto.

## Substituição, órfãos e remoção

Nova imagem só substitui a referência no salvamento do registro; falha de upload ou verificação mantém a imagem anterior. Nenhuma imagem antiga é apagada automaticamente, pois pode estar compartilhada. Upload sem posterior salvamento e falha entre envio e confirmação podem deixar órfãos. Não há fila automática de coleta nesta versão.

Manutenção controlada: node scripts/remove-storage-object.js images/<sha256>.webp mostra referências e não apaga nada. Para excluir, parar TODOS os escritores (aplicações, importadores e tarefas), obter autorização, definir STORAGE_OFFLINE_MAINTENANCE=true e adicionar --delete. O comando aceita somente chaves do prefixo gerenciado e bloqueia objetos referenciados nas quatro tabelas. A parada é requisito operacional para evitar corrida com novas associações; a variável não para processos automaticamente. Inspecionar também uso fora dessas tabelas antes de excluir. Falha do provedor retorna erro e exit code 1; a mesma chave pode ser reenviada depois, sem modificar registros. Registrar a chave pendente em ticket/log operacional durável — a aplicação não oferece fila persistente de retries.

## Backup

O script antigo de backup de uploads locais não cobre objetos S3. Continuar fazendo backup MariaDB e exportar/copiar objetos para destino privado independente conforme política do provedor. Definir retenção, orçamento e testar restauração do conjunto banco+objetos antes da publicação. Não excluir legados até concluir migração e validar todas as URLs. Nenhum serviço externo foi criado.

## Evidências e validação restante

npm test: 14 testes passaram. SDK instalado com zero vulnerabilidades reportadas pelo npm. Testes do serviço usam cliente S3 simulado; integração usa MariaDB local real e chamadas HTTP reais da API, com S3 simulado. Cenários: recodificação, chave estável, prevenção de sobrescrita, consulta/associação no banco, nova instância de armazenamento com pasta inexistente após reinício HTTP, troca mantendo objeto anterior, credencial indisponível simulada, limite e imagem inválida. Isso não é um deploy Hostinger nem prova interoperabilidade real do SDK com R2.

Pendentes: provisionamento autorizado do bucket, credenciais, política pública, abertura HTTP real da URL, execução da migração com manifesto durável, teste real após restart e redeploy GitHub da homologação, cópia externa de objetos e restauração. Critério de aceite: URL antiga acessível sem autenticação após redeploy, produto ainda apontando para ela, troca segura e erro do provedor sem mudança no banco.

Nenhuma alteração visual necessária para o contrato {url}. A pendência pré-existente de assets/js/cardapio.js ignorar fotografias continua com o desenvolvedor frontend, conforme INTEGRACAO-FOTOS.md.
