import React, { useId, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUpload, faFile, faXmark } from '@fortawesome/free-solid-svg-icons'
import { fileKey } from './fileKey'
import type { UploadProps } from './types'
import styles from './Upload.module.scss'

interface Skipped {
  name: string
  reason: string
}

export const Upload: React.FC<UploadProps> = ({
  label,
  buttonText = 'Selecione o(s) arquivo(s)',
  helperText = 'Clique ou Arraste os arquivos para cima do componente Upload',
  accept,
  multiple = false,
  disabled = false,
  rejectFile,
  onFilesSelected,
  className = ''
}) => {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  // Arquivos recusados na última adição, com o motivo
  const [skipped, setSkipped] = useState<Skipped[]>([])

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const incoming = Array.from(fileList)

    // O mesmo arquivo não entra duas vezes (nem se já estava na lista, nem
    // repetido na mesma seleção), e quem usa o componente pode recusar outros.
    const seen = new Set(multiple ? files.map(fileKey) : [])
    const added: File[] = []
    const refused: Skipped[] = []
    for (const file of incoming) {
      const key = fileKey(file)
      const reason = seen.has(key) ? 'já está na lista' : rejectFile?.(file)
      if (reason) {
        if (!refused.some(r => r.name === file.name && r.reason === reason)) refused.push({ name: file.name, reason })
      } else {
        seen.add(key)
        added.push(file)
      }
    }
    setSkipped(refused)
    if (added.length === 0) return

    const nextFiles = multiple ? [...files, ...added] : added
    setFiles(nextFiles)
    onFilesSelected?.(nextFiles)
  }

  const removeFile = (index: number) => {
    const nextFiles = files.filter((_, fileIndex) => fileIndex !== index)
    setSkipped([])
    setFiles(nextFiles)
    onFilesSelected?.(nextFiles)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (disabled) return
    addFiles(event.dataTransfer.files)
  }

  return (
    <div className={`${styles['upload']}${className ? ` ${className}` : ''}`}>
      {label && (
        <label className={styles['upload-label']} htmlFor={inputId}>
          {label}
        </label>
      )}

      <div
        className={`${styles['upload-dropzone']}${isDragging ? ` ${styles['is-dragging']}` : ''}${disabled ? ` ${styles['is-disabled']}` : ''}`}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={event => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <FontAwesomeIcon icon={faUpload} className={styles['upload-icon']} />
        <span className={styles['upload-text']}>{buttonText}</span>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className={styles['upload-input']}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={event => {
            addFiles(event.target.files)
            // Limpa o campo: sem isso, escolher de novo um arquivo removido não dispara onChange
            event.target.value = ''
          }}
        />
      </div>

      {helperText && <p className={styles['upload-helper']}>{helperText}</p>}

      {skipped.length > 0 && (
        <p className={styles['upload-repeated']} role="status">
          {skipped.length === 1 ? 'Não adicionado: ' : 'Não adicionados: '}
          {skipped.map(s => `${s.name} (${s.reason})`).join(', ')}.
        </p>
      )}

      {files.length > 0 && (
        <ul className={styles['upload-file-list']}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <FontAwesomeIcon icon={faFile} style={{ width: 16, height: 16 }} />
              <span className={styles['upload-file-name']}>{file.name}</span>
              <button
                type="button"
                className={styles['upload-file-remove']}
                aria-label={`Remover ${file.name}`}
                onClick={() => removeFile(index)}
              >
                <FontAwesomeIcon icon={faXmark} style={{ width: 14, height: 14 }} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
