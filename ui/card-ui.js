/* Green Trap Detective card-art integration; no changes to game logic or role secrecy. */
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
  function bindCardPicture(picture) {
    if (!picture || picture.dataset.cardFallbackBound) return;
    const image = picture.querySelector("img");
    if (!image) return;
    picture.dataset.cardFallbackBound = "1";
    image.addEventListener("error", () => {
      const failed = image.currentSrc || image.src;
      if (failed.includes("/cards-hd-webp/")) {
        picture.dataset.cardWebpFailed = "1";
        picture.querySelector('source[type="image/webp"]')?.remove();
        const png = picture.querySelector('source[type="image/png"]');
        const fallback = png?.getAttribute("srcset") || picture.dataset.fallback;
        if (fallback && new URL(fallback, location.href).href !== image.src) image.src = fallback;
        return;
      }
      if (failed.includes("/cards-hd/")) {
        picture.querySelector('source[type="image/png"]')?.remove();
        const fallback = picture.dataset.fallback;
        if (fallback && new URL(fallback, location.href).href !== image.src) {
          image.src = fallback;
          return;
        }
      }
      const card = picture.closest(".gi-card-preview");
      if (card) {
        card.classList.add("gi-card-unavailable");
        const project = card.closest("section.project");
        if (project) project.classList.add("gi-project-card-failed");
        const button = card.querySelector("button");
        if (button) {
          button.textContent = "Không tải được hình thẻ";
          button.disabled = true;
        }
      }
    });
  }
  function bindCardPictures(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches?.("picture[data-card-image]")) bindCardPicture(root);
    root.querySelectorAll("picture[data-card-image]").forEach(bindCardPicture);
  }
  function addWebpSource(picture, id, before = null) {
    const src = window.GREEN_TRAP_WEBP_CARDS?.[id];
    if (!src || picture.dataset.cardWebpFailed || picture.querySelector('source[type="image/webp"]')) return;
    const source = document.createElement("source");
    source.type = "image/webp";
    source.srcset = src;
    if (before?.parentNode === picture) picture.insertBefore(source, before);
    else picture.prepend(source);
  }
  function enhanceExistingCardPictures(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll("picture").forEach(picture => {
      const image = picture.querySelector("img");
      const hdSource = Array.from(picture.querySelectorAll("source")).find(source =>
        /^\/cards-hd\//.test(source.getAttribute("srcset") || "")
      );
      const hdPath = hdSource?.getAttribute("srcset") || "";
      const id = hdPath.match(/^\/cards-hd\/([A-Z0-9_]+)\.png$/)?.[1];
      if (id) {
        hdSource.type = "image/png";
        addWebpSource(picture, id, hdSource);
      }
      if (image && !picture.dataset.fallback) picture.dataset.fallback = image.getAttribute("src") || "";
      picture.dataset.cardImage = "1";
      bindCardPicture(picture);
    });
  }
  function enhanceWalletIcon() {
    const image = app.querySelector('.gi-top-wallet img[src="/cards-hd/GREENCOIN.png"]');
    const webp = window.GREEN_TRAP_WEBP_CARDS?.GREENCOIN;
    if (!image || !webp || image.dataset.cardWebp) return;
    image.dataset.cardWebp = "1";
    const fallback = image.getAttribute("src");
    image.addEventListener("error", () => {
      if (image.currentSrc.includes("/cards-hd-webp/")) image.src = fallback;
    }, { once: true });
    image.src = webp;
  }
  bindCardPictures(document);
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
    const fullWrap = document.createElement("div");
    fullWrap.className = "gi-card-preview gi-card-full-wrap";
    const viewport = document.createElement("span");
    viewport.className = "gi-card-image-viewport";
    const picture = document.createElement("picture");
    const full = document.createElement("img");
    const cardPath = new URL(src, location.href).pathname;
    const cardId = cardPath.match(/(PROJ_(?:0[1-9]|1\d|2[0-5]))\.(?:png|webp)$/)?.[1];
    const hdPath = cardId ? "/cards-hd/" + cardId + ".png" : cardPath;
    const original = cardId ? "/cards/" + cardId + ".png" : cardPath.replace("/cards-hd/", "/cards/");
    picture.dataset.cardImage = "1";
    picture.dataset.fallback = original;
    addWebpSource(picture, cardId);
    const hdSource = document.createElement("source");
    hdSource.type = "image/png";
    hdSource.srcset = hdPath;
    picture.appendChild(hdSource);
    full.src = original;
    full.alt = "Hình thẻ Canva — " + title;
    picture.appendChild(full);
    bindCardPicture(picture);
    viewport.appendChild(picture);
    fullWrap.appendChild(viewport);
    dlg.append(top, fullWrap);
    dlg.addEventListener("close", () => dlg.remove(), { once: true });
    dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
    dlg.showModal();
  }
  function enhancePrivateRole() {
    app.querySelectorAll("#role, #mobile-role-value").forEach(holder => {
    if (!holder || holder.dataset.canvaRole) return;
    const code = holder.getAttribute("data-role");
    if (code !== "PROTECTOR" && code !== "SABOTEUR") return;
    const trigger = holder.id === "mobile-role-value" ? app.querySelector("#mobile-show-role") : holder.querySelector("#show-role");
    if (!trigger) return;
    holder.dataset.canvaRole = "1";
    const preview = document.createElement("div");
    preview.className = "gi-private-role-card" + (holder.id === "mobile-role-value" ? " gi-mobile-role-card" : "");
    preview.hidden = true;
    const picture = document.createElement("picture");
    picture.dataset.cardImage = "1";
    picture.dataset.fallback = "/cards/ROLE_" + code + ".png";
    addWebpSource(picture, "ROLE_" + code);
    const hdSource = document.createElement("source");
    hdSource.type = "image/png";
    hdSource.srcset = "/cards-hd/ROLE_" + code + ".png";
    const img = document.createElement("img");
    img.src = "/cards/ROLE_" + code + ".png";
    img.alt = "Thẻ vai trò riêng của bạn";
    img.loading = "lazy";
    picture.append(hdSource, img);
    bindCardPicture(picture);
    preview.appendChild(picture);
    holder.appendChild(preview);
    trigger.addEventListener("pointerdown", () => { preview.hidden = false; });
    trigger.addEventListener("pointerleave", hidePrivateRole);
    });
  }
  function hidePrivateRole() {
    app.querySelectorAll(".gi-private-role-card").forEach(preview => { preview.hidden = true; });
    const mobile = app.querySelector("#mobile-role-value");
    if (mobile) mobile.hidden = true;
  }
  document.addEventListener("pointerup", hidePrivateRole, true);
  document.addEventListener("pointercancel", hidePrivateRole, true);
  window.addEventListener("blur", hidePrivateRole);
  document.addEventListener("visibilitychange", () => { if (document.hidden) hidePrivateRole(); });

  function enhance() {
    enhanceExistingCardPictures(app);
    bindCardPictures(app);
    enhanceWalletIcon();
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
    const url = "/cards/" + id + ".png";
    picture.dataset.cardImage = "1";
    picture.dataset.fallback = url;
    const hdSource = document.createElement("source");
    hdSource.type = "image/png";
    hdSource.srcset = "/cards-hd/" + id + ".png";
    addWebpSource(picture, id, hdSource);
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Thẻ dự án thiết kế trên Canva: " + title;
    img.loading = "eager";
    img.decoding = "async";
    img.setAttribute("fetchpriority", "high");
    picture.append(hdSource, img);
    bindCardPicture(picture);
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
