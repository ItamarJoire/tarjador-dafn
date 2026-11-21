import type { GrupoTipos, SaudeApi } from '../../../services/RedatorService'

/** Tela "Tarjar documentos": envio, opções e o que tarjar. */
export interface PainelEnvioProps {
  /** Os PDFs estão subindo para a API. */
  enviando: boolean
  /** Mensagem de falha da última chamada à API. */
  erro: string | null
  saude: SaudeApi | null
  apiFora: boolean
  /** Checklist "O que tarjar"; null enquanto carrega ou se a API estiver fora. */
  catalogo: GrupoTipos[] | null
  /** Ids do checklist marcados. */
  tipos: string[]
  onTiposChange: (ids: string[]) => void
  agressivo: boolean
  onAgressivoChange: (ligado: boolean) => void
  semOcr: boolean
  onSemOcrChange: (ligado: boolean) => void
  /** Devolve true se o lote foi criado: a seleção de arquivos é limpa. */
  onEnviar: (arquivos: File[]) => Promise<boolean>
  /** O arquivo já está num lote na fila ou sendo tarjado: não entra na seleção. */
  emTarjamento?: (arquivo: File) => boolean
}
