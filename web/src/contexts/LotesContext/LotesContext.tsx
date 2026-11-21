import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import axios from 'axios'
import { CHAVES, RedatorService, mensagemDeErro, preferencias, sessao } from '../../services'
import type { ArquivoLote, GrupoTipos, Lote, OpcoesLote, SaudeApi } from '../../services/RedatorService'
import { fileKey } from '../../ui/Upload'
import { LotesContext } from './context'
import type { EntradaHistorico } from './types'

const INTERVALO_MS = 1000

const naoEncontrado = (falha: unknown) => axios.isAxiosError(falha) && falha.response?.status === 404
const conflito = (falha: unknown) => axios.isAxiosError(falha) && falha.response?.status === 409

// Ids dos lotes desta aba no sessionStorage: resistem ao F5 e somem ao fechar
// a aba. Gravados só ao criar ou apagar (nunca a partir do estado), para uma
// API fora do ar durante a retomada não apagar a lista.
const idsSalvos = (): string[] => {
  const ids = sessao.lerJson<unknown>(CHAVES.lotes)
  const lista = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  // Versão anterior guardava um lote só, em outra chave.
  const antigo = sessao.ler(CHAVES.lote)
  if (antigo !== null) {
    sessao.remover(CHAVES.lote)
    if (!lista.includes(antigo)) lista.push(antigo)
    sessao.gravarJson(CHAVES.lotes, lista)
  }
  return lista
}

const salvarId = (id: string) => {
  const ids = idsSalvos()
  if (!ids.includes(id)) sessao.gravarJson(CHAVES.lotes, [...ids, id])
}

const esquecerId = (id: string) => sessao.gravarJson(CHAVES.lotes, idsSalvos().filter(salvo => salvo !== id))

// Identificação dos arquivos de cada lote (nome|tamanho|data), também na sessão:
// é o que diz, depois de um F5, se um arquivo escolhido já está sendo tarjado.
type ArquivosDosLotes = Record<string, string[]>

const arquivosSalvos = (): ArquivosDosLotes => {
  const salvos = sessao.lerJson<unknown>(CHAVES.arquivosDosLotes)
  if (!salvos || typeof salvos !== 'object' || Array.isArray(salvos)) return {}
  return Object.fromEntries(
    Object.entries(salvos).filter(
      (par): par is [string, string[]] => Array.isArray(par[1]) && par[1].every(c => typeof c === 'string')
    )
  )
}

// Arquivos já baixados e concluídos, por lote (sessão, como os lotes).
const concluidosSalvos = (): Record<string, number[]> => {
  const salvos = sessao.lerJson<unknown>(CHAVES.arquivosConcluidos)
  if (!salvos || typeof salvos !== 'object' || Array.isArray(salvos)) return {}
  return Object.fromEntries(
    Object.entries(salvos).filter(
      (par): par is [string, number[]] => Array.isArray(par[1]) && par[1].every(i => typeof i === 'number')
    )
  )
}

// Histórico de tarjamentos concluídos: localStorage, fica entre visitas até a
// pessoa limpar. Guarda só nome, contagens, tipos e data; nenhum conteúdo.
const MAXIMO_NO_HISTORICO = 500

const historicoSalvo = (): EntradaHistorico[] => {
  const salvo = preferencias.lerJson<unknown>(CHAVES.historico)
  if (!Array.isArray(salvo)) return []
  return salvo.filter(
    (e): e is EntradaHistorico =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as EntradaHistorico).id === 'string' &&
      typeof (e as EntradaHistorico).nome === 'string' &&
      typeof (e as EntradaHistorico).concluidoEm === 'string'
  )
}

const semChave = <T,>(registro: Record<string, T>, chave: string) => {
  if (!(chave in registro)) return registro
  const copia = { ...registro }
  delete copia[chave]
  return copia
}

/**
 * Lotes da aba. Cada envio vira um lote; a API processa um por vez e os
 * demais esperam na fila dela.
 */
