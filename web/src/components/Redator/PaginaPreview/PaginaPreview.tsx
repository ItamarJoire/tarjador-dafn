import React, { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faChevronLeft,
  faChevronRight,
  faDownload,
  faForward,
  faHighlighter,
  faRotateLeft,
  faTrashCan
} from '@fortawesome/free-solid-svg-icons'
import { Button, Message, Skeleton } from '../../../ui'
import { Checkbox } from '../../../ui/Checkbox'
import { Modal } from '../../../ui/Modal'
import { RedatorService } from '../../../services'
import type { ArquivoLote, RetanguloProporcional } from '../../../services/RedatorService'
import { agruparPorPagina, plural } from '../agruparPorPagina'
import { ListaPendencias } from '../ListaPendencias'
import type { PaginaPreviewProps } from './types'
import styles from './PaginaPreview.module.scss'

/** Menor tarja aceita (fração da página): um clique sem arrastar não conta. */
const TAMANHO_MINIMO = 0.005

const limitar = (valor: number) => Math.min(Math.max(valor, 0), 1)

interface Desenho {
  pendentes: RetanguloProporcional[]
  onAdicionar: (retangulo: RetanguloProporcional) => void
}

/**
 * Imagem com esqueleto enquanto carrega. A key por src reinicia o estado.
 * compacta: no exemplo do tutorial a página inteira cabe na tela, para o
 * destaque contornar a imagem toda.
 * desenho: modo de tarjar à mão; arrastar sobre a imagem cria um retângulo,
 * em proporção da página (0 a 1), como a API espera.
 */
const ImagemPagina: React.FC<{ src: string; alt: string; compacta?: boolean; desenho: Desenho | null }> = ({
  src,
  alt,
  compacta,
  desenho
}) => {
  const [carregada, setCarregada] = useState(false)
  const [falhou, setFalhou] = useState(false)
  const camada = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const [arrastando, setArrastando] = useState<RetanguloProporcional | null>(null)

  const ponto = (evento: React.PointerEvent) => {
    const area = camada.current!.getBoundingClientRect()
    return {
      x: limitar((evento.clientX - area.left) / area.width),
      y: limitar((evento.clientY - area.top) / area.height)
    }
  }

  const retangulo = (a: { x: number; y: number }, b: { x: number; y: number }): RetanguloProporcional => ({
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y)
  })

  const estilo = (r: RetanguloProporcional): React.CSSProperties => ({
    left: `${r.x0 * 100}%`,
    top: `${r.y0 * 100}%`,
    width: `${(r.x1 - r.x0) * 100}%`,
    height: `${(r.y1 - r.y0) * 100}%`
  })

  return (
    <div className={styles['quadro']}>
      {!carregada && !falhou && <Skeleton variant="rect" width="100%" height={520} />}
      {falhou && <p className={styles['falha']}>Não foi possível carregar a página.</p>}
      <img
        src={src}
        alt={alt}
        className={`${styles['imagem']}${compacta ? ` ${styles['imagem-compacta']}` : ''}`}
        style={carregada ? undefined : { display: 'none' }}
        onLoad={() => setCarregada(true)}
        onError={() => setFalhou(true)}
      />
      {desenho && carregada && (
        <div
          ref={camada}
          className={styles['camada-desenho']}
          role="application"
          aria-label="Arraste sobre a página para desenhar uma tarja"
          onPointerDown={evento => {
            evento.currentTarget.setPointerCapture(evento.pointerId)
            inicio.current = ponto(evento)
            setArrastando(retangulo(inicio.current, inicio.current))
          }}
          onPointerMove={evento => {
            if (inicio.current) setArrastando(retangulo(inicio.current, ponto(evento)))
          }}
          onPointerUp={evento => {
            if (!inicio.current) return
            const final = retangulo(inicio.current, ponto(evento))
            inicio.current = null
            setArrastando(null)
            if (final.x1 - final.x0 >= TAMANHO_MINIMO && final.y1 - final.y0 >= TAMANHO_MINIMO) {
              desenho.onAdicionar(final)
            }
          }}
          onPointerCancel={() => {
            inicio.current = null
            setArrastando(null)
          }}
        >
          {desenho.pendentes.map((r, i) => (
            <span key={i} className={styles['tarja-pendente']} style={estilo(r)} />
          ))}
          {arrastando && <span className={styles['tarja-pendente']} style={estilo(arrastando)} />}
        </div>
      )}
    </div>
  )
}

