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

  function phaseDuration(phaseText) {
    const value = String(phaseText || "").toLocaleLowerCase("vi");
    if (/kết quả|công bố|reveal|tổng kết/.test(value)) return 25;
    if (/nhắm mắt|bí mật|đặt cược|hành động|blind/.test(value)) return 60;
    return 120;
  }
  function secondsRemaining(text) {
    const value = String(text || "").trim();
    const clock = value.match(/(\d{1,2}):(\d{2})/);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const match = value.match(/(\d{1,3})/);
    return match ? Number(match[1]) : null;
  }
  function enhanceTimer() {
    const phase = app.querySelector(".phase");
    document.body.classList.toggle("gi-gameplay", Boolean(phase));
    let timer = app.querySelector(".gi-phase-timer");
    if (!phase) {
      if (timer) timer.remove();
      return;
    }
    const countdown = app.querySelector(".countdown");
    const header = phase.closest(".flex") || phase.parentElement;
    if (!countdown || !header) {
      if (timer) timer.hidden = true;
      return;
    }
    if (!timer) {
      timer = document.createElement("div");
      timer.className = "gi-phase-timer";
      timer.setAttribute("role", "progressbar");
      timer.setAttribute("aria-label", "Thời gian còn lại của lượt");
      timer.setAttribute("aria-valuemin", "0");
      const fill = document.createElement("span");
      fill.className = "gi-phase-timer__fill";
      timer.appendChild(fill);
    }
    if (header.nextElementSibling !== timer) header.insertAdjacentElement("afterend", timer);
    const total = phaseDuration(phase.textContent);
    const remaining = secondsRemaining(countdown.textContent);
    const fill = timer.firstElementChild;
    if (remaining === null) { timer.hidden = true; return; }
    timer.hidden = false;
    const safeRemaining = Math.max(0, Math.min(total, remaining));
    const ratio = safeRemaining / total;
    const percentage = Math.max(0, Math.min(100, ratio * 100));
    timer.setAttribute("aria-valuemax", String(total));
    timer.setAttribute("aria-valuenow", String(safeRemaining));
    timer.setAttribute("aria-valuetext", safeRemaining + " giây còn lại");
    timer.title = safeRemaining + " giây còn lại";
    timer.classList.toggle("is-warning", ratio <= .30 && ratio > .15);
    timer.classList.toggle("is-urgent", ratio <= .15);
    if (!timer.dataset.initialized) {
      fill.style.transition = "none";
      fill.style.width = percentage + "%";
      timer.dataset.initialized = "1";
      window.requestAnimationFrame(() => {
        if (fill.isConnected) fill.style.transition = "width .95s linear, background .25s ease";
      });
    } else {
      fill.style.width = percentage + "%";
    }
  }

  function enhancePhasePanel() {
    const grid = app.querySelector(".grid");
    const columns = grid ? grid.querySelectorAll(":scope > .column") : [];
    const project = app.querySelector("section.project");
    if (!project || columns.length < 2) return;
    const mainCard = project.closest(".card");
    const secondary = columns[1];
    if (!mainCard || !secondary) return;
    const headings = Array.from(secondary.children).filter(node => node.tagName === "H2");
    const phaseHeading = headings.find(node => /^(THẢO LUẬN|HÀNH ĐỘNG BÍ MẬT|CÔNG BỐ|KẾT THÚC)$/.test(node.textContent.trim()));
    if (!phaseHeading || phaseHeading.closest(".gi-phase-actions")) return;
    const playerCards = Array.from(secondary.children).filter(node => node.classList?.contains("card") && node !== phaseHeading);
    const playersCard = playerCards[playerCards.length - 1];
    if (!playersCard) return;
    const emptyBefore = phaseHeading.previousElementSibling;
    if (emptyBefore && emptyBefore.tagName === "P" && emptyBefore.classList.contains("card") && !emptyBefore.textContent.trim()) emptyBefore.remove();
    const panel = document.createElement("section");
    panel.className = "card gi-phase-actions";
    let node = phaseHeading;
    while (node && node !== playersCard) {
      const nextNode = node.nextElementSibling;
      panel.appendChild(node);
      node = nextNode;
    }
    project.insertAdjacentElement("afterend", panel);
  }

  function enhance() {
    enhanceTimer();
    enhancePrivateRole();
    enhancePhasePanel();
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
      project.classList.add("gi-project-card-failed");
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
    info.className = "gi-project-accessible-copy";
    const idLabel = project.querySelector("small");
    const titleNode = project.querySelector("h2");
    const descriptionNode = Array.from(project.querySelectorAll("p")).find(node => !node.classList.contains("rule"));
    const resultNode = project.querySelector(".rule");
    [idLabel, titleNode, descriptionNode].filter(Boolean).forEach(node => info.appendChild(node));
    project.replaceChildren(card, info);
    if (resultNode) project.appendChild(resultNode);
    project.classList.add("gi-project-canva");
    project.setAttribute("aria-label", "Thẻ dự án " + title);
  }
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; enhance(); });
  }).observe(app, { childList: true, subtree: true, characterData: true });
  enhance();
})();
