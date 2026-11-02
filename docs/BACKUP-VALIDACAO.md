# Validação operacional de backups — 02/11/2026

O script deploy/backup.sh agora aceita BACKUP_CNF, verifica os caminhos de entrada, usa nome de execução com PID e valida gzip, tar e SHA256 antes de publicar o diretório final. Não elimina backups antigos automaticamente.

Ensaio executado: node scripts/verify-local-backup.js. Usa Git Bash e MariaDB locais no Windows, somente quando a conexão aponta para a instância isolada 127.0.0.1:3307 e existe .data/my.ini. Usa a conta root sem senha SOMENTE dessa instância de desenvolvimento previamente criada; não é configuração para produção. Não versiona arquivo de credenciais, remove-o ao terminar e não usa senha na linha de comando. Em outro ambiente esse ensaio precisa ser adaptado pelo operador.

Resultado: backup.sh executado; checksums SHA256 verificados; dump restaurado numa base temporária de nome aleatório criada exclusivamente pelo ensaio; contagens das 10 tabelas comparadas com a origem; arquivo de upload de teste recuperado e conteúdo conferido. A base temporária foi removida, preservando o banco original. Dumps locais permanecem em .data/restore-drill-* (ignorado pelo Git), com dados sensíveis de teste; não compartilhar. Houve uma primeira falha na leitura do marcador binário '*' do sha256sum no Windows; corrigida e ensaio repetido com sucesso.

Limites: é um ensaio local, não comprova o ambiente Linux da Hostinger, cópia externa, disparo do timer, nem recuperação de todas as imagens existentes. O arquivo de upload usado foi uma fixture isolada. Em produção validar permissões, TLS, espaço livre, restaurabilidade e monitoramento de falhas.

Configuração no VPS pelo operador:
- Instalar mariadb-client, gzip, tar, coreutils e bash; scripts shell devem ter finais de linha LF.
- Criar /etc/boteco/backup.cnf, proprietário root e modo 600, seção [client] com host/user/password e parâmetros de TLS conforme o banco.
- Instalar boteco-backup.service e boteco-backup.timer em /etc/systemd/system/; configurar DB_NAME/UPLOAD_DIR/BACKUP_DIR/BACKUP_CNF na unidade ou drop-in, sem senha nas variáveis do serviço.
- Executar manualmente systemctl start boteco-backup.service; inspecionar journalctl -u boteco-backup.service e restaurar em banco e pasta vazios.
- Depois de validado e autorizado: systemctl daemon-reload; systemctl enable --now boteco-backup.timer; conferir systemctl list-timers. 03h usa o fuso do servidor.
- Planejar retenção: 7 diários, 4 semanais e 12 mensais, ajustável ao espaço e orçamento. Só eliminar cópias vencidas após verificar a cópia externa e manter ao menos uma restauração validada. Rotação automática ainda não foi ativada.
- Copiar para destino externo criptografado com credencial própria e acesso restrito; destino e orçamento ainda dependem do responsável. Não contratamos serviço.

Restauração: verificar sha256sum -c SHA256SUMS, importar gunzip -c database.sql.gz | mariadb --defaults-extra-file=ARQUIVO BANCO_VAZIO, extrair uploads.tar.gz em pasta vazia, configurar a aplicação para esse banco/pasta e validar saúde, login, conteúdo e download. Não importar sobre produção durante ensaios. O dump usa --single-transaction (InnoDB); suspender mudanças administrativas e DDL durante a janela para coerência entre dump e arquivos. Os dois não são snapshot atômico.

Publicação permanece bloqueada por acesso/configuração da Hostinger, domínio, HTTPS, banco definitivo e caminho persistente de uploads. O endpoint /api/health já verifica a conexão MariaDB. Não há necessidade de novas tabelas para estas correções.
