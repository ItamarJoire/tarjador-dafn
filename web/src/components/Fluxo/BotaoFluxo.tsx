import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDiagramProject, faMinus, faPlus, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import { Modal } from '../../ui/Modal'
import { BotaoIcone } from '../Cabecalho/BotaoIcone'
import { DIAGRAMAS } from './diagramas'
import { Fluxograma } from './Fluxograma'
import styles from './Fluxo.module.scss'

const TITULO = 'Como o Tarjador funciona'
const ESCALAS = [0.5, 0.75, 1, 1.25, 1.5, 2]
const PADRAO = 1

const LEGENDA = [
  { classe: 'legenda-pessoa', texto: 'Quem usa' },
  { classe: 'legenda-navegador', texto: 'Navegador' },
  { classe: 'legenda-api', texto: 'API do Tarjador' },
  { classe: 'legenda-aviso', texto: 'Observação' }
]

/** Ícone de fluxo do cabeçalho: abre o fluxograma de como o sistema opera. */
export const BotaoFluxo: React.FC = () => {
  const [aberto, setAberto] = useState(false)

  return (
    <>
      <BotaoIcone icone={faDiagramProject} rotulo={TITULO} onClick={() => setAberto(true)} />
      {aberto && <JanelaFluxo onClose={() => setAberto(false)} />}
    </>
  )
}

/** Montada só aberta: o zoom e a posição recomeçam a cada vez. */
const JanelaFluxo: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [escala, setEscala] = useState(PADRAO)
  const [arrastando, setArrastando] = useState(false)
  const area = useRef<HTMLDivElement>(null)
  const inicio = useRef<{ x: number; y: number; esquerda: number; topo: number } | null>(null)

  // Muda o zoom mantendo no lugar o ponto que estava no centro da área
  const aplicarEscala = (nova: number) => {
    const el = area.current
    if (!el || nova === escala) return
    const centroX = (el.scrollLeft + el.clientWidth / 2) / escala
    const centroY = (el.scrollTop + el.clientHeight / 2) / escala
    setEscala(nova)
    requestAnimationFrame(() => {
      el.scrollLeft = centroX * nova - el.clientWidth / 2
      el.scrollTop = centroY * nova - el.clientHeight / 2
    })
  }

  const passo = (direcao: 1 | -1) => {
    const indice = ESCALAS.indexOf(escala)
    aplicarEscala(ESCALAS[Math.min(Math.max(indice + direcao, 0), ESCALAS.length - 1)])
  }
  // A roda do mouse é ouvida fora do React: lê sempre a versão mais nova
  const passoRef = useRef(passo)
  useLayoutEffect(() => {
    passoRef.current = passo
  })

  const restaurar = () => {
    setEscala(PADRAO)
    area.current?.scrollTo({ left: 0, top: 0 })
  }

  // Ctrl + roda do mouse: zoom (o React registra a roda como passiva e não deixa cancelar o zoom da página)
  useEffect(() => {
    const el = area.current
    if (!el) return
    const naRoda = (evento: WheelEvent) => {
      if (!evento.ctrlKey) return
      evento.preventDefault()
      passoRef.current(evento.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', naRoda, { passive: false })
    return () => el.removeEventListener('wheel', naRoda)
  }, [])

  return (
    <Modal open onClose={onClose} title={TITULO} size="large" className={styles['janela']}>
      <div className={styles['conteudo']}>
        <div className={styles['barra']}>
          <ul className={styles['legenda']} aria-label="Legenda das cores">
            {LEGENDA.map(item => (
              <li key={item.classe}>
                <span className={`${styles['amostra']} ${styles[item.classe]}`} aria-hidden="true" />
                {item.texto}
              </li>
            ))}
            <li>
              <span className={styles['amostra-decisao']} aria-hidden="true" />
              Decisão
            </li>
          </ul>

          <div className={styles['zoom']} role="group" aria-label="Zoom">
            <button
              type="button"
              className={styles['controle']}
              onClick={() => passo(-1)}
              disabled={escala <= ESCALAS[0]}
              aria-label="Diminuir zoom"
              title="Diminuir zoom"
            >
              <FontAwesomeIcon icon={faMinus} />
            </button>
            <span className={styles['percentual']} aria-live="polite">
              {Math.round(escala * 100)}%
            </span>
            <button
              type="button"
              className={styles['controle']}
              onClick={() => passo(1)}
              disabled={escala >= ESCALAS[ESCALAS.length - 1]}
              aria-label="Aumentar zoom"
              title="Aumentar zoom"
            >
              <FontAwesomeIcon icon={faPlus} />
            </button>
            <button type="button" className={`${styles['controle']} ${styles['reset']}`} onClick={restaurar}>
              <FontAwesomeIcon icon={faRotateLeft} /> Reset
            </button>
          </div>
        </div>

        <p className={styles['dica']}>Arraste para mover. Ctrl + roda do mouse também muda o zoom.</p>

        <div
          ref={area}
          className={`${styles['area']}${arrastando ? ` ${styles['arrastando']}` : ''}`}
          onPointerDown={evento => {
            if (evento.button !== 0 || !area.current) return
            inicio.current = {
              x: evento.clientX,
              y: evento.clientY,
              esquerda: area.current.scrollLeft,
              topo: area.current.scrollTop
            }
            evento.currentTarget.setPointerCapture(evento.pointerId)
            setArrastando(true)
          }}
          onPointerMove={evento => {
            if (!inicio.current || !area.current) return
            area.current.scrollLeft = inicio.current.esquerda - (evento.clientX - inicio.current.x)
            area.current.scrollTop = inicio.current.topo - (evento.clientY - inicio.current.y)
          }}
          onPointerUp={() => {
            inicio.current = null
            setArrastando(false)
          }}
          onPointerCancel={() => {
            inicio.current = null
            setArrastando(false)
          }}
        >
          {DIAGRAMAS.map(diagrama => (
            <section key={diagrama.id} className={styles['secao']} aria-labelledby={`fluxo-${diagrama.id}`}>
              {/* O título acompanha a rolagem lateral */}
              <div className={styles['cabecalho-secao']}>
                <h4 id={`fluxo-${diagrama.id}`} className={styles['titulo-secao']}>
                  {diagrama.titulo}
                </h4>
                <p className={styles['descricao-secao']}>{diagrama.descricao}</p>
              </div>
              <Fluxograma diagrama={diagrama} escala={escala} />
            </section>
          ))}
        </div>
      </div>
    </Modal>
  )
}