export function LotesProvider({ children }: { children: ReactNode }) {
  const [lotes, setLotes] = useState<Lote[]>([])
  const [errosDeConsulta, setErrosDeConsulta] = useState<Record<string, string>>({})
  const [retomando, setRetomando] = useState(() => idsSalvos().length > 0)
  const [saude, setSaude] = useState<SaudeApi | null>(null)
  const [apiFora, setApiFora] = useState(false)
  const [catalogo, setCatalogo] = useState<GrupoTipos[] | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [apagando, setApagando] = useState<string | null>(null)
  const [errosAoApagar, setErrosAoApagar] = useState<Record<string, string>>({})
  const [arquivosDosLotes, setArquivosDosLotes] = useState<ArquivosDosLotes>(arquivosSalvos)

  const [concluidos, setConcluidos] = useState<Record<string, number[]>>(concluidosSalvos)
  const [historico, setHistorico] = useState<EntradaHistorico[]>(historicoSalvo)

  useEffect(() => {
    sessao.gravarJson(CHAVES.arquivosDosLotes, arquivosDosLotes)
  }, [arquivosDosLotes])

  useEffect(() => {
    sessao.gravarJson(CHAVES.arquivosConcluidos, concluidos)
  }, [concluidos])

  useEffect(() => {
    preferencias.gravarJson(CHAVES.historico, historico)
  }, [historico])

  // Ids que saíram da lista. Uma consulta que volte depois disso não pode
  // trazer o lote de volta.
  const removidos = useRef(new Set<string>())

  const incluir = useCallback((lote: Lote) => {
    removidos.current.delete(lote.id)
    setLotes(atuais => (atuais.some(l => l.id === lote.id) ? atuais : [...atuais, lote]))
  }, [])

  const remover = useCallback((id: string) => {
    removidos.current.add(id)
    esquecerId(id)
    setLotes(atuais => atuais.filter(l => l.id !== id))
    setErrosDeConsulta(atuais => semChave(atuais, id))
    setErrosAoApagar(atuais => semChave(atuais, id))
    setArquivosDosLotes(atuais => semChave(atuais, id))
    setConcluidos(atuais => semChave(atuais, id))
  }, [])

  useEffect(() => {
    let ativo = true
    Promise.all([RedatorService.saude(), RedatorService.tiposDeDado()])
      .then(([dados, tipos]) => {
        if (!ativo) return
        setSaude(dados)
        setCatalogo(tipos.grupos)
      })
      .catch(() => ativo && setApiFora(true))
    return () => {
      ativo = false
    }
  }, [])

  // Retoma os lotes salvos na sessão (página atualizada no meio do trabalho).
  useEffect(() => {
    const ids = idsSalvos()
    if (ids.length === 0) return
    let ativo = true
    Promise.allSettled(ids.map(id => RedatorService.buscarLote(id))).then(resultados => {
      if (!ativo) return
      const retomados: Lote[] = []
      resultados.forEach((resultado, i) => {
        if (resultado.status === 'fulfilled') retomados.push(resultado.value)
        // 404: expirou ou a API foi reiniciada. Outras falhas (API fora do ar)
        // mantêm o id salvo, para retomar quando ela voltar.
        else if (naoEncontrado(resultado.reason)) esquecerId(ids[i])
      })
      setLotes(atuais => [...retomados.filter(r => !atuais.some(l => l.id === r.id)), ...atuais])
      setRetomando(false)
    })
    return () => {
      ativo = false
    }
  }, [])

  // Polling dos lotes ainda em andamento. Cada rodada gera uma lista nova, o
  // que agenda a próxima, até todos concluírem.
  useEffect(() => {
    const ativos = lotes.filter(l => l.estado !== 'concluido')
    if (ativos.length === 0) return
    const timer = window.setTimeout(async () => {
      const resultados = await Promise.allSettled(ativos.map(l => RedatorService.buscarLote(l.id)))
      const atualizados = new Map<string, Lote>()
      const falhas: Record<string, string> = {}
      resultados.forEach((resultado, i) => {
        const id = ativos[i].id
        if (removidos.current.has(id)) return
        if (resultado.status === 'fulfilled') atualizados.set(id, resultado.value)
        else if (naoEncontrado(resultado.reason)) remover(id)
        else falhas[id] = mensagemDeErro(resultado.reason)
      })
      setLotes(atuais => atuais.map(l => atualizados.get(l.id) ?? l))
      setErrosDeConsulta(atuais => {
        const proximos = { ...atuais, ...falhas }
        atualizados.forEach((_, id) => delete proximos[id])
        return proximos
      })
    }, INTERVALO_MS)
    return () => window.clearTimeout(timer)
  }, [lotes, remover])

  const processando = enviando || lotes.some(l => l.estado !== 'concluido')

  // Fechar a aba no meio do processamento perde o acompanhamento (o
  // sessionStorage vai junto): o navegador pergunta antes de sair.
  useEffect(() => {
    if (!processando) return
    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault()
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [processando])

  const enviar = useCallback(
    async (arquivos: File[], opcoes: OpcoesLote) => {
      setEnviando(true)
      setErroEnvio(null)
      try {
        const criado = await RedatorService.criarLote(arquivos, opcoes)
        salvarId(criado.id)
        setArquivosDosLotes(atuais => ({ ...atuais, [criado.id]: arquivos.map(fileKey) }))
        incluir(criado)
        return criado
      } catch (falha) {
        setErroEnvio(mensagemDeErro(falha))
        return null
      } finally {
        setEnviando(false)
      }
    },
    [incluir]
  )

  const apagar = useCallback(
    async (id: string) => {
      setApagando(id)
      setErrosAoApagar(atuais => semChave(atuais, id))
      try {
        await RedatorService.apagarLote(id)
        remover(id)
        return true
      } catch (falha) {
        // 404: o lote já não existe na API (expirou ou ela foi reiniciada).
        if (naoEncontrado(falha)) {
          remover(id)
          return true
        }
        // 409 só vem de API anterior ao cancelamento (ela recusava apagar lote
        // em andamento): a atual sempre aceita. Diz o que fazer em vez do erro cru.
        const mensagem = conflito(falha)
          ? 'A API em execução é de uma versão anterior e não cancela lote em andamento. ' +
            'Reinicie a API (Ctrl+C no terminal e python api.py) e tente de novo.'
          : mensagemDeErro(falha)
        setErrosAoApagar(atuais => ({ ...atuais, [id]: mensagem }))
        return false
      } finally {
        setApagando(null)
      }
    },
    [remover]
  )

  const baixar = useCallback(
    async (lote: Lote, arquivo: ArquivoLote, concluir: boolean) => {
      // O PDF chega inteiro antes de qualquer coisa ser apagada na API
      try {
        await RedatorService.baixarTarjado(lote.id, arquivo.indice, arquivo.nome)
      } catch (falha) {
        return mensagemDeErro(falha)
      }
      if (!concluir) return null

      const rotulos = new Map(catalogo?.flatMap(g => g.itens.map(i => [i.id, i.rotulo] as const)) ?? [])
      const entrada: EntradaHistorico = {
        id: `${lote.id}-${arquivo.indice}-${Date.now()}`,
        nome: arquivo.nome,
        paginas: arquivo.paginasTotal,
        tarjas: arquivo.tarjasAplicadas,
        tipos: lote.tipos.map(id => rotulos.get(id) ?? id),
        concluidoEm: new Date().toISOString()
      }
      setHistorico(atuais => [entrada, ...atuais].slice(0, MAXIMO_NO_HISTORICO))

      const doLote = [...new Set([...(concluidos[lote.id] ?? []), arquivo.indice])]
      setConcluidos(atuais => ({ ...atuais, [lote.id]: doLote }))

      // Saíram todos os arquivos que dava para baixar (os com erro não têm
      // tarjado): o lote sai dos tarjamentos e os PDFs são apagados na API.
      const loteInteiro =
        lote.estado === 'concluido' && lote.arquivos.every(a => a.estado === 'erro' || doLote.includes(a.indice))
      if (loteInteiro) await apagar(lote.id)
      return null
    },
    [catalogo, concluidos, apagar]
  )

  const limparHistorico = useCallback(() => setHistorico([]), [])

  /**
   * O arquivo está num lote ainda na fila ou sendo tarjado? Compara nome,
   * tamanho e data; para lote sem essa identificação (enviado por outra aba ou
   * versão anterior), compara só o nome.
   */
  const emTarjamento = useCallback(
    (arquivo: File) => {
      const chave = fileKey(arquivo)
      return lotes.some(lote => {
        if (lote.estado === 'concluido') return false
        const chaves = arquivosDosLotes[lote.id]
        return chaves ? chaves.includes(chave) : lote.arquivos.some(a => a.nome === arquivo.name)
      })
    },
    [lotes, arquivosDosLotes]
  )

  return (
    <LotesContext.Provider
      value={{
        lotes,
        errosDeConsulta,
        retomando,
        saude,
        apiFora,
        catalogo,
        enviando,
        erroEnvio,
        apagando,
        errosAoApagar,
        enviar,
        apagar,
        emTarjamento,
        concluidos,
        baixar,
        historico,
        limparHistorico
      }}
    >
      {children}
    </LotesContext.Provider>
  )
}
