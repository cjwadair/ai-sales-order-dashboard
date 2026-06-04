import { useEffect, useRef, type RefObject } from 'react'

export function useClickOutside(
  ref: RefObject<Element | null>,
  handler: () => void,
  enabled = true,
) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return

    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handlerRef.current()
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [ref, enabled])
}
