import type { ArquivoLote, GrupoTipos, Lote, OpcoesLote, SaudeApi } from '../../services/RedatorService'

/** Um arquivo baixado e concluído: sai dos tarjamentos e fica registrado aqui. */
export interface EntradaHistorico {
  id: string
  nome: string
  paginas: number
  tarjas: number
  /** Rótulos dos tipos de dado tarjados (ex.: 'CPF', 'E-mail'). */
  tipos: string[]
  /** Data e hora do download, em ISO. */
  concluidoEm: string
}

export interface LotesContextValue {
  /** Lotes acompanhados nesta aba, do mais antigo para o mais recente. */
  lotes: Lote[]
  /** Falha ao consultar o andamento, por id de lote. */
  errosDeConsulta: Record<string, string>
  /** Ainda buscando na API os lotes salvos na sessão (depois de um F5). */
  retomando: boolean
  saude: SaudeApi | null
  apiFora: boolean
  catalogo: GrupoTipos[] | null
  /** Os PDFs estão subindo para a API. */
  enviando: boolean
  /** Falha do último envio. */
  erroEnvio: string | null
  /** Id do lote sendo apagado/cancelado agora. */
  apagando: string | null
  /** Falha ao apagar/cancelar, por id de lote. */
  errosAoApagar: Record<string, string>
  /** Envia os PDFs como um lote novo; devolve o lote criado ou null se falhou. */
  enviar: (arquivos: File[], opcoes: OpcoesLote) => Promise<Lote | null>
  /** Apaga o lote na API; se ainda estiver processando, cancela antes. */
  apagar: (id: string) => Promise<boolean>
  /** O arquivo está num lote ainda na fila ou sendo tarjado. */
  emTarjamento: (arquivo: File) => boolean
  /** Índices dos arquivos já baixados e concluídos, por lote: não aparecem mais nos tarjamentos. */
  concluidos: Record<string, number[]>
  /**
   * Baixa o PDF tarjado. Com concluir, depois do download o arquivo sai dos
   * tarjamentos e entra no histórico; quando todos os arquivos do lote saem, o
   * lote é apagado na API. Devolve a mensagem de erro, ou null se deu certo.
   */
  baixar: (lote: Lote, arquivo: ArquivoLote, concluir: boolean) => Promise<string | null>
  /** Tarjamentos concluídos, do mais recente para o mais antigo. */
  historico: EntradaHistorico[]
  limparHistorico: () => void
}
