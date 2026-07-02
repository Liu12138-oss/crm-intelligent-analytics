document.addEventListener('DOMContentLoaded', () => {
  const shell = document.querySelector('.demo-shell');
  const toggle = document.querySelector('[data-nav-toggle]');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (toggle && shell) {
    toggle.addEventListener('click', () => {
      const collapsed = shell.classList.toggle('demo-shell--collapsed');
      toggle.setAttribute('aria-pressed', String(collapsed));
      toggle.setAttribute('title', collapsed ? '展开导航' : '收起导航');
      toggle.textContent = collapsed ? '展开' : '收起';
    });
  }

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || prefersReducedMotion) {
      return;
    }

    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      document.body.classList.add('is-leaving');
      window.setTimeout(() => {
        window.location.href = href;
      }, 160);
    });
  });

  document.querySelectorAll('[data-loading-label]').forEach((button) => {
    button.addEventListener('click', () => {
      const element = button;
      const loadingLabel = element.getAttribute('data-loading-label');
      const originalLabel = element.textContent;

      if (!loadingLabel || !originalLabel || element.classList.contains('is-loading')) {
        return;
      }

      element.classList.add('is-loading');
      element.setAttribute('aria-busy', 'true');
      element.dataset.originalLabel = originalLabel;
      element.textContent = loadingLabel;

      window.setTimeout(() => {
        element.classList.remove('is-loading');
        element.setAttribute('aria-busy', 'false');
        element.textContent = element.dataset.originalLabel ?? originalLabel;
      }, 1200);
    });
  });
});
