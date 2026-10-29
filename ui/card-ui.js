/* GREEN IMPACT card-art integration; no changes to game logic or role secrecy. */
(function () {
  "use strict";
  const app = document.getElementById("app");
  if (!app || !window.MutationObserver) return;
  const cardCode = /^PROJ_(?:0[1-9]|1\d|2[0-5])$/;
  function openCard(src, title) {
    const dlg = document.createElement("dialog");
    dlg.className = "gi-card-dialog";
    dlg.setAttribute("aria-label", "Xem thẻ dự án: " + title);
    const top = document.createElement("div");
    top.className = "gi-card-dialog-top";
    const label = document.createElement("strong");
    label.textContent = title;
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Đóng ✕";
    close.addEventListener("click", () => dlg.close());
    top.append(label, close);
    const full = document.createElement("img");
    full.src = src;
    full.alt = "Hình thẻ Canva — " + title;
    full.className = "gi-card-full";
    dlg.append(top, full);
    dlg.addEventListener("close", () => dlg.remove(), { once: true });
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
    dlg.showModal();
  }
  function enhancePrivateRole() {
    const holder = app.querySelector("#role");
    if (!holder || holder.dataset.canvaRole) return;
    const code = holder.getAttribute("data-role");
    if (code !== "PROTECTOR" && code !== "SABOTEUR") return;
    const trigger = holder.querySelector("#show-role");
    if (!trigger) return;
    holder.dataset.canvaRole = "1";
    const preview = document.createElement("div");
    preview.className = "gi-private-role-card";
    preview.hidden = true;
    const img = document.createElement("img");
    img.src = "/cards/ROLE_" + code + ".png";
    img.alt = "Thẻ vai trò riêng của bạn";
    img.loading = "lazy";
    preview.appendChild(img);
    holder.appendChild(preview);
    trigger.addEventListener("pointerdown", () => { preview.hidden = false; });
  }
  function hidePrivateRole() {
    const preview = app.querySelector(".gi-private-role-card");
    if (preview) preview.hidden = true;
  }
  document.addEventListener("pointerup", hidePrivateRole, true);
  document.addEventListener("pointercancel", hidePrivateRole, true);
  window.addEventListener("blur", hidePrivateRole);
  function enhance() {
    enhancePrivateRole();
    const project = app.querySelector("section.project");
    if (!project || project.dataset.canvaCard) return;
    const raw = project.querySelector("small")?.textContent || "";
    const id = raw.match(/PROJ_\d{2}/)?.[0];
    if (!id || !cardCode.test(id)) return;
    project.dataset.canvaCard = "1";
    const title = project.querySelector("h2")?.textContent || id;
    const card = document.createElement("div");
    card.className = "gi-card-preview";
    const button = document.createElement("button");
    button.className = "gi-card-button";
    button.type = "button";
    button.title = "Nhấn để xem thẻ Canva phóng to";
    button.setAttribute("aria-label", "Phóng to thẻ " + title);
    const img = document.createElement("img");
    const url = "/cards/" + id + ".png";
    img.src = url;
    img.alt = "Thẻ dự án thiết kế trên Canva: " + title;
    img.loading = "eager";
    img.decoding = "async";
    img.addEventListener("error", () => {
      card.classList.add("gi-card-unavailable");
      button.textContent = "Không tải được hình thẻ";
      button.disabled = true;
    }, { once: true });
    const hint = document.createElement("span");
    hint.className = "gi-card-zoom-hint";
    hint.textContent = "Xem thẻ lớn  ⤢";
    button.append(img, hint);
    button.addEventListener("click", () => openCard(url, title));
    card.appendChild(button);
    const info = document.createElement("div");
    info.className = "gi-card-details";
    while (project.firstChild) info.appendChild(project.firstChild);
    project.append(card, info);
    project.classList.add("gi-project-canva");
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; enhance(); });
  }).observe(app, { childList: true, subtree: true });
  enhance();
})();
