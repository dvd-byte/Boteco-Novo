function metric(title, value, detail, icon) {
  return `<article class="metric"><div class="metric-top">${title}<span class="metric-icon" aria-hidden="true">${icon}</span></div><strong>${value}</strong><small>${detail}</small></article>`;
}
function heading(title, sub, action = "") {
  return `<div class="panel-heading"><div><h2>${title}</h2><p class="subtext">${sub}</p></div>${action}</div>`;
}
function empty(text) {
  return `<div class="empty">${text}</div>`;
}
function productRows(products, actions = true) {
  return products
    .map(
      (p) =>
        `<tr><td><div class="product-cell"><img src="${safeUrl(p.image)}" alt=""><div><strong>${esc(p.name)}</strong><small>${esc(state.categories.find((c) => c.id === p.category)?.name || "Sem categoria")}${p.featured ? " · ★ Destaque" : ""}</small></div></div></td><td>${money(p.price)}</td><td>${pill(p.active ? "active" : "off")}</td>${actions ? `<td><div class="actions"><button class="button secondary" data-edit-product="${esc(p.id)}">Editar</button><button class="button secondary" data-toggle-product="${esc(p.id)}">${p.active ? "Ocultar" : "Ativar"}</button><button class="button danger" data-delete-product="${esc(p.id)}">Excluir</button></div></td>` : ""}</tr>`,
    )
    .join("");
}
function productTable(products, actions = true) {
  return products.length
    ? `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Preço</th><th>Status</th>${actions ? "<th>Ações</th>" : ""}</tr></thead><tbody>${productRows(products, actions)}</tbody></table></div>`
    : empty("Nenhum produto encontrado.");
}
function numbers() {
  const approved = state.reviews.filter((r) => r.status === "aprovada"),
    pending = state.reviews.filter((r) => r.status === "pendente").length,
    average = approved.length
      ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length)
          .toFixed(1)
          .replace(".", ",")
      : "—";
  return `<section class="metrics" aria-label="Indicadores">${metric("Produtos no cardápio", state.products.length, `${state.products.filter((p) => p.active).length} ativos no site`, "☷")}${metric("Categorias", state.categories.length, "Sabores organizados por tipo", "▤")}${metric("Avaliação média", average, `${approved.length} avaliações aprovadas · de 5 estrelas`, "☆")}${metric("Aguardando aprovação", pending, "Avaliações para você conferir", "♧")}</section><div class="columns"><section class="panel">${heading("Destaques da casa", "Os produtos escolhidos para ganhar a vitrine.", '<button class="text-button" data-go="menu">Gerenciar cardápio ↗</button>')}${productTable(
    state.products.filter((p) => p.featured),
    false,
  )}</section><section class="panel">${heading("Últimas avaliações", "O que estão falando sobre o Boteco.", '<button class="text-button" data-go="reviews">Ver todas ↗</button>')}${
    state.reviews
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map(
        (r) =>
          `<div class="review-preview"><span class="avatar">${esc(r.name[0])}</span><div style="width:100%"><div class="review-meta"><strong>${esc(r.name)}</strong>${pill(r.status)}</div><p>${esc(r.comment)}</p><span class="stars" aria-label="${r.rating} de 5 estrelas">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div></div>`,
      )
      .join("") || empty("Nenhuma avaliação recebida.")
  }</section></div><div class="columns"><section class="welcome-card"><p class="eyebrow">CUIDE DE CADA DETALHE</p><h2>Seu site com a cara da casa.</h2><p>Uma boa foto e informações atualizadas ajudam seus próximos clientes a conhecer o Boteco.</p><button class="button" data-go="content">Editar apresentação ↗</button></section><section class="panel" style="margin:0">${heading("Acesso rápido", "Pequenas atualizações, tudo em dia.")}<div class="quick-links"><button class="quick-link" data-go="gallery"><span>▧</span>Atualizar fotos</button><button class="quick-link" data-go="events"><span>☆</span>Editar eventos</button><button class="quick-link" data-go="settings"><span>◷</span>Ver horários</button></div></section></div>`;
}
function chartTable(labels, values) {
  return `<details class="chart-table"><summary>Ver dados em tabela</summary><table><thead><tr><th>Indicador</th><th>Quantidade</th></tr></thead><tbody>${labels.map((l, i) => `<tr><td>${esc(l)}</td><td>${values[i]}</td></tr>`).join("")}</tbody></table></details>`;
}
function bars(labels, values, color = "") {
  const max = Math.max(...values, 1);
  return `<div class="bars">${labels.map((l, i) => `<div class="bar-row"><span>${esc(l)}</span><div class="bar-track"><div class="bar-fill" style="width:${(values[i] / max) * 100}%;${color ? `background:${color}` : ""}"></div></div><strong>${values[i]}</strong></div>`).join("")}</div>`;
}
function charts() {
  const reviews = state.reviews.filter(
      (r) => r.date >= daysAgo(period - 1) && r.date <= daysAgo(0),
    ),
    counts = state.categories.map(
      (c) =>
        state.products.filter((p) => p.category === c.id && p.active).length,
    ),
    labels = state.categories.map((c) => c.name);
  const statuses = ["aprovada", "pendente", "rejeitada"],
    statusCounts = statuses.map(
      (s) => reviews.filter((r) => r.status === s).length,
    ),
    total = reviews.length,
    a = total ? (statusCounts[0] / total) * 100 : 0,
    b = total ? ((statusCounts[0] + statusCounts[1]) / total) * 100 : 0;
  const dates = Array.from({ length: period }, (_, i) =>
      daysAgo(period - 1 - i),
    ),
    daily = dates.map((d) => reviews.filter((r) => r.date === d).length),
    max = Math.max(...daily, 1),
    points = daily
      .map(
        (v, i) => `${40 + (i / (period - 1)) * 460},${172 - (v / max) * 130}`,
      )
      .join(" ");
  return `<div class="toolbar"><p class="subtext">As análises refletem os dados do estabelecimento.</p><label>Período das avaliações <select id="period"><option value="7" ${period === 7 ? "selected" : ""}>Últimos 7 dias</option><option value="30" ${period === 30 ? "selected" : ""}>Últimos 30 dias</option></select></label></div><div class="chart-grid"><section class="panel">${heading("Produtos por categoria", "Quantidade de produtos ativos · situação atual", '<span class="chart-tag">BARRAS HORIZONTAIS</span>')}${bars(labels, counts)}<p class="chart-caption">Compare o tamanho de cada categoria do seu cardápio.</p>${chartTable(labels, counts)}</section><section class="panel">${heading("Status das avaliações", `Distribuição dos envios nos últimos ${period} dias`, '<span class="chart-tag">ROSCA</span>')}<div class="donut-layout"><div class="donut" role="img" aria-label="${statusCounts[0]} aprovadas, ${statusCounts[1]} pendentes, ${statusCounts[2]} rejeitadas" style="background:${total ? `conic-gradient(#8eb58d 0 ${a}%,var(--brand-gold) ${a}% ${b}%,#7f8977 ${b}% 100%)` : "#432515"}"><div class="donut-center"><strong>${total}</strong><small>avaliações</small></div></div><div class="legend">${["Aprovadas", "Pendentes", "Rejeitadas"].map((s, i) => `<div><i style="background:${["#8eb58d", "var(--brand-gold)", "#7f8977"][i]}"></i>${s}<b>${statusCounts[i]}</b></div>`).join("")}</div></div>${chartTable(["Aprovadas", "Pendentes", "Rejeitadas"], statusCounts)}</section><section class="panel">${heading("Avaliações ao longo do tempo", "Quantidade recebida por dia, incluindo todos os status", '<span class="chart-tag">LINHA</span>')}<svg class="line-chart" viewBox="0 0 530 205" role="img" aria-label="Evolução diária das avaliações; dados completos na tabela abaixo"><line x1="40" y1="42" x2="500" y2="42" stroke="#432515"/><line x1="40" y1="172" x2="500" y2="172" stroke="#7a2e0b"/><text x="15" y="46">${max}</text><text x="15" y="176">0</text><polygon points="40,172 ${points} 500,172" fill="#432515"/><polyline points="${points}" fill="none" stroke="var(--brand-gold)" stroke-width="2.5"/>${daily.map((v, i) => `<circle cx="${40 + (i / (period - 1)) * 460}" cy="${172 - (v / max) * 130}" r="3" fill="var(--brand-gold)"><title>${dates[i]}: ${v} avaliações</title></circle>`).join("")}<text x="40" y="197">${dates[0].slice(5).split("-").reverse().join("/")}</text><text x="470" y="197">${dates.at(-1).slice(5).split("-").reverse().join("/")}</text></svg>${chartTable(dates, daily)}</section><section class="panel">${heading("Distribuição das notas", "Notas das avaliações aprovadas no período", '<span class="chart-tag">BARRAS HORIZONTAIS</span>')}${bars(
    [5, 4, 3, 2, 1].map((n) => n + " estrelas"),
    [5, 4, 3, 2, 1].map(
      (n) =>
        reviews.filter((r) => r.status === "aprovada" && r.rating === n).length,
    ),
    "#8eb58d",
  )}<p class="chart-caption">Veja a frequência de cada nota, sem esconder a distribuição atrás da média.</p></section></div>`;
}
