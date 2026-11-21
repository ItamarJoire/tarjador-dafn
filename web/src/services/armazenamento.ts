/**
 * Onde cada coisa fica guardada no navegador:
 *
 * - localStorage: preferências (tema, escolhas do checklist). Valem em qualquer
 *   aba e sobrevivem ao fechar o navegador. Nada aqui tem dado pessoal.
 * - sessionStorage: os lotes da aba. Resistem ao F5, mas somem ao fechar a
 *   aba: o id dá acesso aos PDFs tarjados e não deve reaparecer dias depois.
 *
 * O prefixo evita colisão com outros apps servidos na mesma origem.
 */
export const CHAVES = {
  tema: 'tarjador:tema',
  preferencias: 'tarjador:preferencias',
  lotes: 'tarjador:lotes',
  /** Por lote, a identificação (nome|tamanho|data) dos arquivos enviados. */
  arquivosDosLotes: 'tarjador:arquivos-dos-lotes',
  /** Por lote, os arquivos já baixados e concluídos (saem dos tarjamentos). */
  arquivosConcluidos: 'tarjador:arquivos-concluidos',
  /** Histórico de tarjamentos concluídos (localStorage: fica entre visitas). */
  historico: 'tarjador:historico',
  /** Versão anterior: um lote só. Lida uma vez e migrada para `lotes`. */
  lote: 'tarjador:lote'
} as const

type Chave = (typeof CHAVES)[keyof typeof CHAVES]

// O navegador pode recusar o acesso (modo privado, cota cheia, política da
// empresa). Guardar é conveniência: se falhar, o app segue sem lembrar.
const tentar = <T>(acao: () => T, reserva: T): T => {
  try {
    return acao()
  } catch {
    return reserva
  }
}

const criar = (area: () => Storage) => ({
  ler: (chave: Chave): string | null => tentar(() => area().getItem(chave), null),

  gravar: (chave: Chave, valor: string): void => tentar(() => area().setItem(chave, valor), undefined),

  remover: (chave: Chave): void => tentar(() => area().removeItem(chave), undefined),

  lerJson: <T>(chave: Chave): T | null =>
    tentar(() => {
      const texto = area().getItem(chave)
      return texto === null ? null : (JSON.parse(texto) as T)
    }, null),

  gravarJson: (chave: Chave, valor: unknown): void =>
    tentar(() => area().setItem(chave, JSON.stringify(valor)), undefined)
})

export const preferencias = criar(() => window.localStorage)
export const sessao = criar(() => window.sessionStorage)

/** Lê uma chave antiga (sem prefixo) uma única vez e a apaga. */
export const migrarChaveAntiga = (antiga: string): string | null =>
  tentar(() => {
    const valor = window.localStorage.getItem(antiga)
    if (valor !== null) window.localStorage.removeItem(antiga)
    return valor
  }, null)
