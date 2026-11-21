export type EstadoLote = 'na_fila' | 'processando' | 'concluido'

export type EstadoArquivo = 'na_fila' | 'processando' | 'concluido' | 'erro'

/** Página em que pode ter escapado dado (ex.: cita "CPF" 5x e só 3 foram tarjados). */
export interface PaginaParaConferir {
  pagina: number
  motivo: string
}

/** Tarja aplicada com alguma dúvida (OCR incerto, CPF cortado, endereço...). */
export interface TarjaParaConferir {
  id: string
  pagina: number
  /** Rótulo legível do tipo de dado (ex.: 'CPF', 'Endereço postal'). */
  tipo: string
  /** Valor mascarado (ex.: '05*******82'). */
  valor: string
  motivo: string
}

export interface ArquivoLote {
  indice: number
  nome: string
  estado: EstadoArquivo
  paginasTotal: number
  paginasFeitas: number
  tarjasAplicadas: number
  /** Quantas das tarjas foram desenhadas à mão, na visualização da página. */
  tarjasManuais: number
  /** Muda a cada tarja manual: entra na URL da imagem da página (cache). */
  versao: number
  /** Riscos que a tarja não alcança (anexo embutido, marcador com dado pessoal). */
  avisosDoArquivo: string[]
  paginasParaConferir: PaginaParaConferir[]
  tarjasParaConferir: TarjaParaConferir[]
  erro: string | null
}

export interface Lote {
  id: string
  estado: EstadoLote
  arquivos: ArquivoLote[]
  /** Ids do checklist usados neste lote. */
  tipos: string[]
  /** Arquivos enviados que não eram PDF válido. */
  ignorados: string[]
}

/** Item do checklist "O que tarjar". */
export interface ItemTipo {
  id: string
  rotulo: string
  /** Vem marcado quando a tela abre. */
  padrao: boolean
}

export interface GrupoTipos {
  id: string
  rotulo: string
  descricao: string | null
  itens: ItemTipo[]
}

export interface CatalogoTipos {
  grupos: GrupoTipos[]
}

export interface OpcoesLote {
  /** Ids do checklist marcados pelo usuário (ao menos um). */
  tipos: string[]
  /** Scan ruim: tarja do rótulo (CPF, RG...) até o fim da linha quando nada foi lido. */
  agressivo: boolean
  /** PDF 100% digital: pula o OCR (muito mais rápido). */
  semOcr: boolean
}

export interface SaudeApi {
  ok: boolean
  versao: string
  /** null quando nenhum motor de OCR está instalado. */
  motorOcr: string | null
  /** Ausente em API anterior ao cancelamento: ela precisa ser reiniciada. */
  cancelamento?: boolean
}

/** Tarja desenhada à mão: proporções da página como aparece (0 a 1). */
export interface RetanguloProporcional {
  x0: number
  y0: number
  x1: number
  y1: number
}
