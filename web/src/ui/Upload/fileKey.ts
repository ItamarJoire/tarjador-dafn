/** Identifica o mesmo arquivo escolhido mais de uma vez: nome, tamanho e data de modificação. */
export const fileKey = (file: File) => `${file.name}|${file.size}|${file.lastModified}`
