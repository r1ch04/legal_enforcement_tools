import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastType = 'info' | 'success' | 'error' | 'warning'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ConfirmState {
  title: string
  message: string
  confirmText: string
  cancelText: string
  resolve: (value: boolean) => void
}

interface FeedbackContextValue {
  notify: (message: string, type?: ToastType) => void
  confirm: (options: { title: string; message: string; confirmText?: string; cancelText?: string }) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

function toastClassByType(type: ToastType) {
  switch (type) {
    case 'success':
      return 'border-green-300 text-green-800 dark:border-green-800 dark:text-green-300'
    case 'error':
      return 'border-red-300 text-red-800 dark:border-red-800 dark:text-red-300'
    case 'warning':
      return 'border-yellow-300 text-yellow-800 dark:border-yellow-700 dark:text-yellow-300'
    default:
      return 'border-slate-300 text-slate-800 dark:border-slate-700 dark:text-slate-300'
  }
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, message, type }])
    window.setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id))
    }, 2800)
  }, [])

  const confirm = useCallback(
    (options: { title: string; message: string; confirmText?: string; cancelText?: string }) => {
      return new Promise<boolean>(resolve => {
        setConfirmState({
          title: options.title,
          message: options.message,
          confirmText: options.confirmText || '確認',
          cancelText: options.cancelText || '取消',
          resolve
        })
      })
    },
    []
  )

  const contextValue = useMemo(() => ({ notify, confirm }), [notify, confirm])

  const closeConfirm = (value: boolean) => {
    if (!confirmState) return
    confirmState.resolve(value)
    setConfirmState(null)
  }

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}

      <div className="fixed bottom-5 right-5 z-[90] space-y-2">
        {toasts.map(item => (
          <div key={item.id} className={`glass rounded-xl border px-4 py-2 text-sm ${toastClassByType(item.type)}`}>
            {item.message}
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 px-4">
          <div className="glass-strong w-full max-w-md rounded-2xl p-5">
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">{confirmState.title}</h3>
            <p className="mb-5 text-sm text-gray-700 dark:text-gray-300">{confirmState.message}</p>
            <div className="flex items-center justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => closeConfirm(false)}>
                {confirmState.cancelText}
              </button>
              <button className="btn btn-danger" onClick={() => closeConfirm(true)}>
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)
  if (!context) {
    throw new Error('useFeedback 必須在 FeedbackProvider 內使用')
  }
  return context
}
