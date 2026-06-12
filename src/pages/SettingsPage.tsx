import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, BUCKET_AVATARS, BUCKET_BANNERS } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { usePresence } from '@/contexts/PresenceContext'
import { uploadImage } from '@/lib/utils'
import { pushEnabled, setPushEnabled } from '@/lib/push'
import { Avatar } from '@/components/ui/Avatar'
import { OnlineDot } from '@/components/ui/OnlineDot'
import { Icon } from '@/components/ui/Icon'
import { FullSpinner } from '@/components/ui/Spinner'

export function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { themes, active, setActive } = useTheme()
  const { visibility, setVisibility } = usePresence()
  const [pushOn, setPushOn] = useState(pushEnabled())
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)
  const bannerInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
      setUsername(profile.username)
      setBio(profile.bio ?? '')
      setAvatarUrl(profile.avatar_url)
      setBannerUrl(profile.banner_url)
    }
  }, [profile])

  if (!profile || !user) return <FullSpinner label="profile" />

  async function handleUpload(kind: 'avatar' | 'banner', file: File) {
    setError(null)
    const bucket = kind === 'avatar' ? BUCKET_AVATARS : BUCKET_BANNERS
    const { url, error } = await uploadImage(bucket, user!.id, file)
    if (error) {
      setError(error)
      return
    }
    if (kind === 'avatar') setAvatarUrl(url)
    else setBannerUrl(url)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(false)

    const cleanUser = username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) {
      setError('username: only a-z, 0-9, _, length 3–20')
      setBusy(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || 'anon',
        username: cleanUser,
        bio: bio.trim() || null,
        avatar_url: avatarUrl,
        banner_url: bannerUrl,
      })
      .eq('id', user!.id)

    setBusy(false)
    if (error) {
      setError(error.message.includes('duplicate') ? 'This @username is already taken' : error.message)
      return
    }
    await refreshProfile()
    setOk(true)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="panel">
        <div className="panel-header">
          <span className="tui-dots" />
          <span>~/settings/profile</span>
        </div>

        <form onSubmit={save} className="space-y-5 p-4">
          {/* banner + avatar preview */}
          <div className="overflow-hidden rounded-lg border border-term-700/60">
            <div
              className="relative h-32 grid-bg bg-term-850"
              style={
                bannerUrl
                  ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : undefined
              }
            >
              {/* fade the banner bottom into the background so the avatar isn't cut by a hard edge */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-term-900 via-term-900/30 to-transparent" />
              <button
                type="button"
                onClick={() => bannerInput.current?.click()}
                className="btn btn-ghost absolute right-2 top-2 z-10 py-1 text-xs"
              >
                <Icon name="edit" size={13} /> banner
              </button>
              <input
                ref={bannerInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && handleUpload('banner', e.target.files[0])}
              />
            </div>
            <div className="relative z-10 flex items-end gap-3 px-3 pb-3">
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                className="-mt-8 rounded-lg border-2 border-term-900 bg-term-900"
              >
                <Avatar src={avatarUrl} name={displayName || 'a'} size={72} />
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && handleUpload('avatar', e.target.files[0])}
              />
              <button
                type="button"
                onClick={() => avatarInput.current?.click()}
                className="btn btn-ghost py-1 text-xs"
              >
                <Icon name="edit" size={13} /> avatar
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ display_name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              className="input"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ username (@handle)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neon-green">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={20}
                className="input pl-7"
                placeholder="example"
              />
            </div>
            <p className="mt-1 text-xs text-ink-faint">a-z, 0-9, _ — length 3–20</p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-dim">$ bio</label>
            <textarea
              rows={4}
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input resize-y"
              placeholder="// tell us about yourself"
            />
            <p className="mt-1 text-right text-xs text-ink-faint">{bio.length}/500</p>
          </div>

          {/* presence */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-ink-dim">
              <OnlineDot online={visibility === 'online'} size={9} /> $ status
            </label>
            <div className="flex gap-2">
              {(['online', 'offline'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`btn flex-1 ${visibility === v ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {v === 'online' ? 'appear online' : 'appear offline'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              // you always show as offline once you leave the site
            </p>
          </div>

          {/* push notifications */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs text-ink-dim">
              <Icon name="mail" size={13} /> $ push_notifications
            </label>
            <button
              type="button"
              onClick={() => {
                const next = !pushOn
                setPushOn(next)
                setPushEnabled(next)
              }}
              className={`btn w-full ${pushOn ? 'btn-primary' : 'btn-ghost'}`}
            >
              {pushOn ? 'push notifications: on' : 'push notifications: off'}
            </button>
            <p className="mt-1 text-xs text-ink-faint">
              // desktop/browser alerts for replies, upvotes, friends and DMs
            </p>
          </div>

          {/* theme picker */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-ink-dim">
                <Icon name="palette" size={13} /> $ theme
              </label>
              <Link to="/themes" className="link text-xs">
                open theme-store →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                    active.id === t.id
                      ? 'border-neon-green/50 bg-term-800'
                      : 'border-term-700 bg-term-850 hover:bg-term-800'
                  }`}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded"
                    style={{ background: t.colors.term900 }}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.colors.neonGreen }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-ink">{t.name}</span>
                  </span>
                  {active.id === t.id && <Icon name="check" size={13} className="text-neon-green" />}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-sm text-neon-red">
              <Icon name="close" size={14} /> {error}
            </p>
          )}
          {ok && (
            <p className="flex items-center gap-1.5 text-sm text-neon-green">
              <Icon name="check" size={14} /> profile saved
            </p>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary">
              {busy ? 'saving…' : '> save'}
            </button>
            <button type="button" onClick={() => navigate(`/u/${profile.username}`)} className="btn btn-ghost">
              view profile
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