/**
 * Visualização de uma página já tarjada: o que conferir nela, navegação por
 * todas as páginas, check de aprovada e tarja à mão para o que o tarjamento
 * automático não cobriu (ou cobriu só em parte).
 */
export const PaginaPreview: React.FC<PaginaPreviewProps> = props =>
  props.arquivo ? (
    // A key zera o desenho em andamento ao trocar de arquivo ou fechar
    <JanelaPagina key={`${props.idLote}-${props.arquivo.indice}`} {...props} arquivo={props.arquivo} />
  ) : null

const JanelaPagina: React.FC<PaginaPreviewProps & { arquivo: ArquivoLote }> = ({
  idLote,
  arquivo,
  pagina,
  onTrocarPagina,
  onClose,
  onBaixar,
  aprovadas,
  onAprovar,
  onTarjar,
  imagemExemplo
}) => {
  const [tarjando, setTarjando] = useState(false)
  const [pendentes, setPendentes] = useState<RetanguloProporcional[]>([])
  const [aplicando, setAplicando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Tutorial: imagem desenhada no front e marcas para os passos destacarem
  const exemplo = imagemExemplo !== undefined
  const tour = (nome: string) => (exemplo ? nome : undefined)

  const paginas = agruparPorPagina(arquivo)
  const posicao = paginas.findIndex(p => p.pagina === pagina)
  const atual = posicao >= 0 ? paginas[posicao] : undefined
  const proximaPendencia = paginas.find(p => p.pagina > pagina)?.pagina
  const aprovada = aprovadas.includes(pagina)
  const src = imagemExemplo ?? RedatorService.urlPagina(idLote, arquivo.indice, pagina, arquivo.versao)

  // Tarjas desenhadas e ainda não aplicadas prendem a página: sair delas as perderia
  const presoNaPagina = pendentes.length > 0 || aplicando

  const trocar = (destino: number) => {
    setTarjando(false)
    setErro(null)
    setAviso(null)
    onTrocarPagina(destino)
  }

  const sairDoDesenho = () => {
    setTarjando(false)
    setPendentes([])
    setErro(null)
  }

  const aplicar = async () => {
    setAplicando(true)
    setErro(null)
    const falha = await onTarjar(pagina, pendentes)
    setAplicando(false)
    if (falha) {
      setErro(falha)
      return
    }
    setAviso(
      `${plural(pendentes.length, 'tarja aplicada', 'tarjas aplicadas')}. Confira a imagem e, se estiver tudo certo, marque a página como aprovada.`
    )
    setPendentes([])
    setTarjando(false)
  }

  return (
    <Modal
      open
      size="large"
      onClose={onClose}
      title={`Página ${pagina} de ${arquivo.paginasTotal} · ${arquivo.nome}`}
      footer={
        <div className={styles['rodape']} data-tour={tour('previa-navegacao')}>
          <div className={styles['navegacao']}>
            <Button
              variant="tertiary"
              icon={<FontAwesomeIcon icon={faChevronLeft} />}
              onClick={() => trocar(pagina - 1)}
              disabled={pagina <= 1 || presoNaPagina}
            >
              Anterior
            </Button>
            <Button
              variant="tertiary"
              onClick={() => trocar(pagina + 1)}
              disabled={pagina >= arquivo.paginasTotal || presoNaPagina}
            >
              Próxima <FontAwesomeIcon icon={faChevronRight} />
            </Button>
            {proximaPendencia !== undefined && (
              <Button
                variant="tertiary"
                icon={<FontAwesomeIcon icon={faForward} />}
                onClick={() => trocar(proximaPendencia)}
                disabled={presoNaPagina}
              >
                Próxima pendência (pág. {proximaPendencia})
              </Button>
            )}
          </div>
          <div className={styles['acoes-rodape']}>
            <Checkbox
              label="Página aprovada"
              checked={aprovada}
              onChange={marcar => onAprovar(pagina, marcar)}
              disabled={presoNaPagina}
            />
            <Button variant="secondary" icon={<FontAwesomeIcon icon={faDownload} />} onClick={() => onBaixar(arquivo)}>
              Baixar PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className={styles['corpo']}>
        {atual ? (
          <div className={styles['pendencias']} data-tour={tour('previa-pendencia')}>
            <p className={styles['contexto']}>
              {paginas.length > 1
                ? `Pendência ${posicao + 1} de ${paginas.length} neste arquivo. Confira na imagem abaixo, que já está tarjada:`
                : 'Confira na imagem abaixo, que já está tarjada:'}
            </p>
            <ListaPendencias item={atual} />
          </div>
        ) : (
          <p className={styles['contexto']}>
            Esta página não tem pendência apontada. Se algum dado ficou sem tarja, use Tarjar à mão.
          </p>
        )}

        {/* Tarja à mão: para o que o tarjamento automático não cobriu */}
        <div className={styles['ferramentas']} data-tour={tour('previa-tarjar')}>
          {!tarjando ? (
            <>
              <Button
                variant="secondary"
                icon={<FontAwesomeIcon icon={faHighlighter} />}
                onClick={() => {
                  setAviso(null)
                  setTarjando(true)
                }}
              >
                Tarjar à mão
              </Button>
              {aviso && <span className={styles['aviso-ok']}>{aviso}</span>}
            </>
          ) : (
            <>
              <p className={styles['instrucao']}>
                <strong>Arraste sobre a página</strong> para cobrir o que faltou tarjar. Depois clique em Aplicar: as
                tarjas são definitivas, apagam o que está embaixo e não dá para desfazer depois de aplicar.
              </p>
              <div className={styles['botoes-desenho']}>
                <Button
                  variant="tertiary"
                  icon={<FontAwesomeIcon icon={faRotateLeft} />}
                  onClick={() => setPendentes(atuais => atuais.slice(0, -1))}
                  disabled={pendentes.length === 0 || aplicando}
                >
                  Desfazer
                </Button>
                <Button
                  variant="tertiary"
                  icon={<FontAwesomeIcon icon={faTrashCan} />}
                  onClick={() => setPendentes([])}
                  disabled={pendentes.length === 0 || aplicando}
                >
                  Limpar
                </Button>
                <Button variant="secondary" onClick={sairDoDesenho} disabled={aplicando}>
                  Cancelar
                </Button>
                <Button
                  icon={<FontAwesomeIcon icon={faCheck} />}
                  onClick={() => void aplicar()}
                  disabled={pendentes.length === 0 || aplicando}
                >
                  {aplicando
                    ? 'Aplicando ...'
                    : pendentes.length === 0
                      ? 'Aplicar tarjas'
                      : `Aplicar ${plural(pendentes.length, 'tarja', 'tarjas')}`}
                </Button>
              </div>
            </>
          )}
          {erro && <Message variant="error">{erro}</Message>}
        </div>

        <div data-tour={tour('previa-imagem')} className={exemplo ? styles['area-compacta'] : undefined}>
          <ImagemPagina
            key={src}
            src={src}
            alt={`Página ${pagina} tarjada de ${arquivo.nome}`}
            compacta={exemplo}
            desenho={
              tarjando && !aplicando
                ? { pendentes, onAdicionar: r => setPendentes(atuais => [...atuais, r]) }
                : null
            }
          />
        </div>
      </div>
    </Modal>
  )
}
