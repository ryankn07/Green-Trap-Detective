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
    const fullWrap = document.createElement("div");
    fullWrap.className = "gi-card-full-wrap";
    fullWrap.appendChild(full);
    dlg.append(top, fullWrap);
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

  function moveLayoutNode(node, target, className) {
    if (!node || !target || node === target) return;
    if (className) node.classList.add(className);
    if (node.parentElement !== target) target.appendChild(node);
  }

  function ensureLayoutSlot(grid, className) {
    let slot = Array.from(grid.children).find(node => node.classList?.contains(className));
    if (!slot) {
      slot = document.createElement("div");
      slot.className = className;
      slot.dataset.giLayoutSlot = "1";
    }
    return slot;
  }

  function orchestrateLayout() {
    const grid = app.querySelector(".grid");
    if (!grid) return;

    const project = grid.querySelector("section.project");
    const phase = grid.querySelector(".phase");
    if (!project && !phase) return;

    const cardColumn = ensureLayoutSlot(grid, "gi-col-card");
    const centerColumn = ensureLayoutSlot(grid, "gi-col-center");
    const sidebarColumn = ensureLayoutSlot(grid, "gi-col-sidebar");
    const slots = [cardColumn, centerColumn, sidebarColumn];

    slots.forEach((slot, index) => {
      const current = grid.children[index] || null;
      if (current !== slot) grid.insertBefore(slot, current);
    });

    const oldColumns = Array.from(grid.children).filter(node =>
      node.classList?.contains("column")
    );

    const projectCard = project?.closest(".card");
    const phaseCard =
      phase?.closest(".card") ||
      grid.querySelector(".gi-phase-timer")?.closest(".card") ||
      projectCard;

    const role = grid.querySelector("#role");
    const roleCard = role?.closest(".card");
    const people = grid.querySelector(".people");
    const peopleCard = people?.closest(".card");
    const form = grid.querySelector(".gi-phase-actions form") || grid.querySelector("form");
    const formCard = form?.closest(".card");
    const coinsCard = grid.querySelector(".coins")?.closest(".card");

    // Keep the phase header and timer together in the center column.
    if (phaseCard) moveLayoutNode(phaseCard, centerColumn, "gi-layout-phase-card");
    if (projectCard && projectCard !== phaseCard) {
      moveLayoutNode(projectCard, centerColumn, "gi-layout-project-shell");
    }

    // The first history block can be nested inside the project section.
    // Extract its existing wrapper before moving the Canva project card.
    const projectHistory = project?.querySelector(".hist");
    const projectDiscussion = projectHistory?.closest(".rule") || projectHistory;
    if (projectDiscussion && project.contains(projectDiscussion)) {
      moveLayoutNode(projectDiscussion, centerColumn, "gi-discussion-feed");
    }

    if (project) {
      project.classList.add("gi-project-canva");
      moveLayoutNode(project, cardColumn);
    }

    // Keep the live discussion form in the center column.
    if (formCard && ![phaseCard, projectCard, roleCard, peopleCard].includes(formCard)) {
      moveLayoutNode(formCard, centerColumn, "gi-layout-form-card");
    } else if (form && !centerColumn.contains(form)) {
      moveLayoutNode(form, centerColumn, "gi-layout-form-card");
    }

    // A separate .hist card is the turn log; keep it in the center column.
    for (const history of Array.from(grid.querySelectorAll(".hist"))) {
      const historyCard = history.closest(".card");
      if (
        historyCard &&
        ![phaseCard, projectCard, formCard, roleCard, peopleCard, coinsCard].includes(historyCard)
      ) {
        moveLayoutNode(historyCard, centerColumn, "gi-layout-history-card");
      } else if (!historyCard && !centerColumn.contains(history)) {
        const wrapper = history.closest(".rule") || history;
        moveLayoutNode(wrapper, centerColumn, "gi-discussion-feed");
      }
    }

    // Private role / wallet and the council list belong in the sidebar.
    if (roleCard) moveLayoutNode(roleCard, sidebarColumn, "gi-layout-role-card");
    else if (role && !sidebarColumn.contains(role)) moveLayoutNode(role, sidebarColumn);

    if (
      coinsCard &&
      ![roleCard, peopleCard].includes(coinsCard) &&
      !sidebarColumn.contains(coinsCard)
    ) {
      moveLayoutNode(coinsCard, sidebarColumn, "gi-layout-wallet-card");
    }

    if (peopleCard && peopleCard !== roleCard) {
      moveLayoutNode(peopleCard, sidebarColumn, "gi-layout-people-card");
    } else if (people && !sidebarColumn.contains(people)) {
      moveLayoutNode(people, sidebarColumn);
    }

    // Preserve any remaining core-rendered content instead of leaving it
    // stranded in the two legacy columns.
    for (const column of oldColumns) {
      for (const child of Array.from(column.children)) {
        const hasSidebarContent =
          child.matches?.("#role, .people, .coins") ||
          child.querySelector?.("#role, .people, .coins");
        moveLayoutNode(child, hasSidebarContent ? sidebarColumn : centerColumn);
      }
      if (!column.children.length) column.hidden = true;
    }
  }

  function enhance() {
    enhanceTimer();
    enhancePrivateRole();
    orchestrateLayout();
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
    const viewport = document.createElement("span");
    viewport.className = "gi-card-image-viewport";
    const img = document.createElement("img");
    const url = "/cards/" + id + ".png";
    img.src = url;
    img.alt = "Thẻ dự án thiết kế trên Canva: " + title;
    img.loading = "eager";
    img.decoding = "async";
    img.setAttribute("fetchpriority", "high");
    img.addEventListener("error", () => {
      card.classList.add("gi-card-unavailable");
      project.classList.add("gi-project-card-failed");
      button.textContent = "Không tải được hình thẻ";
      button.disabled = true;
    }, { once: true });
    viewport.appendChild(img);
    button.appendChild(viewport);
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
