# Boteco da Vila — CMS Node.js + MariaDB

Site, API e dashboard são servidos pelo mesmo processo e domínio. Não há checkout, pedidos, pagamentos ou contas de visitantes.

## Testes locais já configurados nesta máquina

- MariaDB isolado: `127.0.0.1:3307`, dados em `.data/` (ignorada no Git).
- Credenciais aleatórias de teste e acesso do administrador estão no arquivo `.env` local, nunca servido ao navegador ou versionado. O e-mail de teste é `admin@boteco.local`; consulte `ADMIN_PASSWORD` no editor local para a senha.
- `npm start` inicia o site em http://localhost:3000 e o dashboard em http://localhost:3000/admin/.
- `npm test` testa integração real com MariaDB, permissões, moderação, vínculos e renderização DOM do site. Execute apenas num banco de testes, com ADMIN_EMAIL/ADMIN_PASSWORD configurados.
- Se reiniciar a máquina, inicie a instância isolada com `mariadbd --defaults-file=C:\Users\kevin\Documents\Boteco-Novo\.data\my.ini --bind-address=127.0.0.1 --port=3307` antes de iniciar o Node.

## Instalação em outro ambiente

1. Instale Node.js 22 ou superior e MariaDB (schema com InnoDB e utf8mb4).
2. Crie um banco `boteco` com `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` e usuário próprio com acesso apenas a esse banco. Copie `.env.example` para `.env` e preencha host, porta, banco, usuário e senha. Não use root no aplicativo.
3. Rode `npm ci`, `npm run migrate` e `npm run seed` em banco vazio. O seed importa o conteúdo original de `server/seed-source.html`, sem avaliações fictícias. Se já existir conteúdo, ele cancela sem sobrescrever.
4. Defina temporariamente ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) no ambiente e rode `npm run admin:create`. Retire essas três variáveis depois de criar o administrador. Repita com outro e-mail para criar mais administradores. Senhas usam scrypt com salt aleatório; sessões ficam no banco e expiram em 8 horas.
5. Rode `npm start`. Nunca envie `.env`, `.data` ou `node_modules` para um repositório.

## Hostinger e internet

A publicação efetiva depende do plano e do domínio. O servidor precisa executar Node.js continuamente e acessar MariaDB. Se o plano atual não oferecer esse suporte, use um VPS ou outro serviço com Node. Os arquivos `deploy/` incluem uma configuração para VPS Linux com Nginx + systemd; não foram executados na Hostinger.

Em VPS:

1. Instale Node, MariaDB, Nginx e Certbot. Crie usuário de sistema sem privilégios `boteco`, coloque o projeto em `/var/www/boteco` e crie `/var/lib/boteco/uploads` com permissão de escrita para esse usuário.
2. Configure o banco e execute migração/seed/criação de administrador antes de iniciar o serviço. Em atualizações, execute apenas `npm ci --omit=dev` e `npm run migrate`; não execute seed novamente.
3. Use `deploy/production.env.example` como base de `/var/www/boteco/.env`, com domínio e senha reais, permissão 600 e proprietário `boteco`. `NODE_ENV=production` ativa cookie Secure e o nome __Host-. `PUBLIC_ORIGIN` deve ser exatamente o endereço HTTPS usado no navegador, sem barra final.
4. Copie `deploy/boteco.service` para `/etc/systemd/system/`, ajuste o caminho de Node se necessário e execute `systemctl daemon-reload` e `systemctl enable --now boteco`.
5. Ajuste/habilite `deploy/nginx.conf` com o domínio real. Aponte DNS para o VPS e emita certificado com `certbot --nginx -d SEU-DOMINIO.com.br -d www.SEU-DOMINIO.com.br`; habilite redirecionamento HTTPS. Verifique `nginx -t` antes de recarregar.
6. Libere somente SSH/HTTP/HTTPS no firewall; mantenha 3000 e 3306 fechadas externamente. MariaDB deve escutar apenas no endereço privado/local. `TRUST_PROXY=1` pressupõe exatamente um proxy confiável, conforme o Nginx fornecido; ajuste se sua topologia for diferente.
7. Teste `/api/health`, `/admin/`, login, upload, envio pendente, aprovação e exibição pública usando HTTPS. Confirme persistência após reiniciar o serviço.

Se o painel disponibilizar hospedagem Node gerenciada, use `npm start`, configure as mesmas variáveis e um diretório persistente para UPLOAD_DIR. Não use disco efêmero para fotos. A API usa caminhos relativos `/api` no próprio domínio, portanto não é necessário trocar URLs localhost no JavaScript. Um site estático no GitHub Pages sozinho não executa esta API.

## Administração e armazenamento

O dashboard oferece formulários para categorias, produtos, seções, fotos, dados do estabelecimento, dias e intervalos. Os campos de referência usam o ID exibido nas listagens. Datas são gerenciadas pelo banco. Destaques usam produtos existentes. Nas fotos use o grupo `galeria` ou `instagram`. Nos dias use 0 para domingo até 6 para sábado; vincule intervalos ao ID do dia e marque a opção de dia seguinte quando necessário.

Fotos enviadas por administradores são armazenadas pelo serviço de arquivos em UPLOAD_DIR, expostas em `/uploads/`; o banco guarda somente a URL retornada. JPEG, PNG e WebP são aceitos (máximo 5 MB); SVG é recusado. Cole a URL retornada no formulário do produto/seção/foto. Faça backup tanto desse diretório quanto do banco, com teste de restauração. Em hospedagem sem disco persistente, será necessário conectar um armazenamento externo antes de usar uploads.

Avaliações públicas têm limite de 5 envios por IP/hora, campos validados, honeypot e tempo mínimo de preenchimento. Somente aprovadas aparecem; nenhuma avaliação do localStorage é importada automaticamente. O controle de spam é básico: para abuso distribuído, adicione desafio anti-bot e/ou proteção na borda. Limites de requisição em memória pressupõem uma instância Node.

## Rotas

- GET `/api/public/conteudo`: conteúdo publicado e avaliações aprovadas.
- POST `/api/public/avaliacoes`: nome_cliente, nota, comentario, website vazio e started_at em milissegundos; sempre cria pendente.
- POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/me`.
- GET/POST `/api/admin/:recurso`, PATCH/DELETE `/api/admin/:recurso/:id`: recursos categorias, produtos, secoes, fotos, estabelecimento, horarios_funcionamento e intervalos_funcionamento. Estabelecimento tem ID fixo 1 e não pode ser excluído.
- GET `/api/admin/avaliacoes`, PATCH `/api/admin/avaliacoes/:id` com status.
- POST `/api/admin-upload`: multipart, campo imagem; exige sessão.

Mutação exige Origin igual a PUBLIC_ORIGIN e sessão administrativa quando aplicável. Visitantes não podem alterar ou moderar avaliações. Segredos e fontes do servidor não são servidos. Em produção, revise os dados iniciais (preços, textos, endereço e fotos de banco de imagens) antes de divulgar.
