(function () {
  if (window.GuidedTour) return;

  const STYLE_ID = "guided-tour-shared-style";
  const STORAGE_PREFIX = "panelamcham.guidedtour.v2";
  const CARD_MAX_WIDTH = 360;
  const CARD_MIN_HEIGHT = 224;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const normalizeKey = (value) =>
    String(value || "GENERAL")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "");

  const toSelectorList = (selector) => {
    if (!selector) return [];
    if (Array.isArray(selector)) return selector.filter(Boolean);
    return [selector];
  };

  const resolveTarget = (selector) => {
    const selectors = toSelectorList(selector);
    for (let i = 0; i < selectors.length; i += 1) {
      const current = selectors[i];
      if (typeof current === "string") {
        const found = document.querySelector(current);
        if (found) return found;
      } else if (current && current.nodeType === 1) {
        return current;
      }
    }
    return null;
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .guided-tour-root {
        position: fixed;
        inset: 0;
        z-index: 5200;
        pointer-events: auto;
      }
      .guided-tour-root[hidden] {
        display: none !important;
      }
      .guided-tour-spotlight {
        position: fixed;
        border-radius: 14px;
        border: 2px solid rgba(255, 255, 255, 0.96);
        box-shadow: 0 0 0 9999px rgba(15, 24, 43, 0.62);
        background: transparent;
        transition: top 0.22s ease, left 0.22s ease, width 0.22s ease, height 0.22s ease, opacity 0.2s ease;
        pointer-events: none;
      }
      .guided-tour-card {
        position: fixed;
        background: #ffffff;
        border-radius: 16px;
        border: 1px solid rgba(47, 84, 150, 0.2);
        box-shadow: 0 18px 48px rgba(10, 24, 54, 0.28);
        padding: 1rem 1.1rem;
        color: #1f3b6b;
        pointer-events: auto;
      }
      .guided-tour-step {
        margin: 0;
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(47, 84, 150, 0.78);
        font-weight: 700;
      }
      .guided-tour-title {
        margin: 0.35rem 0 0.3rem;
        font-size: 1.05rem;
        font-weight: 800;
        color: #2f5496;
        line-height: 1.24;
      }
      .guided-tour-description {
        margin: 0;
        font-size: 0.92rem;
        line-height: 1.45;
        color: rgba(47, 84, 150, 0.88);
      }
      .guided-tour-tip {
        margin: 0.6rem 0 0;
        font-size: 0.82rem;
        color: rgba(47, 84, 150, 0.7);
      }
      .guided-tour-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
        margin-top: 0.95rem;
      }
      .guided-tour-btn-link {
        border: none;
        background: transparent;
        color: #2f5496;
        font-weight: 700;
        font-size: 0.84rem;
        padding: 0;
      }
      .guided-tour-btn-link:hover,
      .guided-tour-btn-link:focus {
        text-decoration: underline;
      }
      .guided-tour-btn {
        border-radius: 10px;
        font-weight: 700;
        border: 1px solid rgba(47, 84, 150, 0.3);
        background: #fff;
        color: #2f5496;
        padding: 0.3rem 0.75rem;
      }
      .guided-tour-btn:hover,
      .guided-tour-btn:focus {
        border-color: #2f5496;
      }
      .guided-tour-btn-primary {
        background: #2f5496;
        border-color: #2f5496;
        color: #fff;
      }
      .guided-tour-btn-primary:hover,
      .guided-tour-btn-primary:focus {
        background: #1f3b6b;
        border-color: #1f3b6b;
      }
      .guided-tour-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .guided-tour-trigger {
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 5100;
        border: none;
        border-radius: 999px;
        padding: 10px 14px;
        background: #2f5496;
        color: #fff;
        font-weight: 700;
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
      }
      .guided-tour-trigger:hover,
      .guided-tour-trigger:focus {
        transform: translateY(-1px);
        background: #1f3b6b;
      }
      .guided-tour-trigger.right {
        left: auto;
        right: 16px;
      }
      @media (max-width: 640px) {
        .guided-tour-card {
          padding: 0.9rem;
        }
        .guided-tour-actions {
          flex-wrap: wrap;
        }
        .guided-tour-trigger {
          left: 12px;
          bottom: 12px;
          padding: 9px 12px;
          font-size: 0.88rem;
        }
        .guided-tour-trigger.right {
          right: 12px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const buildStorageKey = (id, userResolver, storageScope) => {
    const user =
      storageScope === "global"
        ? "GLOBAL"
        : normalizeKey(
            typeof userResolver === "function" ? userResolver() : userResolver
          );
    return `${STORAGE_PREFIX}.${normalizeKey(id)}.${user || "GENERAL"}`;
  };

  const readStorage = (key) => {
    if (!key) return null;
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (_) {
      return null;
    }
  };

  const writeStorage = (key, status) => {
    if (!key) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          status,
          date: new Date().toISOString(),
        })
      );
    } catch (_) {}
  };

  const getCardPosition = (rect) => {
    const width = Math.min(CARD_MAX_WIDTH, window.innerWidth - 24);
    if (!rect) {
      return {
        top: clamp(
          window.innerHeight / 2 - CARD_MIN_HEIGHT / 2,
          12,
          window.innerHeight - CARD_MIN_HEIGHT - 12
        ),
        left: clamp(window.innerWidth / 2 - width / 2, 12, window.innerWidth - width - 12),
        width,
      };
    }
    const preferBottom = rect.top + rect.height + 16;
    const preferTop = rect.top - CARD_MIN_HEIGHT - 16;
    const top =
      preferBottom + CARD_MIN_HEIGHT <= window.innerHeight - 12
        ? preferBottom
        : preferTop;
    return {
      top: clamp(top, 12, window.innerHeight - CARD_MIN_HEIGHT - 12),
      left: clamp(rect.left, 12, window.innerWidth - width - 12),
      width,
    };
  };

  const getHighlightRect = (element, stepPadding) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    const padding = Number.isFinite(stepPadding) ? stepPadding : 8;
    return {
      top: Math.max(8, rect.top - padding),
      left: Math.max(8, rect.left - padding),
      width: Math.max(36, rect.width + padding * 2),
      height: Math.max(36, rect.height + padding * 2),
    };
  };

  const mount = (rawConfig = {}) => {
    ensureStyles();

    const config = {
      id: "guided-tour",
      buttonText: "Tour guiado",
      triggerPosition: "left",
      showTrigger: true,
      autoStart: true,
      showOnce: true,
      startDelay: 850,
      storageScope: "user",
      userResolver: () =>
        window.Sesion?.obtener?.()?.usuario?.usuario ||
        window.__APP_SESSION__?.usuario?.usuario ||
        "GENERAL",
      ...rawConfig,
    };

    const steps = Array.isArray(config.steps) ? config.steps.filter(Boolean) : [];
    if (!steps.length) {
      return {
        start: () => {},
        reset: () => {},
        destroy: () => {},
      };
    }

    const storageKey = buildStorageKey(
      config.id,
      config.userResolver,
      config.storageScope
    );

    const root = document.createElement("div");
    root.className = "guided-tour-root";
    root.hidden = true;
    root.innerHTML = `
      <div class="guided-tour-spotlight"></div>
      <section class="guided-tour-card" role="dialog" aria-modal="true" aria-label="Tutorial guiado">
        <p class="guided-tour-step"></p>
        <h3 class="guided-tour-title"></h3>
        <p class="guided-tour-description"></p>
        <p class="guided-tour-tip" hidden></p>
        <div class="guided-tour-actions">
          <button type="button" class="guided-tour-btn-link" data-action="close">Salir</button>
          <div class="d-flex gap-2">
            <button type="button" class="guided-tour-btn" data-action="prev">Atras</button>
            <button type="button" class="guided-tour-btn guided-tour-btn-primary" data-action="next">Siguiente</button>
          </div>
        </div>
      </section>
    `;
    document.body.appendChild(root);

    const spotlight = root.querySelector(".guided-tour-spotlight");
    const card = root.querySelector(".guided-tour-card");
    const stepLabel = root.querySelector(".guided-tour-step");
    const title = root.querySelector(".guided-tour-title");
    const description = root.querySelector(".guided-tour-description");
    const tip = root.querySelector(".guided-tour-tip");
    const prevBtn = root.querySelector('[data-action="prev"]');
    const nextBtn = root.querySelector('[data-action="next"]');
    const closeBtn = root.querySelector('[data-action="close"]');

    let triggerBtn = null;
    if (config.showTrigger !== false) {
      triggerBtn = document.createElement("button");
      triggerBtn.type = "button";
      triggerBtn.className = `guided-tour-trigger${
        String(config.triggerPosition || "").toLowerCase() === "right"
          ? " right"
          : ""
      }`;
      triggerBtn.textContent = config.buttonText || "Tour guiado";
      triggerBtn.addEventListener("click", () => api.start(true));
      document.body.appendChild(triggerBtn);
    }

    const state = {
      active: false,
      index: 0,
    };

    const hasSeen = () => {
      if (!config.showOnce) return false;
      const value = readStorage(storageKey);
      return Boolean(value?.status);
    };

    const recordState = (status) => {
      if (!config.showOnce) return;
      writeStorage(storageKey, status);
    };

    const resolveStepTarget = (step) => resolveTarget(step.selector);

    const waitFor = (selector, timeoutMs = 1200) =>
      new Promise((resolve) => {
        const startedAt = Date.now();
        const check = () => {
          const found = resolveTarget(selector);
          if (found) {
            resolve(found);
            return;
          }
          if (Date.now() - startedAt >= timeoutMs) {
            resolve(null);
            return;
          }
          window.setTimeout(check, 90);
        };
        check();
      });

    const api = {
      start(force = false) {
        if (state.active) return;
        if (!force && hasSeen()) return;
        state.active = true;
        state.index = 0;
        root.hidden = false;
        goTo(0);
      },
      next() {
        if (!state.active) return;
        if (state.index >= steps.length - 1) {
          api.finish();
          return;
        }
        goTo(state.index + 1);
      },
      prev() {
        if (!state.active) return;
        goTo(Math.max(state.index - 1, 0));
      },
      finish() {
        if (!state.active) return;
        state.active = false;
        root.hidden = true;
        recordState("completed");
      },
      close() {
        if (!state.active) return;
        state.active = false;
        root.hidden = true;
        recordState("dismissed");
      },
      reset() {
        try {
          localStorage.removeItem(storageKey);
        } catch (_) {}
      },
      destroy() {
        state.active = false;
        if (triggerBtn && triggerBtn.parentElement) triggerBtn.remove();
        if (root.parentElement) root.remove();
        window.removeEventListener("resize", handleReposition);
        window.removeEventListener("scroll", handleReposition, true);
        document.removeEventListener("keydown", handleKeys);
      },
      isActive() {
        return state.active;
      },
      find(selector) {
        return resolveTarget(selector);
      },
      click(selector) {
        const target = resolveTarget(selector);
        if (!target) return false;
        target.click();
        return true;
      },
      waitFor,
    };

    const runBeforeEnter = async (step) => {
      if (typeof step?.beforeEnter !== "function") return;
      try {
        await Promise.resolve(step.beforeEnter({ api, step, index: state.index }));
      } catch (error) {
        console.warn("[GuidedTour] beforeEnter error:", error);
      }
    };

    const updateStepUI = () => {
      const step = steps[state.index];
      if (!step) return;
      const target = resolveStepTarget(step);
      const rect = getHighlightRect(target, step.padding);
      const cardPosition = getCardPosition(rect);

      stepLabel.textContent = `Paso ${state.index + 1} de ${steps.length}`;
      title.textContent = step.title || "Paso";
      description.textContent = step.description || "";
      if (step.tip) {
        tip.hidden = false;
        tip.textContent = step.tip;
      } else {
        tip.hidden = true;
        tip.textContent = "";
      }

      if (rect) {
        spotlight.style.opacity = "1";
        spotlight.style.top = `${rect.top}px`;
        spotlight.style.left = `${rect.left}px`;
        spotlight.style.width = `${rect.width}px`;
        spotlight.style.height = `${rect.height}px`;
      } else {
        spotlight.style.opacity = "0";
        spotlight.style.top = "0px";
        spotlight.style.left = "0px";
        spotlight.style.width = "0px";
        spotlight.style.height = "0px";
      }

      card.style.top = `${cardPosition.top}px`;
      card.style.left = `${cardPosition.left}px`;
      card.style.width = `${cardPosition.width}px`;

      prevBtn.disabled = state.index === 0;
      nextBtn.textContent = state.index >= steps.length - 1 ? "Finalizar" : "Siguiente";
    };

    const goTo = async (index) => {
      if (!state.active) return;
      state.index = clamp(index, 0, steps.length - 1);
      const step = steps[state.index];
      await runBeforeEnter(step);
      const target = resolveStepTarget(step);
      if (target && step.scrollIntoView !== false) {
        try {
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "center",
          });
        } catch (_) {
          try {
            target.scrollIntoView();
          } catch (_) {}
        }
      }
      window.requestAnimationFrame(updateStepUI);
      window.setTimeout(updateStepUI, 240);
    };

    const handleReposition = () => {
      if (!state.active) return;
      window.requestAnimationFrame(updateStepUI);
    };

    const handleKeys = (event) => {
      if (!state.active) return;
      if (event.key === "Escape") {
        event.preventDefault();
        api.close();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        api.prev();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        api.next();
      }
    };

    prevBtn.addEventListener("click", () => api.prev());
    nextBtn.addEventListener("click", () => api.next());
    closeBtn.addEventListener("click", () => api.close());
    root.addEventListener("click", (event) => {
      if (event.target === root) {
        api.close();
      }
    });

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    document.addEventListener("keydown", handleKeys);

    if (config.autoStart !== false && !hasSeen()) {
      const delay = Number.isFinite(config.startDelay) ? config.startDelay : 0;
      window.setTimeout(() => api.start(false), Math.max(0, delay));
    }

    return api;
  };

  window.GuidedTour = {
    mount,
  };
})();
