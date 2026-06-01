export function renderHome(container: HTMLElement): void {
  container.innerHTML = `
    <header class="site-header">
      <span class="site-logo">PDF <span>Tools</span></span>
    </header>
    <h1 class="page-title">Document utilities</h1>
    <p class="page-subtitle">Combine PDFs or convert Markdown to PDF — all in your browser, nothing uploaded.</p>
    <div class="action-grid">
      <button type="button" class="glass-card action-card" data-route="merge">
        <div class="action-icon" aria-hidden="true">+</div>
        <h2>Combine PDFs</h2>
        <p>Upload PDFs, set the order, and download one merged file.</p>
      </button>
      <button type="button" class="glass-card action-card" data-route="md">
        <div class="action-icon" aria-hidden="true">M↓</div>
        <h2>Markdown to PDF</h2>
        <p>Paste or upload Markdown, preview live, then download as PDF.</p>
      </button>
    </div>
  `

  container.querySelectorAll('[data-route]').forEach((el) => {
    el.addEventListener('click', () => {
      const route = (el as HTMLElement).dataset.route
      if (route) {
        window.location.hash = `#/${route}`
      }
    })
  })
}
