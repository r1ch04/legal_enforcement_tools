import { useState, useEffect, lazy, Suspense } from 'react'
import Navbar from './components/Navbar'
import { InfoItem, InfoType, MergedResultItem, ExcelRow, AnalysisResult } from './types'

const InputSection = lazy(() => import('./components/InputSection'))
const OutputSection = lazy(() => import('./components/OutputSection'))
const AnalysisSection = lazy(() => import('./components/AnalysisSection'))
const CasePackSection = lazy(() => import('./components/CasePackSection'))

type Section = 'input' | 'output' | 'analysis' | 'case-pack'

function App() {
  const [currentSection, setCurrentSection] = useState<Section>('input')
  const [darkMode, setDarkMode] = useState(false)

  // InputSection 狀態
  const [caseNumber, setCaseNumber] = useState('')
  const [infoType, setInfoType] = useState<InfoType>('充值地址')
  const [infoDetail, setInfoDetail] = useState('')
  const [phonePrefix, setPhonePrefix] = useState('886')
  const [bulkInput, setBulkInput] = useState('')
  const [infoList, setInfoList] = useState<InfoItem[]>([])
  const [showSuccess, setShowSuccess] = useState(false)

  // OutputSection 狀態
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [combinedUIDs, setCombinedUIDs] = useState<Set<string>>(new Set())
  const [combinedTXIDs, setCombinedTXIDs] = useState<Set<string>>(new Set())
  const [combinedAddresses, setCombinedAddresses] = useState<Set<string>>(new Set())
  const [mergedResultList, setMergedResultList] = useState<MergedResultItem[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // AnalysisSection 狀態
  const [excelData, setExcelData] = useState<ExcelRow[]>([])
  const [startDateA, setStartDateA] = useState('')
  const [endDateA, setEndDateA] = useState('')
  const [startDateB, setStartDateB] = useState('')
  const [endDateB, setEndDateB] = useState('')
  const [triggerPercentage, setTriggerPercentage] = useState(50)
  const [topN, setTopN] = useState(5)
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([])

  useEffect(() => {
    // 檢測系統主題
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDarkMode(prefersDark)
  }, [])

  useEffect(() => {
    // 應用深色模式
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    if (currentSection !== 'case-pack') return

    const warmupCasePackDeps = () => {
      void import('jszip')
      void import('docx')
    }

    const win = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (typeof win.requestIdleCallback === 'function') {
      const idleId = win.requestIdleCallback(warmupCasePackDeps)
      return () => win.cancelIdleCallback?.(idleId)
    }

    const timer = setTimeout(warmupCasePackDeps, 50)
    return () => clearTimeout(timer)
  }, [currentSection])

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev)
  }

  return (
    <div className="min-h-screen transition-colors duration-200">
      <Navbar 
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <Suspense
          fallback={
            <div className="w-full max-w-7xl mx-auto">
              <div className="card text-sm text-gray-600 dark:text-gray-300">載入中...</div>
            </div>
          }
        >
          {currentSection === 'input' && (
            <InputSection
              caseNumber={caseNumber}
              setCaseNumber={setCaseNumber}
              infoType={infoType}
              setInfoType={setInfoType}
              infoDetail={infoDetail}
              setInfoDetail={setInfoDetail}
              phonePrefix={phonePrefix}
              setPhonePrefix={setPhonePrefix}
              bulkInput={bulkInput}
              setBulkInput={setBulkInput}
              infoList={infoList}
              setInfoList={setInfoList}
              showSuccess={showSuccess}
              setShowSuccess={setShowSuccess}
            />
          )}
          {currentSection === 'output' && (
            <OutputSection
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              combinedUIDs={combinedUIDs}
              setCombinedUIDs={setCombinedUIDs}
              combinedTXIDs={combinedTXIDs}
              setCombinedTXIDs={setCombinedTXIDs}
              combinedAddresses={combinedAddresses}
              setCombinedAddresses={setCombinedAddresses}
              mergedResultList={mergedResultList}
              setMergedResultList={setMergedResultList}
              isAnalyzing={isAnalyzing}
              setIsAnalyzing={setIsAnalyzing}
            />
          )}
          {currentSection === 'analysis' && (
            <AnalysisSection
              excelData={excelData}
              setExcelData={setExcelData}
              startDateA={startDateA}
              setStartDateA={setStartDateA}
              endDateA={endDateA}
              setEndDateA={setEndDateA}
              startDateB={startDateB}
              setStartDateB={setStartDateB}
              endDateB={endDateB}
              setEndDateB={setEndDateB}
              triggerPercentage={triggerPercentage}
              setTriggerPercentage={setTriggerPercentage}
              topN={topN}
              setTopN={setTopN}
              analysisResults={analysisResults}
              setAnalysisResults={setAnalysisResults}
            />
          )}
          {currentSection === 'case-pack' && <CasePackSection />}
        </Suspense>
      </main>
    </div>
  )
}

export default App
