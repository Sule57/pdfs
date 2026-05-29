export function renderHome(container: HTMLElement): void {
  container.innerHTML = `
    <header class="site-header">
      <a href="#/" class="site-logo">PDF <span>Tools</span></a>
    </header>
    <h1 class="page-title">Document utilities</h1>
    <p class="page-subtitle">Convert Word files to PDF or merge multiple PDFs — privately in your browser.</p>
    <div class="action-grid">
      <button type="button" class="glass-card action-card" data-route="convert">
        <div class="action-icon" aria-hidden="true">W</div>
        <h2>Word to PDF</h2>
        <p>Upload one or more .doc / .docx files and download PDFs.</p>
      </button>
      <button type="button" class="glass-card action-card" data-route="merge">
        <div class="action-icon" aria-hidden="true">+</div>
        <h2>Combine PDFs</h2>
        <p>Upload PDFs, set the order, and download one merged file.</p>
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
