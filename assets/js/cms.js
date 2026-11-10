(async () => {
  const escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const $ = (s) => document.querySelector(s),
    price = (v) =>
      Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.id = "reviewStatus";
  $("#reviewForm").after(status);
  let rating = 0,
    started = Date.now();
  const trap = document.createElement("input");
  trap.name = "website";
  trap.hidden = true;
  trap.tabIndex = -1;
  trap.autocomplete = "off";
  $("#reviewForm").append(trap);
  document.querySelectorAll(".review-star").forEach((star) =>
    star.addEventListener("click", () => {
      rating = Number(star.dataset.rating);
      document.querySelectorAll(".review-star").forEach((s, i) => {
        s.querySelector("i").className =
          i < rating ? "fas fa-star" : "far fa-star";
        s.setAttribute("aria-pressed", String(i < rating));
      });
    }),
  );
  $("#reviewForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const button =
      e.target.querySelector("[type=submit]") ||
      e.target.querySelector("button:last-child");
    if (button) button.disabled = true;
    try {
      const r = await fetch("/api/public/avaliacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_cliente: $("#reviewName").value,
          nota: rating,
          comentario: $("#reviewComment").value,
          website: trap.value,
          started_at: started,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      status.textContent = data.message;
      e.target.reset();
      rating = 0;
      started = Date.now();
      document
        .querySelectorAll(".review-star i")
        .forEach((i) => (i.className = "far fa-star"));
    } catch (err) {
      status.textContent =
        err.message || "Não foi possível enviar a avaliação.";
    } finally {
      if (button) button.disabled = false;
    }
  });
  $("#reviewTrack").replaceChildren();
  try {
    const r = await fetch("/api/public/conteudo");
    if (!r.ok) throw Error();
    const data = await r.json();
    window.updateBotecoMenu(data);
    for (const s of data.secoes) {
      const section = document.getElementById(
        { inicio: "home", o_boteco: "about", eventos: "events" }[s.chave] || s.chave,
      );
      if (!section) continue;
      for (const [selector, value] of [
        ["h1,h2", s.titulo],
        [".sec-sub,.hero-badge", s.subtitulo],
        [
          ".sec-desc,.hero-desc,.about-text>p:not(.sec-sub):not(.about-sign),.events-text>p:not(.sec-sub)",
          s.descricao,
        ],
      ]) {
        const el = section.querySelector(selector);
        if (el) {
          el.textContent = value || "";
          if (selector === "h1,h2" && s.chave === "inicio") {
            const parts = (value || "").match(/[^.!?]+[.!?]?/g) || [];
            if (parts.length === 3) {
              el.replaceChildren(document.createTextNode(parts[0].trim()));
              const span = document.createElement("span");
              span.textContent = parts[1].trim();
              el.append(span, document.createTextNode(parts[2].trim()));
            }
          }
        }
      }
      if (s.imagem_url) {
        if (s.chave === "inicio") {
          // This release uses the approved local hero rather than the older database image.
          section.style.backgroundImage = 'url("/images/heronova2.jpg")';
        }
        else {
          const img = section.querySelector(".about-img img,.events-img img");
          if (img) {
            img.src = s.imagem_url;
            img.alt = s.imagem_alt || "";
          }
        }
      }
      const btn = section.querySelector(".hero-btns a,.events-text>a");
      if (btn && s.botao_texto && s.botao_url) {
        btn.textContent = s.botao_texto;
        btn.href = s.botao_url;
      }
    }
    for (const group of ["galeria", "instagram"]) {
      const grid = $(group === "galeria" ? ".gallery-grid" : ".insta-grid");
      grid.replaceChildren();
      for (const f of data.fotos.filter((x) => x.grupo === group)) {
        const el = document.createElement(
          group === "instagram" ? "a" : "button",
        );
        el.className = group === "galeria" ? "gallery-item" : "insta-item";
        const img = document.createElement("img");
        img.src = f.imagem_url;
        img.alt = f.texto_alternativo;
        img.loading = "lazy";
        el.append(img);
        if (group === "instagram") {
          el.href = f.link_url || data.estabelecimento?.instagram_url || "#";
          el.target = "_blank";
          el.rel = "noopener";
        } else {
          el.type = "button";
          el.setAttribute("aria-label", f.legenda || "Ampliar fotografia");
          el.onclick = () => {
            $("#lightboxImage").src = f.imagem_url;
            $("#lightboxImage").alt = f.texto_alternativo;
            $("#lightbox").classList.add("open");
            $("#lightbox").setAttribute("aria-hidden", "false");
            document.body.classList.add("lightbox-open");
            $("#lightboxClose").focus();
          };
        }
        grid.append(el);
      }
    }
    $("#reviewTrack").innerHTML = data.avaliacoes.length
      ? data.avaliacoes
          .map(
            (a) =>
              `<article class="review-card"><div class="review-card-stars">${"★".repeat(a.nota)}</div><blockquote>${escape(a.comentario)}</blockquote><cite>${escape(a.nome_cliente)}</cite></article>`,
          )
          .join("")
      : '<p class="review-empty">Seja o primeiro a avaliar.</p>';
    let index = 0;
    if (data.avaliacoes.length > 1)
      setInterval(() => {
        index = (index + 1) % data.avaliacoes.length;
        $("#reviewTrack").style.transform = `translateX(-${index * 100}%)`;
      }, 5000);
    const info = data.estabelecimento;
    if (info) {
      document.querySelectorAll(".logo-image").forEach((i) => {
        if (!i.classList.contains("logo-full") && !i.classList.contains("logo-compact")) i.src = info.logo_url;
        i.alt = info.nome;
      });
      document
        .querySelectorAll('a[href*="wa.me"]')
        .forEach(
          (a) => {
            const number = a.hasAttribute('data-whatsapp-secondary') ? info.whatsapp_secundario : info.whatsapp;
            a.hidden = !number;
            if(number) a.href = 'https://wa.me/' + number.replace(/\D/g,'');
          },
        );
      document
        .querySelectorAll('a[href*="instagram.com"]')
        .forEach((a) => (a.href = info.instagram_url));
      document
        .querySelectorAll('a[href*="maps.app"],.directions-link')
        .forEach((a) => (a.href = info.maps_url));
      $(".loc-map iframe").src = info.maps_embed_url;
      const details = document.querySelectorAll(".loc-detail");
      const values = [
        `${info.endereco}, ${info.numero}${info.complemento ? " · " + info.complemento : ""} — ${info.bairro}, ${info.cidade} / ${info.estado} ${info.cep}`,
        "Fale conosco pelo WhatsApp",
      ];
      details.forEach((el, i) => {
        const p = el.querySelector("p");
        if (p && i === 0) p.textContent = values[i];
        if (p && i === 1) {
          const contact = document.createElement("a");
          contact.textContent = "Fale conosco pelo WhatsApp";
          const number = (info.whatsapp || info.whatsapp_secundario || "").replace(/\D/g, "");
          if (number) { contact.href = "https://wa.me/" + number; contact.target = "_blank"; contact.rel = "noopener"; }
          p.replaceChildren(contact);
        }
      });
      document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
        a.href = "tel:" + info.telefone;
        a.textContent = "Ligue para o Boteco";
      });
      document
        .querySelectorAll(".logo-text")
        .forEach((el) => (el.textContent = info.nome));
      document.title = `${info.nome}${info.cidade ? ` em ${info.cidade}` : ""} | Cardápio e Petiscos`;
      const address = document.querySelector('.footer-col a[href="#location"]');
      if (address) address.textContent = info.endereco + ", " + info.numero;
      document
        .querySelectorAll('.footer-col a[href*="wa.me"]')
        .forEach((el) => (el.textContent = "Fale conosco pelo WhatsApp"));
      document.querySelector(".footer-bottom p").textContent =
        "© " +
        new Date().getFullYear() +
        " " +
        info.nome +
        ". Todos os direitos reservados.";
      $(".footer-brand>p").textContent = info.descricao;
      const structured = document.querySelector(
        'script[type="application/ld+json"]',
      );
      if (structured) {
        const json = JSON.parse(structured.textContent);
        json.name = info.nome;
        json.description = info.descricao;
        json.telephone = info.telefone;
        json.image = new URL("/imagens/logonova.png", window.location.origin).href;
        json.address = {
          ...json.address,
          streetAddress: info.endereco + ", " + info.numero,
          addressLocality: info.cidade,
          addressRegion: info.estado,
        };
        delete json.aggregateRating;
        json.openingHoursSpecification = data.horarios
          .filter((h) => !h.fechado)
          .flatMap((h) =>
            h.intervalos.map((i) => ({
              "@type": "OpeningHoursSpecification",
              dayOfWeek: [
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ][h.dia_semana],
              opens: i.abertura.slice(0, 5),
              closes: i.fechamento.slice(0, 5),
            })),
          );
        structured.textContent = JSON.stringify(json);
      }
    }
    const details = document.querySelectorAll(".loc-detail");
    if (details[2])
      details[2].querySelector("p").textContent =
        "Consulte os horários por dia abaixo.";
    if (details[3]) {
      const p = details[3].querySelector("p");
      p.textContent = data.avaliacoes.length
        ? (
            data.avaliacoes.reduce((sum, a) => sum + a.nota, 0) /
            data.avaliacoes.length
          ).toFixed(1) +
          " de 5 · " +
          data.avaliacoes.length +
          " avaliações publicadas"
        : "Ainda não há avaliações publicadas.";
    }
    document.querySelectorAll(".footer-col").forEach((col) => {
      if (/horário/i.test(col.querySelector("h4")?.textContent || "")) {
        col.querySelector("ul")?.replaceChildren();
        const a = document.createElement("a");
        a.href = "#hours";
        a.textContent = "Consultar horários atualizados";
        col.append(a);
      }
    });
    const days = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    // Keep the three original cards (including icons and scroll reveal).
    const groups = [[2, 3, 4, 5], [6], [0, 1]];
    const formatHours = (day) => {
      const schedule = data.horarios.find((h) => Number(h.dia_semana) === day);
      if (!schedule) return "Horário não informado";
      if (schedule.fechado) return "Sem atendimento da cozinha";
      return schedule.intervalos.map((i) =>
        `${i.abertura.slice(0, 5)} às ${i.fechamento.slice(0, 5)}${i.encerra_no_dia_seguinte ? " (dia seguinte)" : ""}`
      ).join(" / ") || "Horário não informado";
    };
    document.querySelectorAll(".hours-grid .hour-card").forEach((card, index) => {
      const group = groups[index];
      if (!group) return;
      const times = group.map(formatHours);
      const target = card.querySelector(".hour-time");
      target.replaceChildren();
      const lines = times.every((time) => time === times[0])
        ? [times[0]]
        : group.map((day, i) => `${days[day]}: ${times[i]}`);
      lines.forEach((line, i) => {
        if (i) target.append(document.createElement("br"));
        target.append(document.createTextNode(line));
      });
    });
  } catch {
    status.textContent =
      "Serviço temporariamente indisponível. Tente novamente mais tarde.";
  }
})();
