/* GREEN IMPACT card-art integration; no changes to game logic or role secrecy. */
(function () {
  "use strict";
  const app = document.getElementById("app");
  if (!app || !window.MutationObserver) return;
  const scenery = document.querySelector("[data-landscape-parallax]");
  if (scenery) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, offsetX = 0, offsetY = 0;
    const resetScenery = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      scenery.removeAttribute("transform");
    };
    window.addEventListener("pointermove", event => {
      if (event.pointerType !== "mouse" || reducedMotion.matches || document.hidden || !document.getElementById("form-create")) return;
      offsetX = (event.clientX / window.innerWidth - .5) * 12;
      offsetY = (event.clientY / window.innerHeight - .5) * 6;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        scenery.setAttribute("transform", `translate(${offsetX} ${offsetY})`);
      });
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", resetScenery);
    window.addEventListener("blur", resetScenery);
    document.addEventListener("visibilitychange", () => { if (document.hidden) resetScenery(); });
    reducedMotion.addEventListener("change", resetScenery);
  }
  const cardCode = /^PROJ_(?:0[1-9]|1\d|2[0-5])$/;
  document.querySelectorAll("a[data-card-preview][data-fallback-src]").forEach(link => {
    const image = link.querySelector("img");
    const fallback = link.getAttribute("data-fallback-src");
    if (!image || !fallback) return;
    image.addEventListener("error", () => {
      if (image.getAttribute("src") === fallback) return;
      image.src = fallback;
      link.href = fallback;
    });
  });
  app.addEventListener("click", e => {
    const link = e.target.closest("a[data-card-preview]");
    if (!link) return;
    const src = link.getAttribute("href");
    if (!/^\/cards(?:-hd)?\/PROJ_(?:0[1-9]|1\d|2[0-5])\.png$/.test(src || "")) return;
    e.preventDefault();
    openCard(src, link.querySelector("img")?.alt || "Thẻ dự án");
  });
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
    const viewport = document.createElement("span");
    viewport.className = "gi-card-image-viewport";
    const picture = document.createElement("picture");
    const hdSource = document.createElement("source");
    hdSource.srcset = "/cards-hd/" + id + ".png";
    const img = document.createElement("img");
    const url = "/cards/" + id + ".png";
    img.src = url;
    img.alt = "Thẻ dự án thiết kế trên Canva: " + title;
    img.loading = "eager";
    img.decoding = "async";
    img.setAttribute("fetchpriority", "high");
    let usedOriginalFallback = false;
    img.addEventListener("error", () => {
      if (!usedOriginalFallback && img.currentSrc.includes("/cards-hd/")) {
        usedOriginalFallback = true;
        hdSource.remove();
        img.src = url;
        return;
      }
      card.classList.add("gi-card-unavailable");
      project.classList.add("gi-project-card-failed");
      button.textContent = "Không tải được hình thẻ";
      button.disabled = true;
    });
    picture.append(hdSource, img);
    viewport.appendChild(picture);
    button.appendChild(viewport);
    button.addEventListener("click", () => openCard(img.currentSrc || url, title));
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
