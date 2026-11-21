import type { ReactNode } from 'react'
import type { StepType } from '@reactour/tour'
import { PassoTutorial } from './PassoTutorial'

/** Atributo que marca, na tela, o que cada passo destaca. */
export const alvo = (nome: string) => `[data-tour="${nome}"]`

// Existe e está visível (no celular, a sidebar some durante o tutorial)
const existe = (nome: string) => {
  const elemento = document.querySelector(alvo(nome))
  return elemento !== null && elemento.getClientRects().length > 0
}

/**
 * Passos que explicam a sidebar de tarjamentos, sobre os lotes fictícios do
 * exemplo (exemplo.ts). Neles, a sidebar aparece mesmo no celular. Os "previa-"
 * abrem a janela de Ver página do exemplo e o "download-opcoes", a pergunta de
 * baixar (a sidebar decide pelo passo atual: usePassoDoExemplo).
 */
export const PASSOS_DO_EXEMPLO = [
  'tarjamentos',
  'exemplo-andamento',
  'exemplo-conferencia',
  'previa-imagem',
  'previa-pendencia',
  'previa-navegacao',
  'exemplo-baixar',
  'download-opcoes'
]

interface Passo {
  nome: string
  titulo: string
  texto: ReactNode
}

const passo = (nome: string, titulo: string, texto: ReactNode): Passo => ({ nome, titulo, texto })

/** Vira passo do Reactour (a etapa "3/10" fica na bolha, pelo TutorialProvider). */
const paraReactour = ({ nome, titulo, texto }: Passo): StepType => {
  const doExemplo = PASSOS_DO_EXEMPLO.includes(nome)
  return {
    selector: alvo(nome),
    // No exemplo nada é clicável: os lotes são fictícios.
    // (Sem resizeObservables: o observador do Reactour guarda a busca feita ao
    // desenhar o passo; quando o passo abre uma janela, essa busca ainda não
    // achou nada e ele zerava o destaque para o canto da tela, por cima da
    // medida certa. A nova busca fica com o SincronizarTutorial.)
    stepInteraction: !doExemplo,
    content: ({ setIsOpen }) => (
      <PassoTutorial titulo={titulo} onSair={() => setIsOpen(false)}>
        {texto}
      </PassoTutorial>
    )
  }
}

/**
 * Passos do tutorial, montados na hora de abrir. Os tarjamentos são explicados
 * sempre, sobre lotes fictícios; o histórico só entra se já estiver na tela.
 */
