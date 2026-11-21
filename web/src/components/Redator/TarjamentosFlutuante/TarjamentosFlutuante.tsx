import React, { useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronUp, faFileShield, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useLotes } from '../../../contexts'
import { AreaLateralContext } from '../../../contexts/AreaLateral'
import type { ArquivoLote, Lote } from '../../../services/RedatorService'
import { ConfirmarDownload } from '../ConfirmarDownload'
import { Message } from '../../../ui'
import { IMAGEM_PAGINA_EXEMPLO, LOTES_EXEMPLO, useDemonstracao, usePassoDoExemplo } from '../../Tutorial'
import { PaginaPreview } from '../PaginaPreview'
import { PainelRevisao } from '../PainelRevisao'
import type { TarjamentosFlutuanteProps } from './types'
import styles from './TarjamentosFlutuante.module.scss'

interface Previa {
  idLote: string
  indiceArquivo: number
  pagina: number
}

const contagem = (emAndamento: number, prontos: number) => {
  const partes = []
  if (emAndamento > 0) partes.push(`${emAndamento} em andamento`)
  if (prontos > 0) partes.push(`${prontos} ${prontos === 1 ? 'pronto' : 'prontos'}`)
  return partes.join(' · ')
}

/**
 * Tarjamentos numa sidebar encaixada à direita do conteúdo, entre o cabeçalho
 * e o rodapé (na faixa que o App reserva). Aparece depois do primeiro envio e
 * mostra cada lote com andamento, conferência e download. Pode ser minimizada
 * para um botão no canto.
 */
