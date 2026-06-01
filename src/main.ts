import '../styles/main.css'
import { renderHome } from './views/home'
import { renderMerge } from './views/merge'

const FOOTER =
  'Files are processed in your browser; nothing is uploaded to a server.'

function getRoute(): string {
  const hash = window.location.hash.slice(1).replace(/^\//, '')
  return hash || 'home'
}

async function render(): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')
  if (!app) return

  const route = getRoute()
  document.title =
    route === 'merge'
      ? 'Combine PDFs — PDF Tools'
      : route === 'md'
        ? 'Markdown to PDF — PDF Tools'
        : 'PDF Tools — susic-security.com'

  let main = app.querySelector<HTMLElement>('.container')
  if (!main) {
    app.innerHTML = ''
    main = document.createElement('div')
    main.className = 'container'
    app.appendChild(main)

    const footer = document.createElement('footer')
    footer.className = 'site-footer'
    footer.textContent = FOOTER
    app.appendChild(footer)
  }

  switch (route) {
    case 'merge':
      renderMerge(main)
      break
    case 'md': {
      const { renderMarkdown } = await import('./views/markdown')
      renderMarkdown(main)
      break
    }
    default:
      renderHome(main)
      break
  }
}

window.addEventListener('hashchange', () => {
  void render()
})
void render()
