// ── Core domain types for nyarch ─────────────────────────────

export interface Profile {
  id: string
  username: string // unique handle, e.g. "example" -> @example
  display_name: string // nickname shown on profile
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  created_at: string
}

export interface Category {
  id: string
  slug: string // e.g. "linux"
  name: string // e.g. "Linux"
  description: string | null
  icon: string // emoji / glyph used in TUI lists
  color: string // accent hex
  post_count?: number
}

export interface Post {
  id: string
  author_id: string
  category_id: string
  title: string
  body: string
  image_url: string | null
  created_at: string
  // joined / computed
  author?: Profile
  category?: Category
  score?: number // upvotes - downvotes
  comment_count?: number
  my_vote?: -1 | 0 | 1
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  body: string
  image_url: string | null
  created_at: string
  author?: Profile
  score?: number
  my_vote?: -1 | 0 | 1
  replies?: Comment[]
}

export interface Vote {
  user_id: string
  post_id: string | null
  comment_id: string | null
  value: -1 | 1
}

export type FriendStatus = 'pending' | 'accepted'

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: FriendStatus
  created_at: string
  // joined profile of "the other person"
  other?: Profile
}

export interface Conversation {
  id: string
  user_a: string
  user_b: string
  created_at: string
  // computed
  other?: Profile
  last_message?: Message
  unread?: number
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string | null
  image_url: string | null // uploaded photo OR giphy url
  is_gif: boolean
  created_at: string
  sender?: Profile
}
