import { useEffect } from 'react'

/** Each static page set its own <title>; routes do the same here. */
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return undefined
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
