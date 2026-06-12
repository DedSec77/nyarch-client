import { supabase } from './supabase'

export async function castVote(target: 'post' | 'comment', id: string, value: -1 | 1) {
  return supabase.rpc('cast_vote', { target_type: target, target_id: id, v: value })
}

export async function getOrCreateConversation(otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', { other_id: otherId })
  if (error) {
    console.error('conversation error', error)
    return null
  }
  return data as string
}
