/**
 * O Tarjador roda num servidor do ITI e é acessado pela intranet. As mensagens
 * de falha dizem à pessoa a quem recorrer; só em desenvolvimento (npm run dev)
 * elas dão o comando para subir a API.
 */
export const EM_DESENVOLVIMENTO = import.meta.env.DEV

export interface Contato {
  nome: string
  email: string
}

const CONTATOS: Contato[] = [
  { nome: 'Alessandro Dias', email: 'alessandro.dias@iti.gov.br' },
  { nome: 'Itamar Joire', email: 'itamar.nascimento@iti.gov.br' },
  { nome: 'Karen Macedo', email: 'karen.macedo@iti.gov.br' }
]

/**
 * Equipe responsável pelo Tarjador: o contato para dúvidas e problemas.
 * Os nomes aparecem sempre em ordem alfabética, mesmo se alguém for incluído fora de ordem.
 */
export const EQUIPE = {
  sigla: 'COIAP/DAFN',
  contatos: [...CONTATOS].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** A quem recorrer quando o serviço falha. */
export const SUPORTE = `a equipe responsável (${EQUIPE.sigla}), pelo link no rodapé da página`

/** Ex.: "Se continuar, fale com a equipe responsável (COIAP/DAFN), pelo link no rodapé da página." */
export const AVISE_O_SUPORTE = `Se continuar, fale com ${SUPORTE}.`
