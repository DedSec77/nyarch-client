import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, BUCKET_POSTS } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'
import { FullSpinner } from '@/components/ui/Spinner'
import type { Category } from '@/types'

export function SubmitPage() {
  const { user, profile } = useAuth()
  const { id } = useParams<{ id: string }>()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [cats, setCats] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [existingImage, setExistingImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(editing)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_categories').then(({ data }) => {
      const list = (data as Category[]) ?? []
      setCats(list)
      if (!editing && list[0]) setCategoryId(list[0].id)
    })
  }, [editing])

  // load post for editing
  useEffect(() => {
    if (!editing || !id) return
    setLoading(true)
    supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setError('Post not found')
          setLoading(false)
          return
        }
        // only the author (or an admin) may edit
        if (data.author_id !== user?.id && !profile?.is_admin) {
          navigate(`/post/${id}`, { replace: true })
          return
        }
        setTitle(data.title)
        setBody(data.body ?? '')
        setCategoryId(data.category_id)
        setExistingImage(data.image_url ?? null)
        setLoading(false)
      })
  }, [editing, id, user, profile, navigate])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setExistingImage(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !categoryId || !title.trim()) return
    setBusy(true)
    setError(null)

    let imageUrl: string | null = existingImage
    if (file) {
      const { url, error } = await uploadImage(BUCKET_POSTS, user.id, file)
      if (error) {
        setError('Failed to upload image: ' + error)
        setBusy(false)
        return
      }
      imageUrl = url
    }

    if (editing && id) {
      const { error } = await supabase
        .from('posts')
        .update({
          category_id: categoryId,
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl,
          edited_at: new Date().toISOString(),
        })
        .eq('id', id)
      setBusy(false)
      if (error) {
        setError(error.message)
        return
      }
      navigate(`/post/${id}`)
      return
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        category_id: categoryId,
        title: title.trim(),
        body: body.trim(),
        image_url: imageUrl,
      })
      .select('id')
      .single()

    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(`/post/${data.id}`)
  }

  if (loading) return <FullSpinner label="loading post" />

  const shownImage = preview || existingImage

  return (
    <div className="mx-auto max-w-2xl">
      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>{editing ? '~/posts/edit' : '~/posts/new'}</span>
        </div>
        <form onSubmit={submit} className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input"
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id} className="bg-term-850">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ title</label>
            <input
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="What's the post about?"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ body (markdown-ish text)</label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="input resize-y font-mono"
              placeholder="Describe it in detail…&#10;&#10;```code blocks work too```"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ attach image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={pickFile}
              className="block w-full text-sm text-ink-dim file:mr-3 file:rounded file:border file:border-term-700 file:bg-term-800 file:px-3 file:py-1.5 file:text-sm file:text-ink-dim hover:file:bg-term-750"
            />
            {shownImage && (
              <div className="relative mt-2 inline-block">
                <img src={shownImage} alt="" className="max-h-60 rounded-md border border-term-700/60" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
                    setExistingImage(null)
                  }}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neon-red/50 bg-term-900 text-neon-red"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            )}
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-neon-red">
              <Icon name="close" size={14} /> {error}
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? (editing ? 'saving…' : 'publishing…') : editing ? '> save changes' : '> publish'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost">
              cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
