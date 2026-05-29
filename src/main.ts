import '../styles/main.css'
import { renderHome } from './views/home'
import { renderConvert } from './views/convert'
import { renderMerge } from './views/merge'

const FOOTER =
  'Files are processed in your browser; nothing is uploaded to a server.'

function getRoute(): string {
  const hash = window.location.hash.slice(1).replace(/^\//, '')
  return hash || 'home'
}

function render(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (!app) return

  const route = getRoute()
  document.title =
    route === 'convert'
      ? 'Word to PDF — PDF Tools'
      : route === 'merge'
        ? 'Combine PDFs — PDF Tools'
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
    case 'convert':
      renderConvert(main)
      break
    case 'merge':
      renderMerge(main)
      break
    default:
      renderHome(main)
      break
  }
}

window.addEventListener('hashchange', render)
render()
