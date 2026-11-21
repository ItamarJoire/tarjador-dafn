import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Button, Loading, Message } from '../../../ui'
import { ArquivoRevisao } from '../ArquivoRevisao'
import { ConfirmarExclusao, type ModoExclusao } from '../ConfirmarExclusao'
import { resumoDoLote } from '../resumoDoLote'
import { agruparPorPagina, plural } from '../agruparPorPagina'
import { ancoraDoLote } from '../ancoraDoLote'
import type { PainelRevisaoProps } from './types'
import styles from './PainelRevisao.module.scss'

/** Um lote na tela única: andamento, conferência e download. */
export const PainelRevisao: React.FC<PainelRevisaoProps> = ({
  lote,
  erro,
  onVerPagina,
  onBaixar,
  concluidos: indicesConcluidos,
  aprovacoes,
  onAprovar,
  onApagar,
  apagando,
  erroAoApagar,
  exemplo = false
}) => {
  const [confirmando, setConfirmando] = useState<ModoExclusao | null>(null)
  // Arquivos já baixados e concluídos saem do lote (estão no histórico)
  const visiveis = lote.arquivos.filter(a => !indicesConcluidos.includes(a.indice))
  const jaConcluidos = lote.arquivos.length - visiveis.length

  const total = lote.arquivos.length
  const concluidos = lote.arquivos.filter(a => a.estado === 'concluido')
  const finalizados = lote.arquivos.filter(a => a.estado === 'concluido' || a.estado === 'erro').length
  const tarjas = concluidos.reduce((soma, a) => soma + a.tarjasAplicadas, 0)
  const paginas = concluidos.reduce((soma, a) => soma + agruparPorPagina(a).length, 0)
  // Páginas com pendência que a pessoa já aprovou na conferência
  const aprovadas = concluidos.reduce((soma, a) => {
    const doArquivo = aprovacoes[a.indice] ?? []
    return soma + agruparPorPagina(a).filter(p => doArquivo.includes(p.pagina)).length
  }, 0)
  const pendentes = paginas - aprovadas
  const emAndamento = lote.estado !== 'concluido'
  const resumo = resumoDoLote(lote, aprovacoes)
  const idTitulo = `${ancoraDoLote(lote.id)}-titulo`

  return (
    <section
      id={ancoraDoLote(lote.id)}
      className={styles['lote']}
      aria-labelledby={idTitulo}
      data-tour={exemplo && emAndamento ? 'exemplo-andamento' : undefined}
    >
      <header className={styles['cabecalho']}>
        <div className={styles['identificacao']}>
          <h3 id={idTitulo} className={styles['nome']}>
            {resumo.nome}
          </h3>
          <span className={styles['numeros']}>
            {plural(total, 'arquivo', 'arquivos')} · {plural(tarjas, 'tarja aplicada', 'tarjas aplicadas')} ·{' '}
            {plural(paginas, 'página para conferir', 'páginas para conferir')}
          </span>
        </div>
        <span className={`${styles['situacao']} ${styles[`tom-${resumo.tom}`]}`}>{resumo.situacao}</span>
      </header>

      <div aria-live="polite" className={styles['mensagens']}>
        {erro && <Message variant="error">{erro}</Message>}
        {lote.ignorados.length > 0 && (
          <Message variant="warning">
            {lote.ignorados.join(', ')} não {lote.ignorados.length === 1 ? 'é PDF válido' : 'são PDFs válidos'} e
            ficou de fora.
          </Message>
        )}
        {lote.estado === 'processando' && total > 1 && (
          <Message variant="info">
            Processando {Math.min(finalizados + 1, total)} de {plural(total, 'arquivo', 'arquivos')}. A conferência de
            cada um aparece assim que ele termina.
          </Message>
        )}
        {!emAndamento && pendentes > 0 && (
          <Message variant="warning">
            {pendentes === 1
              ? '1 página precisa de conferência humana antes do uso.'
              : `${pendentes} páginas precisam de conferência humana antes do uso.`}
            {aprovadas > 0 && ` ${aprovadas} de ${paginas} já ${aprovadas === 1 ? 'aprovada' : 'aprovadas'}.`}
          </Message>
        )}
        {!emAndamento && paginas > 0 && pendentes === 0 && (
          <Message variant="success">
            {paginas === 1
              ? 'A página com pendência foi conferida e aprovada.'
              : `As ${paginas} páginas com pendência foram conferidas e aprovadas.`}
          </Message>
        )}
        {!emAndamento && paginas === 0 && concluidos.length > 0 && (
          <Message variant="success">Nenhuma tarja com dúvida e nenhuma página suspeita.</Message>
        )}
      </div>

      <div className={styles['arquivos']}>
        {visiveis.map(arquivo => (
          <ArquivoRevisao
            key={arquivo.indice}
            arquivo={arquivo}
            aprovadas={aprovacoes[arquivo.indice] ?? []}
            onAprovar={(pagina, aprovada) => onAprovar(arquivo.indice, pagina, aprovada)}
            onVerPagina={onVerPagina}
            onBaixar={onBaixar}
            exemplo={exemplo}
          />
        ))}
        {jaConcluidos > 0 && (
          <span className={styles['nota']}>
            {jaConcluidos === 1
              ? '1 arquivo deste lote já foi baixado e concluído (está no histórico).'
              : `${jaConcluidos} arquivos deste lote já foram baixados e concluídos (estão no histórico).`}
          </span>
        )}
      </div>

      <div className={styles['acoes']}>
        {emAndamento ? (
          <>
            <Loading size="small" label={lote.estado === 'na_fila' ? 'Na fila ...' : 'Processando ...'} />
            <Button
              variant="secondary"
              icon={<FontAwesomeIcon icon={faXmark} />}
              onClick={() => setConfirmando('cancelar')}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              icon={<FontAwesomeIcon icon={faTrashCan} />}
              onClick={() => setConfirmando('apagar')}
            >
              Apagar lote
            </Button>
            <span className={styles['nota']}>Os PDFs tarjados ficam disponíveis por 30 minutos depois de prontos.</span>
          </>
        )}
      </div>

      {/* Se o lote terminar com o aviso de cancelar aberto, o aviso fecha: não
          faz sentido apagar sem querer um resultado que acabou de ficar pronto. */}
      <ConfirmarExclusao
        open={confirmando === 'apagar' || (confirmando === 'cancelar' && emAndamento)}
        modo={confirmando ?? 'cancelar'}
        jaTarjados={concluidos.length}
        apagando={apagando}
        erro={erroAoApagar}
        onConfirmar={onApagar}
        onFechar={() => setConfirmando(null)}
      />
    </section>
  )
}
