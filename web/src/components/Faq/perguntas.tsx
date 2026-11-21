import type { AccordionItem } from '../../ui/Accordion/types'
import { EQUIPE } from '../../services/ambiente'
import { ListaContatos } from '../Equipe'

export interface GrupoPerguntas {
  titulo: string
  perguntas: AccordionItem[]
}

/**
 * Perguntas frequentes, por assunto. O Tarjador roda num servidor do ITI e é
 * acessado pela intranet; as respostas descrevem o que o sistema faz de fato.
 */
export const GRUPOS_FAQ: GrupoPerguntas[] = [
  {
    titulo: 'Segurança dos arquivos',
    perguntas: [
      {
        id: 'onde-processa',
        title: 'Para onde vão os PDFs que eu envio?',
        content: (
          <>
            <p>
              Para um servidor do ITI, dentro da rede do órgão. O Tarjador é acessado pela intranet, e o tarjamento
              inteiro acontece nesse servidor.
            </p>
            <p>
              Os arquivos não passam por nuvem nem por serviço de terceiros. A leitura de texto em imagens (OCR) também
              roda no próprio servidor.
            </p>
          </>
        )
      },
      {
        id: 'quem-ve',
        title: 'Outras pessoas veem os documentos que eu envio?',
        content: (
          <p>
            Pela tela, não. Cada pessoa acompanha só os lotes que ela mesma enviou, na própria aba do navegador; não há
            lista de lotes de outras pessoas.
          </p>
        )
      },
      {
        id: 'guardado',
        title: 'Os arquivos ficam guardados no servidor?',
        content: (
          <p>
            Não. O PDF original é apagado assim que é processado, e o tarjado fica disponível por 30 minutos depois de
            pronto, para você baixar. Cancelar ou apagar um lote apaga os arquivos dele na hora.
          </p>
        )
      },
      {
        id: 'remover-tarja',
        title: 'Dá para remover uma tarja depois de aplicada?',
        content: (
          <p>
            Não. A tarja não é só um retângulo por cima: o texto e a imagem embaixo dela são apagados do PDF. Ninguém
            consegue recuperar o dado a partir do arquivo tarjado. Se tarjou algo por engano, tarje de novo a partir do
            original.
          </p>
        )
      },
      {
        id: 'metadados',
        title: 'E os metadados e anexos do PDF?',
        content: (
          <p>
            Os metadados (autor, título, programa que gerou o arquivo) são limpos no PDF tarjado. Arquivos anexados
            dentro do PDF não são tarjados: quando existem, a conferência avisa.
          </p>
        )
      }
    ]
  },
  {
    titulo: 'Tarjamento',
    perguntas: [
      {
        id: 'o-que-tarja',
        title: 'Quais dados são tarjados?',
        content: (
          <p>
            Os tipos que aparecem em <strong>O que tarjar</strong>, como CPF, documentos de identidade, e-mail,
            telefone, endereço e dados bancários. Clique em <strong>Editar</strong> para escolher; a escolha fica
            salva neste navegador para a próxima vez.
          </p>
        )
      },
      {
        id: 'scan',
        title: 'Funciona com documento digitalizado?',
        content: (
          <>
            <p>
              Sim. O texto dentro de imagens é lido por OCR. Para scans ruins, ligue{' '}
              <strong>Scan de baixa qualidade</strong>: ele tarja a linha a partir do rótulo (CPF, RG...) quando o
              número não foi lido.
            </p>
            <p>
              Se o PDF é todo digital (gerado direto do sistema, sem imagens escaneadas), ligue{' '}
              <strong>PDF 100% digital</strong>: o OCR é pulado e fica bem mais rápido.
            </p>
          </>
        )
      },
      {
        id: 'fila',
        title: 'Por que meu tarjamento está na fila?',
        content: (
          <p>
            O servidor é compartilhado por todos que usam o Tarjador no órgão, e os tarjamentos são feitos um de cada
            vez. Os envios menores passam na frente, para um documento curto não esperar atrás de um processo de
            centenas de páginas. Em horários de mais movimento, a espera pode ser maior.
          </p>
        )
      },
      {
        id: 'varios',
        title: 'Posso enviar vários PDFs, ou mais enquanto outros são tarjados?',
        content: (
          <p>
            Sim. Cada envio aceita até 500 MB. Um arquivo repetido, ou que já está sendo tarjado, não entra de novo.
          </p>
        )
      },
      {
        id: 'cancelar',
        title: 'Como interrompo um tarjamento?',
        content: (
          <p>
            Clique em <strong>Cancelar</strong> no lote. O processamento para na hora e os arquivos do lote são
            apagados do servidor.
          </p>
        )
      }
    ]
  },
  {
    titulo: 'Conferência',
    perguntas: [
      {
        id: 'por-que-conferir',
        title: 'Por que algumas páginas pedem conferência?',
        content: (
          <p>
            Quando há sinal de que algo pode ter escapado: a página cita &ldquo;CPF&rdquo; (ou outro tipo) mais vezes
            do que o número de tarjas, a página é uma imagem em que o OCR não achou nada, ou um número foi lido com
            pouca confiança. Abra a página, confira e marque <strong>Aprovada</strong> para controlar o que falta.
          </p>
        )
      },
      {
        id: 'faltou',
        title: 'Um dado ficou sem tarja, ou coberto só em parte. O que faço?',
        content: (
          <p>
            Em <strong>Ver página</strong>, clique em <strong>Tarjar à mão</strong>, arraste sobre o dado e clique em{' '}
            <strong>Aplicar</strong>. Funciona em qualquer página, não só nas que pedem conferência. Essa tarja também
            é definitiva.
          </p>
        )
      }
    ]
  },
  {
    titulo: 'Uso da tela',
    perguntas: [
      {
        id: 'f5',
        title: 'Se eu atualizar a página, perco o que está sendo tarjado?',
        content: (
          <p>
            Não: o tarjamento continua no servidor e a tela retoma os lotes desta aba, com as páginas que você já
            aprovou. Se fechar a aba, os lotes deixam de aparecer. Se o servidor for reiniciado (numa manutenção, por
            exemplo), os tarjamentos em andamento se perdem e precisam ser enviados de novo.
          </p>
        )
      },
      {
        id: 'historico',
        title: 'O que é o histórico de tarjamentos concluídos?',
        content: (
          <p>
            Ao baixar com <strong>Baixar e concluir</strong>, o arquivo sai dos tarjamentos e fica registrado no
            histórico (nome, páginas, tarjas e tipos). O registro fica só neste navegador; os PDFs não ficam guardados.{' '}
            <strong>Limpar lista</strong> apaga o registro.
          </p>
        )
      },
      {
        id: 'fora-do-ar',
        title: 'O Tarjador não respondeu. O que faço?',
        content: (
          <p>
            Recarregue a página em alguns minutos: o servidor pode estar reiniciando. Se continuar, fale com a equipe
            responsável (veja a próxima pergunta).
          </p>
        )
      },
      {
        id: 'contato',
        title: 'Com quem falo em caso de dúvida ou problema?',
        content: (
          <>
            <p>
              Com a equipe responsável pelo Tarjador, da <strong>{EQUIPE.sigla}</strong>:
            </p>
            <ListaContatos />
            <p>
              Conte o que estava fazendo e a mensagem que apareceu na tela. Não envie por e-mail o PDF com dados
              pessoais.
            </p>
          </>
        )
      },
      {
        id: 'tutorial',
        title: 'Tem um passo a passo?',
        content: (
          <p>
            Sim. Clique em <strong>Tutorial</strong>, no topo da tela, para um guia por todas as etapas, com um exemplo
            de dados fictícios. Dá para sair em qualquer etapa.
          </p>
        )
      }
    ]
  }
]