export const TarjamentosFlutuante: React.FC<TarjamentosFlutuanteProps> = ({ modo: modoEscolhido, onModoChange }) => {
  const {
    lotes: lotesReais,
    errosDeConsulta,
    apagando,
    errosAoApagar,
    apagar,
    concluidos,
    baixar,
    aprovacoes,
    alternarAprovacao,
    tarjarManualmente
  } = useLotes()
  const areaLateral = useContext(AreaLateralContext)
  const [previa, setPrevia] = useState<Previa | null>(null)

  // Tutorial aberto: a sidebar mostra lotes fictícios (aberta, mesmo que esteja
  // minimizada) e os botões não fazem nada. Os lotes reais voltam ao fechar.
  const exemplo = useDemonstracao()
  const passoDoExemplo = usePassoDoExemplo()
  const lotes = exemplo ? LOTES_EXEMPLO : lotesReais
  const modo = exemplo ? 'aberto' : modoEscolhido
  const nadaNoExemplo = () => undefined

  // Download pedido (pelo cartão do arquivo ou pela prévia): abre a pergunta
  const [pedido, setPedido] = useState<{ lote: Lote; arquivo: ArquivoLote } | null>(null)
  const [baixando, setBaixando] = useState(false)
  const [erroDownload, setErroDownload] = useState<string | null>(null)

  const pedirDownload = (lote: Lote) => (arquivo: ArquivoLote) => {
    setErroDownload(null)
    setPedido({ lote, arquivo })
  }

  const confirmarDownload = async (concluir: boolean) => {
    if (!pedido) return
    setBaixando(true)
    setErroDownload(null)
    const erro = await baixar(pedido.lote, pedido.arquivo, concluir)
    setBaixando(false)
    if (erro) {
      setErroDownload(erro)
      return
    }
    // Concluído, o arquivo some dos tarjamentos: a prévia dele também fecha
    if (concluir && previa?.idLote === pedido.lote.id && previa.indiceArquivo === pedido.arquivo.indice) {
      setPrevia(null)
    }
    setPedido(null)
  }

  const visivel = lotes.length > 0

  // Avisa o layout (App.module.scss): minimizado, deixa folga no fim da
  // página para o botão do canto não cobrir o conteúdo.
  useEffect(() => {
    if (!visivel) return
    document.documentElement.dataset.tarjamentos = modo
    return () => {
      delete document.documentElement.dataset.tarjamentos
    }
  }, [visivel, modo])

  if (!visivel) return null

  // Mais recente primeiro: é o que a pessoa acabou de enviar.
  const recentes = [...lotes].reverse()
  const emAndamento = recentes.filter(l => l.estado !== 'concluido').length
  const resumo = contagem(emAndamento, recentes.length - emAndamento)

  const loteDaPrevia = previa ? lotes.find(l => l.id === previa.idLote) : undefined
  // Guarda só o índice: o arquivo vem sempre da versão mais recente do lote.
  const arquivoDaPrevia = (previa && loteDaPrevia?.arquivos[previa.indiceArquivo]) ?? null
  const abrirPrevia = (idLote: string) => (arquivo: ArquivoLote, pagina: number) =>
    setPrevia({ idLote, indiceArquivo: arquivo.indice, pagina })

  const sidebar = (
    <aside className={styles['painel']} aria-labelledby="titulo-tarjamentos">
      {/* Acompanha a rolagem da página: fica preso ao topo da tela */}
      <div className={styles['fixo']}>
        {/* O tutorial destaca o cabeçalho: a sidebar inteira é mais alta que a tela */}
        <header className={styles['cabecalho']} data-tour="tarjamentos">
          <div className={styles['cabecalho-textos']}>
            <span className={styles['sobretitulo']}>Lotes desta aba</span>
            <h2 id="titulo-tarjamentos" className={styles['titulo']}>
              Tarjamentos
            </h2>
            <span className={styles['resumo']}>{resumo}</span>
          </div>
          <button
            type="button"
            className={styles['icone-botao']}
            onClick={() => !exemplo && onModoChange('minimizado')}
            aria-label="Fechar tarjamentos (continua no botão do canto)"
            title="Fechar"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </header>

        <div className={styles['lista']}>
          {exemplo && (
            <Message variant="info">
              Exemplo do tutorial: estes lotes e arquivos são fictícios. Os seus voltam quando o tutorial fechar.
            </Message>
          )}
          {recentes.map(lote =>
            exemplo ? (
              <PainelRevisao
                key={lote.id}
                lote={lote}
                erro={null}
                onVerPagina={nadaNoExemplo}
                onBaixar={nadaNoExemplo}
                concluidos={[]}
                aprovacoes={{}}
                onAprovar={nadaNoExemplo}
                onApagar={nadaNoExemplo}
                apagando={false}
                erroAoApagar={null}
                exemplo
              />
            ) : (
              <PainelRevisao
                key={lote.id}
                lote={lote}
                erro={errosDeConsulta[lote.id] ?? null}
                onVerPagina={abrirPrevia(lote.id)}
                onBaixar={pedirDownload(lote)}
                concluidos={concluidos[lote.id] ?? []}
                aprovacoes={aprovacoes[lote.id] ?? {}}
                onAprovar={(indice, pagina, aprovada) => alternarAprovacao(lote.id, indice, pagina, aprovada)}
                onApagar={() => void apagar(lote.id)}
                apagando={apagando === lote.id}
                erroAoApagar={errosAoApagar[lote.id] ?? null}
              />
            )
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {modo === 'minimizado' ? (
        <button
          type="button"
          className={styles['botao']}
          data-tour="tarjamentos"
          onClick={() => onModoChange('aberto')}
          aria-label={`Abrir tarjamentos: ${resumo}`}
        >
          <FontAwesomeIcon icon={faFileShield} className={styles['botao-icone']} />
          <span className={styles['botao-textos']}>
            <span className={styles['botao-titulo']}>Tarjamentos</span>
            <span className={styles['botao-resumo']}>{resumo}</span>
          </span>
          <FontAwesomeIcon icon={faChevronUp} className={styles['botao-seta']} />
        </button>
      ) : (
        areaLateral && createPortal(sidebar, areaLateral)
      )}

      {exemplo ? (
        // Tutorial: as janelas abrem sozinhas nos passos que as explicam, com
        // o arquivo fictício que tem conferência; nada nelas faz efeito
        <>
          <PaginaPreview
            idLote={ARQUIVO_COM_CONFERENCIA.idLote}
            arquivo={passoDoExemplo?.startsWith('previa-') ? ARQUIVO_COM_CONFERENCIA.arquivo : null}
            pagina={ARQUIVO_COM_CONFERENCIA.arquivo.paginasParaConferir[0].pagina}
            onTrocarPagina={nadaNoExemplo}
            onClose={nadaNoExemplo}
            onBaixar={nadaNoExemplo}
            aprovadas={[]}
            onAprovar={nadaNoExemplo}
            onTarjar={async () => null}
            imagemExemplo={IMAGEM_PAGINA_EXEMPLO}
          />
          <ConfirmarDownload
            nomeArquivo={passoDoExemplo === 'download-opcoes' ? ARQUIVO_COM_CONFERENCIA.arquivo.nome : null}
            baixando={false}
            erro={null}
            onSoBaixar={nadaNoExemplo}
            onConcluir={nadaNoExemplo}
            onFechar={nadaNoExemplo}
            exemplo
          />
        </>
      ) : (
        <>
          <PaginaPreview
            idLote={previa?.idLote ?? ''}
            arquivo={arquivoDaPrevia}
            pagina={previa?.pagina ?? 1}
            onTrocarPagina={pagina => setPrevia(atual => (atual ? { ...atual, pagina } : atual))}
            onClose={() => setPrevia(null)}
            onBaixar={arquivo => loteDaPrevia && pedirDownload(loteDaPrevia)(arquivo)}
            aprovadas={(previa && aprovacoes[previa.idLote]?.[previa.indiceArquivo]) || []}
            onAprovar={(pagina, aprovada) =>
              previa && alternarAprovacao(previa.idLote, previa.indiceArquivo, pagina, aprovada)
            }
            onTarjar={async (pagina, retangulos) =>
              previa ? tarjarManualmente(previa.idLote, previa.indiceArquivo, pagina, retangulos) : null
            }
          />

          <ConfirmarDownload
            nomeArquivo={pedido?.arquivo.nome ?? null}
            baixando={baixando}
            erro={erroDownload}
            onSoBaixar={() => void confirmarDownload(false)}
            onConcluir={() => void confirmarDownload(true)}
            onFechar={() => setPedido(null)}
          />
        </>
      )}
    </>
  )
}

/** Arquivo do exemplo que tem páginas para conferir (o que a janela de Ver página mostra). */
const ARQUIVO_COM_CONFERENCIA = (() => {
  const lote = LOTES_EXEMPLO.find(l => l.arquivos.some(a => a.paginasParaConferir.length > 0))!
  return { idLote: lote.id, arquivo: lote.arquivos.find(a => a.paginasParaConferir.length > 0)! }
})()
