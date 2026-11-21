import type { ArquivoLote, TarjaParaConferir } from '../../services/RedatorService'

export interface PaginaComPendencias {
  pagina: number
  /** Alertas da página inteira (ex.: dado que o OCR pode não ter lido). */
  alertas: string[]
  /** Tarjas aplicadas nesta página que merecem conferência. */
  tarjas: TarjaParaConferir[]
}

/** Junta alertas de página e tarjas duvidosas numa lista única, por página. */
export const agruparPorPagina = (arquivo: ArquivoLote): PaginaComPendencias[] => {
  const porPagina = new Map<number, PaginaComPendencias>()
  const obter = (pagina: number) => {
    let item = porPagina.get(pagina)
    if (!item) {
      item = { pagina, alertas: [], tarjas: [] }
      porPagina.set(pagina, item)
    }
    return item
  }

  arquivo.paginasParaConferir.forEach(p => obter(p.pagina).alertas.push(p.motivo))
  arquivo.tarjasParaConferir.forEach(t => obter(t.pagina).tarjas.push(t))

  return [...porPagina.values()].sort((a, b) => a.pagina - b.pagina)
}

const plural = (n: number, singular: string, pluralForma: string) => `${n} ${n === 1 ? singular : pluralForma}`

/** Ex.: "Página 12 · 3 tarjas para conferir · 1 alerta" */
export const tituloDaPagina = ({ pagina, alertas, tarjas }: PaginaComPendencias) => {
  const partes = [`Página ${pagina}`]
  if (tarjas.length) partes.push(plural(tarjas.length, 'tarja para conferir', 'tarjas para conferir'))
  if (alertas.length) partes.push(plural(alertas.length, 'alerta', 'alertas'))
  return partes.join(' · ')
}

/** Os motivos vêm do redator em minúscula ("a página menciona..."). */
const frase = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

export { plural, frase }
