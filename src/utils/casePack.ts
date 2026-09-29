import { CasePackDocxFieldConfig, CasePackDocxFieldKey, CasePackItem } from '../types'

let casePackDepsPromise: Promise<{
  JSZip: any
  Document: (typeof import('docx'))['Document']
  Packer: (typeof import('docx'))['Packer']
  Paragraph: (typeof import('docx'))['Paragraph']
  TextRun: (typeof import('docx'))['TextRun']
}> | null = null

function loadCasePackDeps() {
  casePackDepsPromise ??= Promise.all([import('jszip'), import('docx')]).then(
    ([jszipMod, docxMod]) => ({
      JSZip: (jszipMod as any).default ?? jszipMod,
      Document: docxMod.Document,
      Packer: docxMod.Packer,
      Paragraph: docxMod.Paragraph,
      TextRun: docxMod.TextRun
    })
  )
  return casePackDepsPromise
}

export interface CasePackValidationResult {
  id: string
  index: number
  errors: string[]
}

export interface CaseZipOutput {
  caseId: string
  fileName: string
  blob: Blob
}

export interface CaseZipPreview {
  caseId: string
  zipFileName: string
  docxFileName: string
  attachmentPaths: string[]
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

function ensureUniqueName(rawName: string, usedNames: Set<string>): string {
  let name = sanitizeFileName(rawName) || 'untitled'
  if (!usedNames.has(name)) {
    usedNames.add(name)
    return name
  }

  let counter = 1
  const dotIndex = name.lastIndexOf('.')
  const hasExt = dotIndex > 0
  const base = hasExt ? name.slice(0, dotIndex) : name
  const ext = hasExt ? name.slice(dotIndex) : ''

  while (usedNames.has(name)) {
    name = `${base}_${counter}${ext}`
    counter += 1
  }

  usedNames.add(name)
  return name
}

export function extractWorkOrderDate(workOrderNo: string): string {
  const digitsOnly = workOrderNo.replace(/\D/g, '')
  return digitsOnly.slice(0, 8)
}

export function buildCasePackBaseName(agencyName: string, workOrderNo: string): string {
  const workOrderDate = extractWorkOrderDate(workOrderNo)
  return sanitizeFileName(`${agencyName}${workOrderDate}调证`.trim())
}

function getDocxFieldValue(item: CasePackItem, key: CasePackDocxFieldKey): string {
  return item[key]
}

function getDocxFieldLabel(config: CasePackDocxFieldConfig[], key: CasePackDocxFieldKey): string {
  return config.find(field => field.key === key)?.label || key
}

export function validateCasePackItems(
  items: CasePackItem[],
  docxFields: CasePackDocxFieldConfig[]
): CasePackValidationResult[] {
  return items.map((item, index) => {
    const errors: string[] = []
    const workOrderDate = extractWorkOrderDate(item.workOrderNo)
    const baseName = buildCasePackBaseName(item.agencyName, item.workOrderNo)

    if (!item.workOrderNo.trim()) errors.push(`缺少 ${getDocxFieldLabel(docxFields, 'workOrderNo')}`)
    if (!item.agencyName.trim()) errors.push(`缺少 ${getDocxFieldLabel(docxFields, 'agencyName')}`)
    docxFields.forEach(field => {
      if (
        field.key !== 'workOrderNo' &&
        field.key !== 'agencyName' &&
        item.includedDocxFields[field.key] &&
        !getDocxFieldValue(item, field.key).trim()
      ) {
        errors.push(`缺少 ${field.label}`)
      }
    })
    if (workOrderDate.length !== 8) errors.push('工单号無法提取 8 位工单日期')
    if (!baseName) errors.push('司法机构-名稱與工单日期不可為空')

    return {
      id: item.id,
      index,
      errors
    }
  })
}

async function createCaseDocBlob(item: CasePackItem, docxFields: CasePackDocxFieldConfig[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await loadCasePackDeps()

  const createLine = (text: string) =>
    new Paragraph({
      children: [
        new TextRun({
          text,
          size: 28
        })
      ]
    })

  const doc = new Document({
    sections: [
      {
        children: [
          ...docxFields
            .filter(field => item.includedDocxFields[field.key])
            .map(field => createLine(`${field.label}：${getDocxFieldValue(item, field.key)}`)),
          new Paragraph(''),
          new Paragraph('')
        ]
      }
    ]
  })

  return Packer.toBlob(doc)
}

export function getCasePackZipPreviews(items: CasePackItem[]): CaseZipPreview[] {
  const usedZipNames = new Set<string>()

  return items.map(item => {
    const folderName = sanitizeFileName(buildCasePackBaseName(item.agencyName, item.workOrderNo)) || '案件'
    const usedFileNames = new Set<string>()
    const attachmentPaths = item.uploadedFiles.map(file => `${folderName}/${ensureUniqueName(file.name, usedFileNames)}`)
    const zipFileName = ensureUniqueName(`${folderName}.zip`, usedZipNames)

    return {
      caseId: item.id,
      zipFileName,
      docxFileName: `${folderName}.docx`,
      attachmentPaths
    }
  })
}

export async function buildCasePackZipFiles(
  items: CasePackItem[],
  docxFields: CasePackDocxFieldConfig[],
  onProgress?: (completed: number, total: number) => void
): Promise<CaseZipOutput[]> {
  const { JSZip } = await loadCasePackDeps()
  const outputs: CaseZipOutput[] = []
  const usedZipNames = new Set<string>()

  for (const item of items) {
    const zip = new JSZip()
    const rawFolderName = buildCasePackBaseName(item.agencyName, item.workOrderNo) || '案件'
    const folderName = sanitizeFileName(rawFolderName) || '案件'
    const folder = zip.folder(folderName)
    if (!folder) {
      throw new Error(`建立資料夾失敗: ${folderName}`)
    }

    const docBlob = await createCaseDocBlob(item, docxFields)
    zip.file(`${folderName}.docx`, docBlob)

    const usedFileNames = new Set<string>()
    for (const file of item.uploadedFiles) {
      const fileName = ensureUniqueName(file.name, usedFileNames)
      folder.file(fileName, file)
    }

    const zipFileName = ensureUniqueName(`${folderName}.zip`, usedZipNames)
    outputs.push({
      caseId: item.id,
      fileName: zipFileName,
      blob: await zip.generateAsync({ type: 'blob' })
    })
    onProgress?.(outputs.length, items.length)
  }

  return outputs
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