export function montarPassos(): StepType[] {
  const passos: Passo[] = [
    passo(
      'inicio',
      'Bem-vindo ao Tarjador',
      <>
        <p>Este guia mostra, em poucos passos, como cobrir dados pessoais em PDFs.</p>
        <p>Você pode sair em qualquer etapa: pelo link abaixo, pelo X, pela tecla Esc ou clicando fora do destaque.</p>
      </>
    ),
    passo(
      'opcoes',
      'Opções',
      <>
        <p>
          <strong>Scan de baixa qualidade:</strong> para documentos mal digitalizados. Tarja a linha a partir do
          rótulo (CPF, RG...) quando o número não foi lido.
        </p>
        <p>
          <strong>PDF 100% digital:</strong> pula a leitura de imagens (OCR) e fica bem mais rápido.
        </p>
        <p>O ícone ⓘ ao lado de cada uma explica de novo.</p>
      </>
    ),
    passo(
      'o-que-tarjar',
      'O que tarjar',
      <>
        <p>As etiquetas mostram os tipos de dado que serão cobertos.</p>
        <p>
          Clique em <strong>Editar</strong> para marcar ou desmarcar. Sua escolha fica salva para a próxima vez.
        </p>
      </>
    ),
    passo(
      'upload',
      'PDFs do processo',
      <>
        <p>Selecione ou arraste os PDFs, um ou vários de uma vez.</p>
        <p>Um arquivo repetido, ou que já está sendo tarjado, não entra de novo.</p>
      </>
    ),
    passo(
      'tarjar',
      'Tarjar',
      <>
        <p>
          Com algum PDF escolhido, o botão <strong>Tarjar</strong> ativa. Ao lado aparece quantas páginas serão
          processadas; envios muito grandes ganham um aviso de tempo.
        </p>
        <p>Dá para enviar mais PDFs enquanto outros são tarjados.</p>
      </>
    ),

    // --- Tarjamentos, sobre os lotes fictícios do exemplo ---
    passo(
      'tarjamentos',
      'Tarjamentos',
      <>
        <p>
          Depois de enviar, os lotes aparecem nesta barra (no celular, em tela cheia). Os que você vê agora são um{' '}
          <strong>exemplo, com dados fictícios</strong>.
        </p>
        <p>O X minimiza a barra para um botão no canto.</p>
      </>
    ),
    passo(
      'exemplo-andamento',
      'Lote sendo tarjado',
      <>
        <p>Enquanto o PDF é tarjado, a barra mostra a página que está sendo lida.</p>
        <p>
          Os lotes menores passam na frente na fila. <strong>Cancelar</strong> interrompe na hora e apaga os arquivos
          do lote.
        </p>
      </>
    ),
    passo(
      'exemplo-conferencia',
      'Conferência',
      <>
        <p>
          Algumas páginas pedem um olhar humano: por exemplo, quando cita &ldquo;CPF&rdquo; mais vezes do que o número
          de tarjas, ou quando o número foi lido com pouca confiança.
        </p>
        <p>
          <strong>Abrir conferência</strong> lista essas páginas, com o motivo. Em cada uma,{' '}
          <strong>Ver página</strong> abre a página já tarjada. Veja a seguir.
        </p>
      </>
    ),

    // --- Ver página (janela de prévia do exemplo) ---
    passo(
      'previa-imagem',
      'Ver página',
      <>
        <p>
          Esta é a página como ficou no PDF tarjado. As <strong>faixas pretas</strong> são as tarjas: os dados embaixo
          delas foram apagados de verdade, não só cobertos.
        </p>
        <p>Confira se nenhum dado pessoal ficou de fora.</p>
      </>
    ),
    passo(
      'previa-pendencia',
      'O que conferir',
      <p>
        Acima da imagem aparece o motivo de a página precisar de conferência, para você saber o que procurar. Aqui, a
        palavra &ldquo;CPF&rdquo; aparece mais vezes do que o número de tarjas: na cláusula 3ª ela é citada sem número,
        e está tudo certo.
      </p>
    ),
    passo(
      'previa-navegacao',
      'Próximas páginas',
      <p>
        Os botões <strong>Página 5</strong> levam à próxima página que pede conferência, sem fechar a janela.{' '}
        <strong>Baixar PDF</strong> baixa o arquivo inteiro.
      </p>
    ),

    // --- Baixar ---
    passo(
      'exemplo-baixar',
      'Baixar o PDF tarjado',
      <p>
        Também dá para baixar direto pelo cartão do arquivo, sem abrir a página. Os PDFs tarjados ficam disponíveis por
        30 minutos depois de prontos.
      </p>
    ),
    passo(
      'download-opcoes',
      'Concluir ou só baixar',
      <>
        <p>Ao baixar, esta janela pergunta o que fazer com o arquivo:</p>
        <p>
          <strong>Baixar e concluir</strong>: ele sai dos tarjamentos e vai para o histórico.{' '}
          <strong>Só baixar</strong>: continua aqui, para conferir ou baixar de novo. <strong>Cancelar</strong> não
          baixa nada.
        </p>
      </>
    )
  ]

  if (existe('historico')) {
    passos.push(
      passo(
        'historico',
        'Tarjamentos concluídos',
        <p>
          Os arquivos baixados e concluídos ficam registrados aqui. <strong>Limpar lista</strong> apaga só o
          registro, não os PDFs que você baixou.
        </p>
      )
    )
  }

  passos.push(
    passo(
      'tutorial',
      'Pronto!',
      <p>
        Para rever este guia quando quiser, clique em <strong>Tutorial</strong>.
      </p>
    )
  )

  return passos.map(paraReactour)
}
