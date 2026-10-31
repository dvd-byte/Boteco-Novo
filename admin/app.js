const $ = (s) => document.querySelector(s);
let models, table, current;
const labels = {
  categorias: "Categorias",
  produtos: "Produtos",
  secoes: "Seções",
  fotos: "Fotos",
  avaliacoes: "Avaliações",
  estabelecimento: "Estabelecimento",
  horarios_funcionamento: "Dias de funcionamento",
  intervalos_funcionamento: "Intervalos",
};
async function api(url, options = {}) {
  const r = await fetch("/api/" + url, {
    ...options,
    headers:
      options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" },
  });
  if (r.status === 204) return null;
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Erro na operação");
  return data;
}
const message = (s) => ($("#message").textContent = s);
function button(text, fn, parent) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.onclick = () =>
    Promise.resolve()
      .then(fn)
      .catch((e) => message(e.message));
  parent.append(b);
}
async function start() {
  await api("auth/me");
  models = await api("admin/modelos");
  $("#login").hidden = true;
  $("#dashboard").hidden = false;
  $("#logout").hidden = false;
  $("#tabs").replaceChildren();
  for (const [key, label] of Object.entries(labels))
    button(label, () => load(key), $("#tabs"));
  await load("produtos");
}
async function load(key) {
  table = key;
  $("#title").textContent = labels[key];
  $("#create").hidden = key === "avaliacoes";
  const rows = await api("admin/" + key);
  $("#list").replaceChildren();
  for (const row of rows) {
    const a = document.createElement("article"),
      p = document.createElement("p");
    p.textContent = `#${row.id} · ${row.nome || row.titulo || row.nome_cliente || row.grupo || "Dia/horário " + (row.dia_semana ?? row.horario_id)}${row.status ? " · " + row.status : ""}`;
    a.append(p);
    if (key === "avaliacoes") {
      const t = document.createElement("p");
      t.textContent = `${row.nota}/5 — ${row.comentario}`;
      a.append(t);
      for (const status of ["aprovada", "rejeitada", "pendente"])
        button(
          status,
          async () => {
            await api("admin/avaliacoes/" + row.id, {
              method: "PATCH",
              body: JSON.stringify({ status }),
            });
            await load(key);
          },
          a,
        );
    } else {
      button("Editar", () => edit(row), a);
      if (key !== "estabelecimento")
        button(
          "Excluir",
          async () => {
            if (confirm("Excluir este registro?")) {
              await api(`admin/${key}/${row.id}`, { method: "DELETE" });
              await load(key);
            }
          },
          a,
        );
    }
    $("#list").append(a);
  }
}
function edit(row = {}) {
  current = row;
  $("#fields").replaceChildren();
  for (const [name, type] of Object.entries(models[table])) {
    const label = document.createElement("label");
    label.textContent = name.replaceAll("_", " ");
    let input = document.createElement(type === "long" ? "textarea" : "input");
    input.name = name;
    if (type === "bool") {
      input.type = "checkbox";
      input.checked = Boolean(row[name] ?? 1);
    } else {
      input.value = row[name] ?? (["int", "day"].includes(type) ? 0 : "");
      if (["int", "day", "id", "price"].includes(type)) {
        input.type = "number";
        input.min = 0;
        input.step = type === "price" ? "0.01" : "1";
      }
      if (type === "time") input.type = "time";
      input.required = !["optional", "url?", "long"].includes(type);
    }
    label.append(input);
    $("#fields").append(label);
  }
  $("#editor").showModal();
}
$("#create").onclick = () => edit();
$("#cancel").onclick = () => $("#editor").close();
$("#editForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const body = {};
    for (const [name, type] of Object.entries(models[table])) {
      const el = e.target.elements[name];
      body[name] =
        type === "bool"
          ? el.checked
          : ["int", "id", "day"].includes(type)
            ? Number(el.value)
            : el.value;
    }
    await api("admin/" + table + (current.id ? "/" + current.id : ""), {
      method: current.id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    });
    $("#editor").close();
    message("Registro salvo.");
    await load(table);
  } catch (e) {
    message(e.message);
    alert(e.message);
  }
};
$("#login").onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api("auth/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    e.target.reset();
    message("");
    await start();
  } catch (e) {
    message(e.message);
  }
};
$("#logout").onclick = async () => {
  try {
    await api("auth/logout", { method: "POST" });
    location.reload();
  } catch (e) {
    message(e.message);
  }
};
$("#upload").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const data = await api("admin-upload", {
      method: "POST",
      body: new FormData(e.target),
    });
    $("#uploaded").textContent = data.url;
    message("Imagem enviada. Copie a URL para o registro.");
  } catch (e) {
    message(e.message);
  }
};
start().catch(() => {});
