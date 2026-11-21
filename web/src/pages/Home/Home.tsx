import { useEffect, useRef, useState } from 'react'
import { PageTitle } from '../../ui'
import {
  HistoricoTarjamentos,
  PainelEnvio,
  TarjamentosFlutuante,
  ancoraDoLote,
  idsDoCatalogo,
  idsPadrao
} from '../../components/Redator'
import type { ModoTarjamentos } from '../../components/Redator/TarjamentosFlutuante'
import { useLotes } from '../../contexts'
import { CHAVES, preferencias } from '../../services'

/** Escolhas do envio, lembradas entre visitas (localStorage). */
interface Preferencias {
  tipos: string[] | null
  agressivo: boolean
  semOcr: boolean
}

/** Lê as preferências salvas, descartando o que não tiver o formato esperado. */
const preferenciasSalvas = (): Preferencias => {
  const salvas = preferencias.lerJson<Partial<Preferencias>>(CHAVES.preferencias)
  const tipos = salvas?.tipos
  return {
    tipos: Array.isArray(tipos) && tipos.every(t => typeof t === 'string') ? tipos : null,
    agressivo: salvas?.agressivo === true,
    semOcr: salvas?.semOcr === true
  }
}

/**
 * Tela principal: envio, opções e "O que tarjar". Depois do primeiro envio, os
 * tarjamentos (andamento, conferência e download) ficam num painel flutuante à
 * direita. Dá para enviar mais PDFs enquanto outros são tarjados: cada envio
 * vira um lote, na fila da API.
 */
export const Home = () => {
  const { lotes, enviando, erroEnvio, saude, apiFora, catalogo, enviar, emTarjamento } = useLotes()

  // As escolhas ficam aqui, e não no painel de envio, para valer de novo no
  // próximo envio e na próxima visita. tipos null = o usuário ainda não mexeu:
  // vale o padrão.
  const [inicial] = useState(preferenciasSalvas)
  const [tiposEscolhidos, setTiposEscolhidos] = useState<string[] | null>(inicial.tipos)
  const [agressivo, setAgressivo] = useState(inicial.agressivo)
  const [semOcr, setSemOcr] = useState(inicial.semOcr)

  useEffect(() => {
    preferencias.gravarJson(CHAVES.preferencias, { tipos: tiposEscolhidos, agressivo, semOcr })
  }, [tiposEscolhidos, agressivo, semOcr])

  // Um tipo salvo pode ter saído do catálogo numa versão nova da API (que
  // recusaria o envio): só valem os ids que o catálogo atual conhece.
  const conhecidos = catalogo ? new Set(idsDoCatalogo(catalogo)) : null
  const tipos =
    tiposEscolhidos === null
      ? idsPadrao(catalogo ?? [])
      : conhecidos
        ? tiposEscolhidos.filter(id => conhecidos.has(id))
        : tiposEscolhidos

  // Painel de tarjamentos: abre a cada envio novo; a pessoa pode minimizar.
  const [modoPainel, setModoPainel] = useState<ModoTarjamentos>('aberto')

  // Depois de um envio, o painel rola até o lote novo assim que ele aparece.
  const rolarPara = useRef<string | null>(null)
  useEffect(() => {
    const id = rolarPara.current
    if (!id || !lotes.some(l => l.id === id)) return
    rolarPara.current = null
    document.getElementById(ancoraDoLote(id))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [lotes])

  const aoEnviar = async (arquivos: File[]) => {
    const criado = await enviar(arquivos, { tipos, agressivo, semOcr })
    if (criado) {
      rolarPara.current = criado.id
      setModoPainel(atual => (atual === 'minimizado' ? 'aberto' : atual))
    }
    return criado !== null
  }

  return (
    <>
      <PageTitle title="Tarjar documentos" />
      <PainelEnvio
        enviando={enviando}
        erro={erroEnvio}
        saude={saude}
        apiFora={apiFora}
        catalogo={catalogo}
        tipos={tipos}
        onTiposChange={setTiposEscolhidos}
        agressivo={agressivo}
        onAgressivoChange={setAgressivo}
        semOcr={semOcr}
        onSemOcrChange={setSemOcr}
        onEnviar={aoEnviar}
        emTarjamento={emTarjamento}
      />
      <HistoricoTarjamentos />
      <TarjamentosFlutuante modo={modoPainel} onModoChange={setModoPainel} />
    </>
  )
}
