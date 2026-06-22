import { Upload, Search, Copy, FileText, X } from 'lucide-react'
import { MergedResultItem } from '../types'
import { parseOutputFileInWorker } from '../utils/xlsxWorkerClient'
import { useFeedback } from './FeedbackProvider'

interface OutputSectionProps {
  selectedFiles: File[]
  setSelectedFiles: (value: File[] | ((prev: File[]) => File[])) => void
  combinedUIDs: Set<string>
  setCombinedUIDs: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  combinedTXIDs: Set<string>
  setCombinedTXIDs: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  combinedAddresses: Set<string>
  setCombinedAddresses: (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  mergedResultList: MergedResultItem[]
  setMergedResultList: (value: MergedResultItem[] | ((prev: MergedResultItem[]) => MergedResultItem[])) => void
  isAnalyzing: boolean
  setIsAnalyzing: (value: boolean) => void
}

export default function OutputSection({
  selectedFiles,
  setSelectedFiles,
  combinedUIDs,
  setCombinedUIDs,
  combinedTXIDs,
  setCombinedTXIDs,
  combinedAddresses,
  setCombinedAddresses,
  mergedResultList,
  setMergedResultList,
  isAnalyzing,
  setIsAnalyzing
}: OutputSectionProps) {
  const { notify } = useFeedback()

  const handleMultipleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newFiles = Array.from(files).filter(file => 
      !selectedFiles.find(f => f.name === file.name && f.size === file.size)
    )

    setSelectedFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const readXlsxFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      parseOutputFileInWorker(file)
        .then(parsed => {
          const newUIDs = new Set(parsed.uids)
          const newTXIDs = new Set(parsed.txids)
          const newAddresses = new Set(parsed.addresses)
          const newResults: MergedResultItem[] = parsed.results

          setCombinedUIDs(prev => {
            const updated = new Set(prev)
            newUIDs.forEach(uid => updated.add(uid))
            return updated
          })
          setCombinedTXIDs(prev => {
            const updated = new Set(prev)
            newTXIDs.forEach(txid => updated.add(txid))
            return updated
          })
          setCombinedAddresses(prev => {
            const updated = new Set(prev)
            newAddresses.forEach(addr => updated.add(addr))
            return updated
          })
          setMergedResultList(prev => [...prev, ...newResults])
          resolve()
        })
        .catch(reject)
    })
  }

  const analyzeFiles = async () => {
    if (selectedFiles.length === 0) {
      notify('尚未上傳檔案，無法分析', 'warning')
      return
    }

    setIsAnalyzing(true)
    setCombinedUIDs(() => new Set())
    setCombinedTXIDs(() => new Set())
    setCombinedAddresses(() => new Set())
    setMergedResultList([])

    try {
      await Promise.all(selectedFiles.map(file => readXlsxFile(file)))
    } catch (err) {
      console.error('解析 XLSX 失敗', err)
      notify('解析檔案失敗，請檢查檔案格式', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyAllUniqueUIDs = () => {
    if (combinedUIDs.size === 0) {
      notify('目前沒有任何 UID', 'warning')
      return
    }
    const textToCopy = Array.from(combinedUIDs).join('\n')
    navigator.clipboard.writeText(textToCopy)
      .then(() => notify('已複製所有 UID（排除重複）', 'success'))
      .catch(err => {
        console.error('複製失敗', err)
        notify('複製失敗，請稍後重試', 'error')
      })
  }

  const copyAllTxidAndAddress = () => {
    const unionSet = new Set([...combinedTXIDs, ...combinedAddresses])
    if (unionSet.size === 0) {
      notify('目前沒有任何 TXID 或充值地址', 'warning')
      return
    }
    const textToCopy = Array.from(unionSet).join('\n')
    navigator.clipboard.writeText(textToCopy)
      .then(() => notify('已複製所有 TXID 與充值地址（排除重複）', 'success'))
      .catch(err => {
        console.error('複製失敗', err)
        notify('複製失敗，請稍後重試', 'error')
      })
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <h1 className="section-title">調證結果輸出</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
        {/* 主要操作區 */}
        <div className="lg:col-span-2">
          <div className="card flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4 flex-shrink-0">
              <Upload className="w-5 h-5 text-slate-500" />
              <h2 className="text-lg font-semibold">上傳文件</h2>
            </div>
            
            <div className="mb-4 flex-shrink-0">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                選擇 XLSX 文件（可多選）
              </label>
              <input
                type="file"
                accept=".xlsx"
                multiple
                onChange={handleMultipleFiles}
                className="input"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="space-y-2 flex-1 min-h-0 flex flex-col mb-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex-shrink-0">
                  已選擇 {selectedFiles.length} 個文件
                </div>
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between glass rounded-lg p-3 flex-shrink-0"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={analyzeFiles}
              disabled={selectedFiles.length === 0 || isAnalyzing}
              className="btn btn-primary w-full flex items-center justify-center gap-2 mt-auto flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              {isAnalyzing ? '分析中...' : '開始分析'}
            </button>
          </div>
        </div>

        {/* 快捷操作和統計面板 */}
        <div className="flex flex-col space-y-3">
          <div className="card-compact flex-shrink-0">
            <h3 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">快捷操作</h3>
            <div className="space-y-1.5">
              <button
                onClick={copyAllUniqueUIDs}
                className="quick-action w-full justify-start text-xs py-1.5"
                disabled={combinedUIDs.size === 0}
              >
                <Copy className="w-3.5 h-3.5" />
                複製所有 UID
              </button>
              <button
                onClick={copyAllTxidAndAddress}
                className="quick-action w-full justify-start text-xs py-1.5"
                disabled={combinedTXIDs.size === 0 && combinedAddresses.size === 0}
              >
                <Copy className="w-3.5 h-3.5" />
                複製 TXID/地址
              </button>
            </div>
          </div>

          <div className="card flex-1 min-h-0">
            <h3 className="text-xs font-semibold mb-2 text-gray-700 dark:text-gray-300">統計信息</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600 dark:text-gray-400">總資料數</span>
                <span className="text-base font-bold text-slate-700 dark:text-slate-300">
                  {mergedResultList.length}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600 dark:text-gray-400">涉案 UID</span>
                <span className="text-base font-bold text-purple-600 dark:text-purple-400">
                  {combinedUIDs.size}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 分析結果 */}
      {mergedResultList.length > 0 && (
        <div className="card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
              分析結果
            </h3>
            <div className="flex gap-2">
              <span className="badge">{mergedResultList.length} 筆</span>
              <span className="badge">{combinedUIDs.size} UID</span>
            </div>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 custom-scrollbar">
            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
              <table className="table min-w-full">
                <thead>
                  <tr>
                    <th className="w-24 sm:w-32">UID</th>
                    <th className="w-20 sm:w-24">Type</th>
                    <th>Information</th>
                  </tr>
                </thead>
              <tbody>
                {mergedResultList.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <code className="text-xs font-mono bg-gray-100/50 dark:bg-gray-800/50 px-2 py-1 rounded">
                        {item.uid}
                      </code>
                    </td>
                    <td>
                      <span className="badge">{item.type}</span>
                    </td>
                    <td>
                      <code className="text-sm font-mono bg-gray-100/50 dark:bg-gray-800/50 px-2 py-1 rounded">
                        {item.info}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {mergedResultList.length === 0 && !isAnalyzing && (
        <div className="card text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">上傳文件後點擊「開始分析」查看結果</p>
        </div>
      )}
    </div>
  )
}
