import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, BUCKET_POSTS } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { uploadImage } from '@/lib/utils'
import { Icon } from '@/components/ui/Icon'
import type { Category } from '@/types'

export function SubmitPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cats, setCats] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_categories').then(({ data }) => {
      const list = (data as Category[]) ?? []
      setCats(list)
      if (list[0]) setCategoryId(list[0].id)
    })
  }, [])

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !categoryId || !title.trim()) return
    setBusy(true)
    setError(null)

    let imageUrl: string | null = null
    if (file) {
      const { url, error } = await uploadImage(BUCKET_POSTS, user.id, file)
      if (error) {
        setError('Failed to upload image: ' + error)
        setBusy(false)
        return
      }
      imageUrl = url
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

  return (
    <div className="mx-auto max-w-2xl">
      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/posts/new</span>
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
            {preview && (
              <div className="relative mt-2 inline-block">
                <img src={preview} alt="" className="max-h-60 rounded-md border border-term-700/60" />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
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
              {busy ? 'publishing…' : '> publish'}
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
