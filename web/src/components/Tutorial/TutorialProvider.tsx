import React, { type ReactNode } from 'react'
import { TourProvider, type StylesObj } from '@reactour/tour'
import type { Position, PopoverStylesObj } from '@reactour/popover'
import type { MaskStylesObj } from '@reactour/mask'
import { Button } from '../../ui'
import { SincronizarTutorial } from './SincronizarTutorial'

const MARGEM = 16

/**
 * Onde o balão de cada passo abre. O posicionamento automático do Reactour
 * deixava o balão sair da tela (no celular, 16px para fora; no último passo,
 * acima do topo). Aqui ele sempre fica inteiro na tela:
 * tela larga: ao lado do destaque (direita ou esquerda), senão embaixo ou em
 * cima; tela estreita: centralizado, embaixo ou em cima do destaque.
 */
const posicionar: Position = (alvo, balao) => {
  const { top, bottom, left, right, windowWidth: largura, windowHeight: altura } = alvo
  const { width: w, height: h } = balao
  const dentroX = (x: number) => Math.min(Math.max(MARGEM, x), largura - w - MARGEM)
  const dentroY = (y: number) => Math.min(Math.max(MARGEM, y), altura - h - MARGEM)
  const cabeEmbaixo = bottom + MARGEM + h <= altura
  const cabeEmCima = top - MARGEM - h >= 0

  if (largura < 768) {
    const y = cabeEmbaixo ? bottom + MARGEM : cabeEmCima ? top - MARGEM - h : altura - h - MARGEM
    return [dentroX((largura - w) / 2), dentroY(y)]
  }
  if (right + MARGEM + w <= largura) return [right + MARGEM, dentroY(top)]
  if (left - MARGEM - w >= 0) return [left - MARGEM - w, dentroY(top)]
  if (cabeEmbaixo) return [dentroX(left), bottom + MARGEM]
  if (cabeEmCima) return [dentroX(left), top - MARGEM - h]
  // Destaque maior que a tela (ex.: a imagem da página na janela de Ver
  // página): não cabe em lado nenhum, o balão vai para o canto inferior
  // direito, onde cobre o mínimo do que está sendo explicado
  return [largura - w - MARGEM, altura - h - MARGEM]
}

/** Visual do tutorial no padrão da aplicação (cores do gov.br, tema claro e escuro). */
const estilos: StylesObj & PopoverStylesObj & MaskStylesObj = {
  popover: base => ({
    ...base,
    // no celular, cabe na tela com margem dos dois lados
    boxSizing: 'border-box',
    maxWidth: 'min(400px, calc(100vw - 32px))',
    padding: '28px 24px 20px',
    borderRadius: 12,
    background: 'var(--surface)',
    color: 'var(--surface-text)',
    // a raiz usa font-size 62.5% (1rem = 10px): sem isto o texto fica minúsculo
    fontSize: '1.5rem',
    boxShadow: '0 16px 40px rgba(27, 27, 27, 0.28)'
  }),
  maskArea: base => ({ ...base, rx: 8 }),
  // Escurecimento em volta (mais forte no tema escuro, via variável)
  maskWrapper: base => ({ ...base, color: 'var(--tutorial-mascara)' }),
  // Contorno da área explicada: o Reactour esconde este retângulo por padrão;
  // aqui ele aparece como uma borda azul, visível nos dois temas
  highlightedArea: base => ({
    ...base,
    display: 'block',
    fill: 'transparent',
    stroke: 'var(--tutorial-destaque)',
    strokeWidth: 3,
    rx: 8,
    pointerEvents: 'none'
  }),
  // Bolha com "3/10": larga o bastante para "10/10"
  badge: base => ({
    ...base,
    height: 'auto',
    padding: '4px 10px',
    borderRadius: 999,
    background: 'var(--blue-warm-vivid-70-main)',
    fontFamily: 'inherit',
    fontSize: '1.3rem',
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: 'nowrap'
  }),
  close: base => ({ ...base, top: 14, right: 14, width: 12, height: 12, color: 'var(--text-muted)' }),
  dot: (base, estado) => ({
    ...base,
    background: estado?.current ? 'var(--blue-warm-vivid-70-main)' : 'transparent',
    borderColor: 'var(--blue-warm-vivid-70-main)'
  }),
  controls: base => ({ ...base, marginTop: 20 })
}

/**
 * Tutorial guiado (Reactour). Os passos são montados ao abrir, pelo botão
 * Tutorial do cabeçalho. Dá para sair em qualquer etapa: link "Sair do
 * tutorial", X, tecla Esc ou clique fora do destaque.
 */
export const TutorialProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <TourProvider
    steps={[]}
    styles={estilos}
    position={posicionar}
    padding={{ mask: 8, popover: 16 }}
    scrollSmooth
    showBadge
    // Etapa atual e total: "3/10"
    badgeContent={({ currentStep, totalSteps }) => `${currentStep + 1}/${totalSteps}`}
    showDots={false}
    accessibilityOptions={{
      closeButtonAriaLabel: 'Sair do tutorial',
      showNavigationScreenReaders: true
    }}
    // Clicar fora do destaque também sai do tutorial
    onClickMask={({ setIsOpen }) => setIsOpen(false)}
    prevButton={({ currentStep, setCurrentStep }) =>
      currentStep === 0 ? (
        <span />
      ) : (
        <Button variant="secondary" onClick={() => setCurrentStep(passo => passo - 1)}>
          Anterior
        </Button>
      )
    }
    nextButton={({ currentStep, stepsLength, setCurrentStep, setIsOpen }) =>
      currentStep === stepsLength - 1 ? (
        <Button onClick={() => setIsOpen(false)}>Concluir</Button>
      ) : (
        <Button onClick={() => setCurrentStep(passo => passo + 1)}>Próximo</Button>
      )
    }
  >
    <SincronizarTutorial />
    {children}
  </TourProvider>
)
