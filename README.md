# Boteco da Vila

Site público e dashboard administrativo, com API Express, MariaDB e imagens no Cloudflare R2.

## Organização

- `index.html`: estrutura do site público.
- `assets/css/`: estilos do site.
- `assets/js/`: comportamento, integração com a API e catálogo de fallback/importação.
- `admin/`: dashboard e tela de login.
- `imagens/`: imagens locais ainda utilizadas pelo HTML/CSS e pelos dados iniciais.
- `server/`: API, autenticação, banco e armazenamento.
- `scripts/`: ferramentas de migração e manutenção.
- `tests/`: testes unitários e de integração.
- `docs/`: documentação da API, imagens e armazenamento.
- `deploy/`: exemplos opcionais para VPS; systemd/Nginx não são usados na aplicação gerenciada da Hostinger Business.
- `.data/backups/`: exportações e pacotes privados locais, ignorados pelo Git. Não publicar esses arquivos.

## Desenvolvimento

Use Node.js 22 ou superior. Configure `.env` a partir de `.env.example`, instale com `npm ci` e execute `npm start`. O servidor inicia por `server/app.js` e serve o site e `/admin/`.

O catálogo em `assets/js/cardapio-data.js` continua necessário como fallback e entrada do importador. Quando a API responde, o site utiliza os cadastros do banco.

## Hostinger e banco existente

A entrada da aplicação é `server/app.js`, com a raiz do projeto em `./`. Configure as variáveis privadas DB_*, PUBLIC_ORIGIN e STORAGE_* no painel. Em produção use NODE_ENV=production e STORAGE_PROVIDER=s3.

O banco de produção já recebeu o catálogo atualizado. Não execute seed nem importe novamente uma exportação completa sobre esse banco. Alterações de HTML/CSS/JS não exigem reimportar SQL. Publique o código por commit/push e implantação na Hostinger.

O cadastro administrativo foi adiado até receber os dados da cliente. Quando estiverem disponíveis, configure ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 12 caracteres) em ambiente privado com acesso ao banco correto e execute `npm run admin:create`. Remova ADMIN_PASSWORD após o cadastro. Não publique credenciais no Git.

Para um banco novo e isolado, `npm run migrate` cria/atualiza a estrutura e `npm run seed` adiciona dados iniciais. Esses comandos não substituem o procedimento de restauração de um banco existente.

## Validação e backups

`npm run test:unit` executa testes sem MariaDB. `npm test` inclui integração e exige banco exclusivo de testes: não executar contra produção.

`/api/health` verifica a conexão. `/api/public/conteudo` permite conferir os dados publicados. Verifique também imagens e navegação no navegador após a implantação.

Guarde cópias privadas do banco e dos objetos do R2 fora do servidor da aplicação. O backup local em `.data/` é apenas uma cópia de trabalho. O script de backup de uploads locais em `deploy/` não cobre objetos do R2.

## Documentação técnica

- [Backend e API](docs/BACKEND.md)
- [Contrato de fotografias](docs/INTEGRACAO-FOTOS.md)
- [Armazenamento e migração](docs/STORAGE.md)
- [OpenAPI](docs/openapi.json)
