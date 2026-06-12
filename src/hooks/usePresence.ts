import { useEffect, useState } from 'react'
import { isUserOnline } from '@/lib/api'

/** Poll a single user's online status. Cheap RPC; 30s interval. */
export function useUserPresence(userId: string | undefined | null, intervalMs = 30_000) {
  const [online, setOnline] = useState(false)

  useEffect(() => {
    if (!userId) {
      setOnline(false)
      return
    }
    let alive = true
    const check = async () => {
      const o = await isUserOnline(userId)
      if (alive) setOnline(o)
    }
    check()
    const t = setInterval(check, intervalMs)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [userId, intervalMs])

  return online
}
