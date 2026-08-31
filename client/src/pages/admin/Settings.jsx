import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, apiError } from '../../api/client.js'
import {
  Button,
  cn,
  Loading,
  Panel,
  TextField,
  Toggle,
  useToast,
} from '../../components/ui/index.jsx'
import { PageHead } from '../../components/admin/index.jsx'
import useDocumentTitle from '../../hooks/useDocumentTitle.js'

const TABS = [
  { id: 'branding', label: 'Branding' },
  { id: 'menu', label: 'Menu' },
  { id: 'help', label: 'Help' },
  { id: 'domain', label: 'Domain' },
]

const MENU_LABELS = {
  showWorkshops: 'Workshops',
  showCourses: 'Courses',
  showCommunity: 'Community',
  showBlog: 'Blog',
  showPractice: 'Practice',
}

export default function AdminSettings() {
  useDocumentTitle('Site settings — Growth Scholar Admin')
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('branding')
  const [form, setForm] = useState(null)

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await api.get('/admin/settings')).data,
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = useMutation({
    mutationFn: async () => (await api.put(`/admin/settings/${tab}`, form[tab])).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] })
      toast.show('Saved ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  const verify = useMutation({
    mutationFn: async () => (await api.post('/admin/settings/domain/verify')).data,
    onSuccess: (domain) => {
      setForm((f) => ({ ...f, domain }))
      toast.show('Domain verified ✓')
    },
    onError: (err) => toast.show(apiError(err)),
  })

  if (isPending || !form) return <Loading />

  const patch = (section, key, value) =>
    setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }))

  return (
    <>
      {toast.node}
      <PageHead
        title="Site"
        sub="Branding & platform settings"
        actions={
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <nav className="mb-6 flex gap-1 border-b border-line-admin" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-[0.86rem] font-semibold transition-colors duration-200 ease-gs',
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-muted-admin hover:text-brand',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="max-w-2xl">
        {tab === 'branding' && (
          <Panel title="Branding" bodyClass="grid gap-4 p-5">
            <TextField
              label="Brand name"
              value={form.branding.brandName || ''}
              onChange={(e) => patch('branding', 'brandName', e.target.value)}
            />
            <TextField
              label="Product name"
              value={form.branding.productName || ''}
              onChange={(e) => patch('branding', 'productName', e.target.value)}
            />
            <TextField
              label="Logo URL"
              value={form.branding.logoUrl || ''}
              onChange={(e) => patch('branding', 'logoUrl', e.target.value)}
            />
            <TextField
              label="Favicon URL"
              value={form.branding.faviconUrl || ''}
              onChange={(e) => patch('branding', 'faviconUrl', e.target.value)}
            />
            <div className="flex items-end gap-3">
              <TextField
                label="Accent colour"
                value={form.branding.accentColor || ''}
                onChange={(e) => patch('branding', 'accentColor', e.target.value)}
                className="flex-1"
              />
              <span
                className="mb-1 h-9 w-9 rounded-md2 border border-line-admin"
                style={{ background: form.branding.accentColor }}
                aria-hidden="true"
              />
            </div>
          </Panel>
        )}

        {tab === 'menu' && (
          <Panel title="Menu visibility" bodyClass="grid gap-3 p-5">
            {Object.entries(MENU_LABELS).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg2 bg-surface-admin/60 px-4 py-3"
              >
                <span className="text-[0.88rem] text-muted-admin">{label}</span>
                <Toggle
                  checked={!!form.menu[key]}
                  onChange={(v) => patch('menu', key, v)}
                  label={label}
                />
              </div>
            ))}
          </Panel>
        )}

        {tab === 'help' && (
          <Panel title="Help & support" bodyClass="grid gap-4 p-5">
            <TextField
              type="email"
              label="Support email"
              value={form.help.supportEmail || ''}
              onChange={(e) => patch('help', 'supportEmail', e.target.value)}
            />
            <TextField
              type="email"
              label="Sales email"
              value={form.help.salesEmail || ''}
              onChange={(e) => patch('help', 'salesEmail', e.target.value)}
            />
            <TextField
              label="Help centre URL"
              value={form.help.helpCenterUrl || ''}
              onChange={(e) => patch('help', 'helpCenterUrl', e.target.value)}
            />
            <TextField
              label="Support hours"
              value={form.help.hours || ''}
              onChange={(e) => patch('help', 'hours', e.target.value)}
            />
          </Panel>
        )}

        {tab === 'domain' && (
          <Panel title="Custom domain" bodyClass="grid gap-4 p-5">
            <TextField
              label="Domain"
              value={form.domain.host || ''}
              onChange={(e) => patch('domain', 'host', e.target.value)}
            />
            <div className="flex items-center justify-between rounded-lg2 bg-surface-admin/60 px-4 py-3">
              <span className="text-[0.88rem] text-muted-admin">
                {form.domain.verified ? 'Verified ✓' : 'Not verified yet'}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => verify.mutate()}
                disabled={verify.isPending}
              >
                {verify.isPending ? 'Verifying…' : 'Verify domain'}
              </Button>
            </div>
          </Panel>
        )}
      </div>
    </>
  )
}
