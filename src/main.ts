import '../styles/main.css'
import { renderMerge } from './views/merge'

const FOOTER =
  'Files are processed in your browser; nothing is uploaded to a server.'

function render(): void {
  const app = document.querySelector<HTMLElement>('#app')
  if (!app) return

  document.title = 'Combine PDFs — PDF Tools'

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

  renderMerge(main)
}

window.addEventListener('hashchange', render)
render()
