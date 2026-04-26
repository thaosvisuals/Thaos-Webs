(() => {
  const body = document.body;
  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopQuery = window.matchMedia("(min-width: 901px)");
  const finePointerQuery = window.matchMedia("(pointer: fine)");
  const networkInfo = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const lowPowerDevice =
    (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4) ||
    (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4) ||
    Boolean(networkInfo && networkInfo.saveData);

  const fadeTargets = Array.from(
    document.querySelectorAll(".editorial-plate, .colophon")
  );
  fadeTargets.forEach((element) => element.classList.add("temporal-fade"));

  body.classList.add("temporal-ready");

  const setupProjectLinks = () => {
    const projectLinks = Array.from(document.querySelectorAll(".gallery-link"));

    projectLinks.forEach((link) => {
      const projectTitle = (link.dataset.projectTitle || "").trim();
      const caption = link.querySelector(".gallery-caption");

      link.dataset.linkType = "internal";
      link.removeAttribute("target");
      link.removeAttribute("rel");

      if (caption) {
        caption.textContent = "Ver proyecto";
      }

      if (projectTitle) {
        link.setAttribute("aria-label", `Abrir caso ${projectTitle}`);
      } else {
        link.setAttribute("aria-label", "Abrir caso");
      }
    });
  };

  setupProjectLinks();

  const setupGalleryTitleUnderline = () => {
    const titleFocus = document.querySelector(".gallery-title-focus");
    const gallerySection = document.querySelector(".plate-gallery");
    if (!titleFocus || !gallerySection) {
      return;
    }

    let hasPlayed = false;
    const revealUnderline = () => {
      titleFocus.classList.add("is-underlined");
    };

    if (reduceMotionQuery.matches) {
      hasPlayed = true;
      revealUnderline();
      return;
    }

    const titleObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (hasPlayed || !entry.isIntersecting) {
            return;
          }

          hasPlayed = true;
          revealUnderline();
          titleObserver.disconnect();
        });
      },
      {
        threshold: 0.28,
        rootMargin: "0px 0px -12% 0px",
      }
    );

    titleObserver.observe(gallerySection);

    const handleMotionPreferenceChange = () => {
      if (!hasPlayed && reduceMotionQuery.matches) {
        hasPlayed = true;
        revealUnderline();
        titleObserver.disconnect();
      }
    };

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener("change", handleMotionPreferenceChange);
    } else if (typeof reduceMotionQuery.addListener === "function") {
      reduceMotionQuery.addListener(handleMotionPreferenceChange);
    }
  };

  setupGalleryTitleUnderline();

  const setupGalleryCarousel = () => {
    const carousel = document.querySelector("[data-gallery-carousel]");
    if (!carousel) {
      return;
    }

    const viewport = carousel.querySelector("[data-gallery-viewport]");
    const track = carousel.querySelector(".gallery-grid");
    const prevButton = carousel.querySelector("[data-gallery-prev]");
    const nextButton = carousel.querySelector("[data-gallery-next]");
    const panels = Array.from(track ? track.querySelectorAll(".gallery-item") : []);

    if (!viewport || !track || !prevButton || !nextButton || panels.length <= 1) {
      return;
    }

    let currentIndex = 0;
    let metrics = {
      stride: 0,
      visibleCount: 1,
      maxIndex: 0,
      snapPoints: [0],
    };

    const getGap = () => {
      const computed = window.getComputedStyle(track);
      const gapValue = computed.columnGap || computed.gap || "0";
      const parsed = Number.parseFloat(gapValue);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const computeMetrics = () => {
      const panelWidth = panels[0].getBoundingClientRect().width;
      const gap = getGap();
      const stride = panelWidth + gap;
      const viewportWidth = viewport.getBoundingClientRect().width;
      const visibleCount =
        stride > 0 ? Math.max(1, Math.round((viewportWidth + gap) / stride)) : 1;
      const maxIndex = Math.max(0, panels.length - visibleCount);
      const snapPoints = [];

      for (let index = 0; index <= maxIndex; index += visibleCount) {
        snapPoints.push(index);
      }

      if (snapPoints[snapPoints.length - 1] !== maxIndex) {
        snapPoints.push(maxIndex);
      }

      return { stride, visibleCount, maxIndex, snapPoints };
    };

    const syncControls = () => {
      const firstPoint = metrics.snapPoints[0] || 0;
      const lastPoint = metrics.snapPoints[metrics.snapPoints.length - 1] || 0;
      prevButton.disabled = currentIndex <= firstPoint;
      nextButton.disabled = currentIndex >= lastPoint;
    };

    const syncActivePanels = () => {
      const activeIndex = currentIndex;
      const secondaryIndex =
        metrics.visibleCount > 1 ? Math.min(currentIndex + 1, panels.length - 1) : -1;

      panels.forEach((panel, index) => {
        const isActive = index === activeIndex;
        const isSecondary = index === secondaryIndex && !isActive;
        panel.classList.toggle("is-active", isActive);
        panel.classList.toggle("is-secondary", isSecondary);
      });
    };

    const applyPosition = () => {
      const shift = metrics.stride * currentIndex;
      track.style.transform = `translate3d(${-shift}px, 0, 0)`;
      syncControls();
      syncActivePanels();
    };

    const snapIndexToPage = () => {
      const previousOrEqualPoints = metrics.snapPoints.filter((point) => point <= currentIndex);
      currentIndex = previousOrEqualPoints.length
        ? previousOrEqualPoints[previousOrEqualPoints.length - 1]
        : metrics.snapPoints[0];
      currentIndex = Math.max(0, Math.min(currentIndex, metrics.maxIndex));
    };

    const move = (direction) => {
      const points = metrics.snapPoints;

      if (direction > 0) {
        const nextPoint = points.find((point) => point > currentIndex);
        currentIndex = typeof nextPoint === "number" ? nextPoint : points[points.length - 1];
      } else {
        let previousPoint = points[0];
        for (let index = points.length - 1; index >= 0; index -= 1) {
          if (points[index] < currentIndex) {
            previousPoint = points[index];
            break;
          }
        }
        currentIndex = previousPoint;
      }
      applyPosition();
    };

    const refresh = () => {
      metrics = computeMetrics();
      snapIndexToPage();
      applyPosition();
    };

    prevButton.addEventListener("click", () => move(-1));
    nextButton.addEventListener("click", () => move(1));

    carousel.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    });

    let resizeRaf = 0;
    window.addEventListener(
      "resize",
      () => {
        if (resizeRaf) {
          window.cancelAnimationFrame(resizeRaf);
        }
        resizeRaf = window.requestAnimationFrame(refresh);
      },
      { passive: true }
    );

    refresh();
  };

  setupGalleryCarousel();

  const setupFaqAccordion = () => {
    const faqItems = Array.from(document.querySelectorAll("[data-faq-item]"));
    if (!faqItems.length) {
      return;
    }

    const isReducedMotion = () => reduceMotionQuery.matches;

    const syncClosedState = (item, trigger, panel) => {
      item.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      panel.hidden = true;
      panel.style.height = "0px";
      panel.style.opacity = "0";
      panel.style.transform = "translate3d(0, -6px, 0)";
    };

    const openItem = (item, trigger, panel, instant = false) => {
      item.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      panel.hidden = false;

      if (instant || isReducedMotion()) {
        panel.style.height = "auto";
        panel.style.opacity = "1";
        panel.style.transform = "translate3d(0, 0, 0)";
        return;
      }

      panel.style.height = "0px";
      panel.style.opacity = "0";
      panel.style.transform = "translate3d(0, -6px, 0)";
      const targetHeight = panel.scrollHeight;

      window.requestAnimationFrame(() => {
        panel.style.height = `${targetHeight}px`;
        panel.style.opacity = "1";
        panel.style.transform = "translate3d(0, 0, 0)";
      });

      const onOpenEnd = (event) => {
        if (event.propertyName !== "height") {
          return;
        }
        if (item.classList.contains("is-open")) {
          panel.style.height = "auto";
        }
        panel.removeEventListener("transitionend", onOpenEnd);
      };

      panel.addEventListener("transitionend", onOpenEnd);
    };

    const closeItem = (item, trigger, panel, instant = false) => {
      item.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");

      if (panel.hidden) {
        panel.style.height = "0px";
        panel.style.opacity = "0";
        panel.style.transform = "translate3d(0, -6px, 0)";
        return;
      }

      if (instant || isReducedMotion()) {
        panel.hidden = true;
        panel.style.height = "0px";
        panel.style.opacity = "0";
        panel.style.transform = "translate3d(0, -6px, 0)";
        return;
      }

      const currentHeight = panel.scrollHeight;
      panel.style.height = `${currentHeight}px`;
      panel.style.opacity = "1";
      panel.style.transform = "translate3d(0, 0, 0)";

      window.requestAnimationFrame(() => {
        panel.style.height = "0px";
        panel.style.opacity = "0";
        panel.style.transform = "translate3d(0, -6px, 0)";
      });

      const onCloseEnd = (event) => {
        if (event.propertyName !== "height") {
          return;
        }
        if (!item.classList.contains("is-open")) {
          panel.hidden = true;
        }
        panel.removeEventListener("transitionend", onCloseEnd);
      };

      panel.addEventListener("transitionend", onCloseEnd);
    };

    const itemRefs = faqItems
      .map((item) => {
        const trigger = item.querySelector("[data-faq-trigger]");
        const panel = item.querySelector("[data-faq-panel]");
        if (!trigger || !panel) {
          return null;
        }
        return { item, trigger, panel };
      })
      .filter(Boolean);

    itemRefs.forEach(({ item, trigger, panel }) => {
      syncClosedState(item, trigger, panel);

      trigger.addEventListener("click", () => {
        const alreadyOpen = item.classList.contains("is-open");

        itemRefs.forEach((ref) => {
          if (ref.item !== item) {
            closeItem(ref.item, ref.trigger, ref.panel);
          }
        });

        if (alreadyOpen) {
          closeItem(item, trigger, panel);
        } else {
          openItem(item, trigger, panel);
        }
      });
    });

    const handleMotionPreferenceChange = () => {
      itemRefs.forEach(({ item, trigger, panel }) => {
        if (item.classList.contains("is-open")) {
          openItem(item, trigger, panel, true);
        } else {
          closeItem(item, trigger, panel, true);
        }
      });
    };

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener("change", handleMotionPreferenceChange);
    } else if (typeof reduceMotionQuery.addListener === "function") {
      reduceMotionQuery.addListener(handleMotionPreferenceChange);
    }
  };

  setupFaqAccordion();

  const setupSecondaryEmailCopy = () => {
    const secondaryEmailButton = document.querySelector("[data-copy-email]");
    if (!secondaryEmailButton) {
      return;
    }

    const copyValue = (secondaryEmailButton.dataset.copyEmail || "").trim();
    if (!copyValue) {
      return;
    }

    let feedbackTimeout = 0;

    const setCopiedState = () => {
      secondaryEmailButton.classList.add("is-copied");
      secondaryEmailButton.setAttribute("aria-label", `Correo copiado: ${copyValue}`);

      if (feedbackTimeout) {
        window.clearTimeout(feedbackTimeout);
      }

      feedbackTimeout = window.setTimeout(() => {
        secondaryEmailButton.classList.remove("is-copied");
        secondaryEmailButton.setAttribute(
          "aria-label",
          `Copiar correo de la marca ${copyValue}`
        );
      }, 1450);
    };

    const copyWithFallback = () => {
      const helperField = document.createElement("textarea");
      helperField.value = copyValue;
      helperField.setAttribute("readonly", "");
      helperField.style.position = "fixed";
      helperField.style.opacity = "0";
      helperField.style.pointerEvents = "none";
      document.body.append(helperField);
      helperField.focus();
      helperField.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (error) {
        copied = false;
      }
      helperField.remove();
      return copied;
    };

    secondaryEmailButton.addEventListener("click", async () => {
      let copied = false;

      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(copyValue);
          copied = true;
        } catch (error) {
          copied = copyWithFallback();
        }
      } else {
        copied = copyWithFallback();
      }

      if (copied) {
        setCopiedState();
      }
    });
  };

  setupSecondaryEmailCopy();

  const setupScrollProgress = () => {
    const progressBar = document.querySelector("[data-scroll-progress]");
    if (!progressBar) {
      return;
    }

    let progressRaf = 0;

    const updateProgress = () => {
      progressRaf = 0;
      const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollRange > 0 ? window.scrollY / scrollRange : 0;
      const normalized = Math.max(0, Math.min(1, progress));
      progressBar.style.transform = `scaleX(${normalized.toFixed(4)})`;
    };

    const requestProgressUpdate = () => {
      if (!progressRaf) {
        progressRaf = window.requestAnimationFrame(updateProgress);
      }
    };

    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    window.addEventListener("resize", requestProgressUpdate, { passive: true });
    requestProgressUpdate();
  };

  setupScrollProgress();

  const setupSubtleCursor = () => {
    const cursor = document.querySelector("[data-subtle-cursor]");
    if (!cursor) {
      return;
    }

    let isEnabled = false;
    let cursorRaf = 0;
    let currentX = -28;
    let currentY = -28;
    let targetX = -28;
    let targetY = -28;

    const interactiveSelector = "a, button, [data-faq-trigger], .gallery-item";

    const shouldEnableCursor = () =>
      !reduceMotionQuery.matches &&
      desktopQuery.matches &&
      finePointerQuery.matches &&
      !lowPowerDevice;

    const requestCursorFrame = () => {
      if (!cursorRaf) {
        cursorRaf = window.requestAnimationFrame(renderCursor);
      }
    };

    const renderCursor = () => {
      cursorRaf = 0;

      currentX += (targetX - currentX) * 0.28;
      currentY += (targetY - currentY) * 0.28;

      cursor.style.setProperty("--cursor-x", `${(currentX - 5).toFixed(2)}px`);
      cursor.style.setProperty("--cursor-y", `${(currentY - 5).toFixed(2)}px`);

      if (Math.abs(targetX - currentX) > 0.08 || Math.abs(targetY - currentY) > 0.08) {
        requestCursorFrame();
      }
    };

    const handleCursorMove = (event) => {
      if (!isEnabled) {
        return;
      }

      targetX = event.clientX;
      targetY = event.clientY;
      body.classList.remove("cursor-hidden");
      requestCursorFrame();
    };

    const handleCursorLeave = () => {
      if (!isEnabled) {
        return;
      }

      body.classList.add("cursor-hidden");
      cursor.classList.remove("is-target");
      targetX = -28;
      targetY = -28;
      requestCursorFrame();
    };

    const handleCursorOver = (event) => {
      if (!isEnabled) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const isTargetInteractive = Boolean(target && target.closest(interactiveSelector));
      cursor.classList.toggle("is-target", isTargetInteractive);
    };

    const disableCursor = () => {
      isEnabled = false;
      body.classList.remove("cursor-ready");
      body.classList.add("cursor-hidden");
      cursor.classList.remove("is-target");
    };

    const enableCursor = () => {
      isEnabled = true;
      body.classList.add("cursor-ready");
      body.classList.add("cursor-hidden");
    };

    const syncCursorMode = () => {
      if (shouldEnableCursor()) {
        enableCursor();
      } else {
        disableCursor();
      }
    };

    const addQueryListener = (query, listener) => {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", listener);
      } else if (typeof query.addListener === "function") {
        query.addListener(listener);
      }
    };

    document.addEventListener("mousemove", handleCursorMove, { passive: true });
    document.addEventListener("mouseover", handleCursorOver, { passive: true });
    document.addEventListener("mouseleave", handleCursorLeave, { passive: true });
    window.addEventListener("blur", handleCursorLeave, { passive: true });

    addQueryListener(reduceMotionQuery, syncCursorMode);
    addQueryListener(desktopQuery, syncCursorMode);
    addQueryListener(finePointerQuery, syncCursorMode);

    syncCursorMode();
  };

  setupSubtleCursor();

  const setupHeroManifestoCardInteraction = () => {
    const heroPlate = document.querySelector(".plate-image-hero");
    const manifestoCard = heroPlate ? heroPlate.querySelector(".plate-image-caption") : null;
    if (!heroPlate || !manifestoCard) {
      return;
    }

    const maxRotate = 2.6;
    const maxScale = 1.007;
    const baseDepth = -1.05;
    const touchTiltMax = 0.92;
    let pointerX = 0;
    let pointerY = 0;
    let isPointerInside = false;
    let interactionRaf = 0;
    let rippleTimeout = 0;
    let touchResetTimeout = 0;
    let lastTouchPulseAt = 0;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const applyInteraction = () => {
      interactionRaf = 0;

      const rotateX = -pointerY * maxRotate;
      const rotateY = pointerX * maxRotate;
      const pointerDistance = Math.min(1, Math.hypot(pointerX, pointerY));
      const depth = isPointerInside ? baseDepth - pointerDistance * 0.45 : 0;
      const scale = isPointerInside
        ? 1 + (maxScale - 1) * (0.72 + pointerDistance * 0.28)
        : 1;

      manifestoCard.style.setProperty("--hero-card-rot-x", `${rotateX.toFixed(2)}deg`);
      manifestoCard.style.setProperty("--hero-card-rot-y", `${rotateY.toFixed(2)}deg`);
      manifestoCard.style.setProperty("--hero-card-depth", `${depth.toFixed(2)}px`);
      manifestoCard.style.setProperty("--hero-card-scale", scale.toFixed(3));
    };

    const requestInteractionFrame = () => {
      if (!interactionRaf) {
        interactionRaf = window.requestAnimationFrame(applyInteraction);
      }
    };

    const resetInteraction = () => {
      isPointerInside = false;
      pointerX = 0;
      pointerY = 0;
      heroPlate.classList.remove("is-card-active");
      requestInteractionFrame();
    };

    const handleMouseEnter = () => {
      if (reduceMotionQuery.matches) {
        return;
      }
      isPointerInside = true;
      heroPlate.classList.add("is-card-active");
      requestInteractionFrame();
    };

    const handleMouseMove = (event) => {
      if (reduceMotionQuery.matches) {
        return;
      }

      const bounds = manifestoCard.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        return;
      }

      const relativeX = (event.clientX - bounds.left) / bounds.width;
      const relativeY = (event.clientY - bounds.top) / bounds.height;

      pointerX = clamp((relativeX - 0.5) * 2, -1, 1);
      pointerY = clamp((relativeY - 0.5) * 2, -1, 1);
      requestInteractionFrame();
    };

    const handleMouseLeave = () => {
      resetInteraction();
    };

    const triggerCardPulse = (clientX, clientY, isTouchMode) => {
      const bounds = manifestoCard.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) {
        return;
      }

      const rippleX = ((clientX - bounds.left) / bounds.width) * 100;
      const rippleY = ((clientY - bounds.top) / bounds.height) * 100;

      manifestoCard.style.setProperty("--hero-card-ripple-x", `${rippleX.toFixed(2)}%`);
      manifestoCard.style.setProperty("--hero-card-ripple-y", `${rippleY.toFixed(2)}%`);

      if (isTouchMode) {
        const normalizedX = clamp((rippleX - 50) / 50, -1, 1);
        const normalizedY = clamp((rippleY - 50) / 50, -1, 1);
        const tiltX = clamp(-normalizedY * touchTiltMax, -touchTiltMax, touchTiltMax);
        const tiltY = clamp(normalizedX * touchTiltMax, -touchTiltMax, touchTiltMax);

        heroPlate.classList.add("is-card-touch-active");
        manifestoCard.style.setProperty("--hero-card-touch-tilt-x", `${tiltX.toFixed(2)}deg`);
        manifestoCard.style.setProperty("--hero-card-touch-tilt-y", `${tiltY.toFixed(2)}deg`);

        if (touchResetTimeout) {
          window.clearTimeout(touchResetTimeout);
        }

        touchResetTimeout = window.setTimeout(() => {
          heroPlate.classList.remove("is-card-touch-active");
          manifestoCard.style.setProperty("--hero-card-touch-tilt-x", "0deg");
          manifestoCard.style.setProperty("--hero-card-touch-tilt-y", "0deg");
        }, 340);
      }

      manifestoCard.classList.remove("is-ripple-active");
      window.requestAnimationFrame(() => {
        manifestoCard.classList.add("is-ripple-active");
      });

      if (rippleTimeout) {
        window.clearTimeout(rippleTimeout);
      }
      rippleTimeout = window.setTimeout(() => {
        manifestoCard.classList.remove("is-ripple-active");
      }, 480);
    };

    const handleCardClick = (event) => {
      if (reduceMotionQuery.matches) {
        return;
      }

      const isTouchMode = !finePointerQuery.matches || !desktopQuery.matches;
      if (isTouchMode && performance.now() - lastTouchPulseAt < 420) {
        return;
      }

      triggerCardPulse(event.clientX, event.clientY, isTouchMode);
    };

    const handleTouchStart = (event) => {
      if (reduceMotionQuery.matches) {
        return;
      }

      const touchPoint = event.touches && event.touches[0];
      if (!touchPoint) {
        return;
      }

      lastTouchPulseAt = performance.now();
      triggerCardPulse(touchPoint.clientX, touchPoint.clientY, true);
    };

    manifestoCard.addEventListener("mouseenter", handleMouseEnter);
    manifestoCard.addEventListener("mousemove", handleMouseMove);
    manifestoCard.addEventListener("mouseleave", handleMouseLeave);
    manifestoCard.addEventListener("touchstart", handleTouchStart, { passive: true });
    manifestoCard.addEventListener("click", handleCardClick);
    heroPlate.addEventListener("mouseleave", handleMouseLeave);

    const handleMotionPreferenceChange = () => {
      if (reduceMotionQuery.matches) {
        resetInteraction();
        heroPlate.classList.remove("is-card-touch-active");
        manifestoCard.classList.remove("is-ripple-active");
        manifestoCard.style.setProperty("--hero-card-touch-tilt-x", "0deg");
        manifestoCard.style.setProperty("--hero-card-touch-tilt-y", "0deg");

        if (touchResetTimeout) {
          window.clearTimeout(touchResetTimeout);
          touchResetTimeout = 0;
        }
      }
    };

    if (typeof reduceMotionQuery.addEventListener === "function") {
      reduceMotionQuery.addEventListener("change", handleMotionPreferenceChange);
    } else if (typeof reduceMotionQuery.addListener === "function") {
      reduceMotionQuery.addListener(handleMotionPreferenceChange);
    }
  };

  setupHeroManifestoCardInteraction();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    {
      threshold: 0.18,
      rootMargin: "-8% 0% -8% 0%",
    }
  );
  fadeTargets.forEach((element) => observer.observe(element));

  if (reduceMotionQuery.matches) {
    fadeTargets.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const parallaxTargets = [];
  const visibleParallaxTargets = new Set();
  const parallaxMap = [
    [".script-accent", -0.016],
    [".plate-image", -0.01],
  ];

  parallaxMap.forEach(([selector, speed]) => {
    document.querySelectorAll(selector).forEach((element) => {
      parallaxTargets.push({ element, speed });
    });
  });
  const parallaxByElement = new Map(parallaxTargets.map((target) => [target.element, target]));

  const shouldEnableParallax = () =>
    !reduceMotionQuery.matches && desktopQuery.matches && finePointerQuery.matches && !lowPowerDevice;

  let rafId = 0;
  let parallaxObserver = null;
  let isParallaxEnabled = false;
  const maxShift = 16;
  let latestScroll = window.scrollY;

  const updateParallax = () => {
    rafId = 0;

    if (!isParallaxEnabled) {
      return;
    }

    visibleParallaxTargets.forEach(({ element, speed }) => {
      const shift = Math.max(-maxShift, Math.min(maxShift, latestScroll * speed));
      element.style.setProperty("--parallax-shift", `${shift.toFixed(2)}px`);
    });
  };

  const requestParallax = () => {
    latestScroll = window.scrollY;
    if (!rafId) {
      rafId = window.requestAnimationFrame(updateParallax);
    }
  };

  const resetParallaxStyles = () => {
    parallaxTargets.forEach(({ element }) => {
      element.style.removeProperty("--parallax-shift");
    });
  };

  const disableParallax = () => {
    if (!isParallaxEnabled) {
      return;
    }

    isParallaxEnabled = false;
    visibleParallaxTargets.clear();
    window.removeEventListener("scroll", requestParallax);
    window.removeEventListener("resize", requestParallax);

    if (parallaxObserver) {
      parallaxObserver.disconnect();
      parallaxObserver = null;
    }

    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    resetParallaxStyles();
  };

  const enableParallax = () => {
    if (isParallaxEnabled || !parallaxTargets.length) {
      return;
    }

    isParallaxEnabled = true;
    parallaxObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = parallaxByElement.get(entry.target);
          if (!target) {
            return;
          }

          if (entry.isIntersecting) {
            visibleParallaxTargets.add(target);
          } else {
            visibleParallaxTargets.delete(target);
          }
        });

        requestParallax();
      },
      {
        rootMargin: "20% 0% 20% 0%",
        threshold: 0,
      }
    );

    parallaxTargets.forEach(({ element }) => {
      parallaxObserver.observe(element);
    });

    window.addEventListener("scroll", requestParallax, { passive: true });
    window.addEventListener("resize", requestParallax, { passive: true });
    requestParallax();
  };

  const syncParallaxMode = () => {
    if (shouldEnableParallax()) {
      enableParallax();
    } else {
      disableParallax();
    }
  };

  const addMediaQueryListener = (query, listener) => {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", listener);
      return;
    }

    if (typeof query.addListener === "function") {
      query.addListener(listener);
    }
  };

  addMediaQueryListener(reduceMotionQuery, syncParallaxMode);
  addMediaQueryListener(desktopQuery, syncParallaxMode);
  addMediaQueryListener(finePointerQuery, syncParallaxMode);
  syncParallaxMode();
})();
