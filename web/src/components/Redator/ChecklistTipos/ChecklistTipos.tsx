import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons'
import { Button } from '../../../ui'
import { Checkbox } from '../../../ui/Checkbox'
import { Modal } from '../../../ui/Modal'
import { idsDoCatalogo, idsPadrao } from '../tiposPadrao'
import type { ChecklistTiposProps } from './types'
import styles from './ChecklistTipos.module.scss'

/**
 * "O que tarjar" no cartão de envio: os tipos marcados aparecem como
 * etiquetas e o botão Editar abre um modal com todos os tipos, separados por
 * grupo do catálogo (GET /api/tipos). As mudanças do modal só valem ao aplicar.
 */
export const ChecklistTipos: React.FC<ChecklistTiposProps> = ({ grupos, value, onChange, disabled = false }) => {
  const todos = idsDoCatalogo(grupos)
  const itens = grupos.flatMap(grupo => grupo.itens)
  const marcadosAgora = new Set(value)

  // Rascunho do modal: null = fechado
  const [rascunho, setRascunho] = useState<string[] | null>(null)
  const noRascunho = new Set(rascunho ?? [])

  // Devolve sempre na ordem do catálogo, para o pedido à API ser estável.
  const alternar = (id: string, marcar: boolean) => {
    const proximos = new Set(rascunho ?? [])
    if (marcar) proximos.add(id)
    else proximos.delete(id)
    setRascunho(todos.filter(item => proximos.has(item)))
  }

  const aplicar = () => {
    if (rascunho) onChange(rascunho)
    setRascunho(null)
  }

  return (
    <div className={`${styles['checklist']}${disabled ? ` ${styles['desabilitado']}` : ''}`} data-tour="o-que-tarjar">
      <div className={styles['topo']}>
        <span id="rotulo-o-que-tarjar" className={styles['rotulo']}>
          O que tarjar
        </span>
        <span className={styles['contagem']}>
          {value.length} de {todos.length}
        </span>
        {!disabled && (
          <button type="button" className={styles['editar']} onClick={() => setRascunho(value)}>
            <FontAwesomeIcon icon={faPenToSquare} />
            <span>Editar</span>
          </button>
        )}
      </div>

      {value.length > 0 ? (
        <ul className={styles['etiquetas']} aria-labelledby="rotulo-o-que-tarjar">
          {itens
            .filter(item => marcadosAgora.has(item.id))
            .map(item => (
              <li key={item.id} className={styles['etiqueta']}>
                {item.rotulo}
              </li>
            ))}
        </ul>
      ) : (
        <span className={styles['vazio']}>Nenhum tipo marcado. Clique em Editar para escolher.</span>
      )}

      <Modal
        open={rascunho !== null}
        onClose={() => setRascunho(null)}
        title="O que tarjar"
        size="large"
        footer={
          <div className={styles['modal-acoes']}>
            <span className={styles['modal-contagem']}>
              {rascunho?.length ?? 0} de {todos.length} marcados
            </span>
            <Button variant="secondary" onClick={() => setRascunho(null)}>
              Cancelar
            </Button>
            <Button onClick={aplicar} disabled={(rascunho?.length ?? 0) === 0}>
              Aplicar
            </Button>
          </div>
        }
      >
        <div className={styles['modal-atalhos']}>
          <button type="button" className={styles['atalho']} onClick={() => setRascunho(todos)}>
            Marcar todos
          </button>
          <button type="button" className={styles['atalho']} onClick={() => setRascunho(idsPadrao(grupos))}>
            Restaurar padrão
          </button>
          <button type="button" className={styles['atalho']} onClick={() => setRascunho([])}>
            Desmarcar todos
          </button>
        </div>

        <div className={styles['grupos']}>
          {grupos.map(grupo => (
            <div key={grupo.id} role="group" aria-labelledby={`grupo-${grupo.id}`} className={styles['grupo']}>
              <span id={`grupo-${grupo.id}`} className={styles['grupo-titulo']}>
                {grupo.rotulo}
              </span>
              <div className={styles['itens']}>
                {grupo.itens.map(item => (
                  <Checkbox
                    key={item.id}
                    label={item.rotulo}
                    checked={noRascunho.has(item.id)}
                    onChange={marcar => alternar(item.id, marcar)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {rascunho?.length === 0 && (
          <p className={styles['modal-alerta']}>Marque ao menos um tipo de dado para aplicar.</p>
        )}
      </Modal>
    </div>
  )
}
