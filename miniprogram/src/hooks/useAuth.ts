import { useSyncExternalStore } from 'react'
import { getAuthSnapshot, subscribeAuth } from '../services/auth'

export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot)
}
