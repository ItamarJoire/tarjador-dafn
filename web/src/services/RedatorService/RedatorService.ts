import axios from 'axios'
import { api } from '../api'
import { AVISE_O_SUPORTE, EM_DESENVOLVIMENTO } from '../ambiente'
import type { CatalogoTipos, Lote, OpcoesLote, RetanguloProporcional, SaudeApi } from './types'

const BASE = '/api'

const urlAbsoluta = (caminho: string) => `${api.defaults.baseURL ?? ''}${caminho}`

export const RedatorService = {
  saude: async () => {
    const { data } = await api.get<SaudeApi>(`${BASE}/saude`)
    return data
  },

  /** Checklist "O que tarjar": grupos e itens, com o que vem marcado por padrão. */
  tiposDeDado: async () => {
    const { data } = await api.get<CatalogoTipos>(`${BASE}/tipos`)
    return data
  },

  criarLote: async (arquivos: File[], opcoes: OpcoesLote) => {
    const form = new FormData()
    arquivos.forEach(arquivo => form.append('arquivos', arquivo, arquivo.name))
    form.append('agressivo', String(opcoes.agressivo))
    form.append('semOcr', String(opcoes.semOcr))
    // Vai sempre, mesmo vazio: a API recusa lista vazia em vez de usar o padrão.
    form.append('tipos', opcoes.tipos.join(','))
    // A instância `api` envia JSON por padrão. Informar multipart evita que o
    // axios converta o FormData em JSON; o navegador completa o boundary.
    const { data } = await api.post<Lote>(`${BASE}/lotes`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return data
  },

  buscarLote: async (id: string) => {
    const { data } = await api.get<Lote>(`${BASE}/lotes/${id}`)
    return data
  },

  apagarLote: async (id: string) => {
    await api.delete(`${BASE}/lotes/${id}`)
  },

  urlTarjado: (idLote: string, indice: number) =>
    urlAbsoluta(`${BASE}/lotes/${idLote}/arquivos/${indice}/tarjado`),

  /**
   * Baixa o PDF tarjado inteiro para a memória e entrega ao navegador como
   * download. Só termina depois de o arquivo chegar inteiro: aí já é seguro
   * apagar o lote na API.
   */
  baixarTarjado: async (idLote: string, indice: number, nomeOriginal: string) => {
    const { data } = await api.get<Blob>(`${BASE}/lotes/${idLote}/arquivos/${indice}/tarjado`, {
      responseType: 'blob'
    })
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = `${nomeOriginal.replace(/\.pdf$/i, '')}_TARJADO.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Dá tempo de o navegador começar a gravar antes de soltar a memória
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },

  /** Imagem da página JÁ TARJADA — a API nunca devolve o original. */
  urlPagina: (idLote: string, indice: number, pagina: number, versao = 0, largura = 1100) =>
    // A versão muda a cada tarja manual: sem ela, o navegador mostraria a
    // imagem antiga, que a API manda guardar em cache por 10 minutos
    urlAbsoluta(`${BASE}/lotes/${idLote}/arquivos/${indice}/paginas/${pagina}?largura=${largura}&v=${versao}`),

  /**
   * Aplica tarjas desenhadas à mão numa página do PDF tarjado. Definitivas,
   * como as automáticas. Devolve o lote atualizado.
   */
  tarjarPagina: async (idLote: string, indice: number, pagina: number, retangulos: RetanguloProporcional[]) => {
    const { data } = await api.post<Lote>(`${BASE}/lotes/${idLote}/arquivos/${indice}/paginas/${pagina}/tarjas`, {
      retangulos
    })
    return data
  }
}

/** Traduz qualquer falha de chamada numa frase para o usuário. */
export const mensagemDeErro = (erro: unknown): string => {
  if (axios.isAxiosError(erro)) {
    const doServidor = (erro.response?.data as { erro?: string } | undefined)?.erro
    if (doServidor) return doServidor
    if (!erro.response) {
      return EM_DESENVOLVIMENTO
        ? 'A API não respondeu. Confira se ela está rodando (python api.py).'
        : `O servidor do Tarjador não respondeu. Tente de novo em alguns minutos. ${AVISE_O_SUPORTE}`
    }
    return `A API respondeu com erro ${erro.response.status}.`
  }
  return 'Erro inesperado. Tente de novo.'
}
