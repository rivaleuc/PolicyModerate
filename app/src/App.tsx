import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Scale, Wallet, Loader2, Plus, Gavel, Check, Ban, Undo2, Inbox } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`
type Case = { id: string; author: string; content: string; policy: string; state: string; decision: string; clause: string; reason: string; appealed: boolean }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_cases: 0, removed: 0 })
  const [cases, setCases] = useState<Case[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [compose, setCompose] = useState(false)
  const [content, setContent] = useState(''); const [policy, setPolicy] = useState('No spam, hate speech, or solicitation.')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_cases: Number(s?.total_cases ?? 0), removed: Number(s?.removed ?? 0) })
      const total = Number(s?.total_cases ?? 0); const out: Case[] = []
      for (let i = total - 1; i >= 0 && i >= total - 30; i--) { try { const c = (await read('get_case', [String(i)])) as any; if (c?.exists) out.push({ ...c, id: String(i) }) } catch {} }
      setCases(out); if (!sel && out.length) setSel(out[0].id)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function submit() { if (!content.trim() || !policy.trim()) return toast.error('Content + policy.'); setCreating(true); const t = toast.loading('Filing…'); try { const id = (await write('submit', [content.trim(), policy.trim()])) as any; toast.success('Queued.', { id: t }); setContent(''); setCompose(false); await load(); if (typeof id === 'string') setSel(id) } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function moderate(c: Case) { setBusy(c.id); const t = toast.loading('Ruling… (30–60s)'); try { await write('moderate', [c.id]); const x = (await read('get_case', [c.id])) as any; toast.success(String(x?.decision).toUpperCase(), { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function appeal(c: Case) { setBusy(c.id); const t = toast.loading('Re-judging… (30–60s)'); try { await write('appeal', [c.id]); const x = (await read('get_case', [c.id])) as any; toast.success(`Appeal: ${String(x?.decision).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const c = cases.find((x) => x.id === sel) || null
  const dot = (x: Case) => x.state !== 'moderated' ? 'bg-muted' : x.decision === 'removed' ? 'bg-false' : 'bg-true'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2.5 px-5">
          <Scale className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">PolicyModerate</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_cases} /></b> queued · <b className="text-accent"><NumberTicker value={stats.removed} /></b> removed</div>
          <Button size="sm" className="ml-auto" variant="outline" onClick={() => setCompose(!compose)}><Plus className="h-4 w-4" /> Submit</Button>
          <Button size="sm" className="ml-2" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-0 px-5 py-5 md:grid-cols-[320px_1fr]">
        {/* queue pane */}
        <aside className="rounded-l-xl border border-border bg-card/40 md:border-r-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted"><Inbox className="h-3.5 w-3.5" /> queue</div>
          <AnimatePresence>{compose && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-b border-border">
              <div className="space-y-2 p-3">
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="Content…" className="w-full resize-none rounded-md border border-border bg-background/70 px-2.5 py-2 text-sm outline-none focus:border-primary/50" />
                <textarea value={policy} onChange={(e) => setPolicy(e.target.value)} rows={2} placeholder="Policy…" className="w-full resize-none rounded-md border border-border bg-background/70 px-2.5 py-2 text-xs outline-none focus:border-primary/50" />
                <Button size="sm" className="w-full" onClick={submit} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add to queue</Button>
              </div>
            </motion.div>
          )}</AnimatePresence>
          <div className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto">
            {cases.length === 0 && <div className="p-6 text-center text-xs text-muted">Empty.</div>}
            {cases.map((x) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={`flex w-full items-start gap-2.5 px-4 py-3 text-left ${sel === x.id ? 'bg-primary/8' : 'hover:bg-white/[0.02]'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot(x)}`} />
                <div className="min-w-0 flex-1"><div className="truncate text-sm">{x.content}</div><div className="mt-0.5 text-[11px] text-muted">{x.state === 'moderated' ? (x.decision + (x.appealed ? ' · appealed' : '')) : 'pending'}</div></div>
              </button>
            ))}
          </div>
        </aside>

        {/* detail pane */}
        <section className="rounded-r-xl border border-border bg-card/20 p-6 md:rounded-l-none">
          {!c ? <div className="grid h-full place-items-center text-sm text-muted">Select an item from the queue.</div> : (
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center gap-2">
                {c.state === 'moderated' ? (c.decision === 'removed' ? <Ban className="h-5 w-5 text-false" /> : <Check className="h-5 w-5 text-true" />) : <Gavel className="h-5 w-5 text-muted" />}
                <span className={`text-sm font-bold uppercase tracking-wider ${c.state !== 'moderated' ? 'text-muted' : c.decision === 'removed' ? 'text-false' : 'text-true'}`}>{c.state === 'moderated' ? c.decision : 'pending review'}</span>
                <span className="ml-auto font-mono text-[11px] text-muted">case #{c.id} · {short(c.author)}</span>
              </div>
              <div className="mt-4 rounded-xl border border-border bg-background/50 p-4 text-[15px] leading-relaxed">{c.content}</div>
              <div className="mt-4 text-[11px] uppercase tracking-wider text-muted">policy applied</div>
              <p className="mt-1 text-sm text-foreground/80">{c.policy}</p>
              {c.state === 'moderated' && (<>
                {c.clause && <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"><span className="text-[10px] uppercase tracking-wider text-primary">cited clause</span><p className="text-sm">{c.clause}</p></div>}
                {c.reason && <p className="mt-3 text-sm text-muted">{c.reason}</p>}
              </>)}
              <div className="mt-5 flex gap-2">
                {c.state !== 'moderated' && <Button disabled={busy === c.id} onClick={() => moderate(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Moderate</Button>}
                {c.state === 'moderated' && !c.appealed && <Button variant="outline" disabled={busy === c.id} onClick={() => appeal(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Appeal</Button>}
              </div>
            </div>
          )}
        </section>
      </main>
      <footer className="border-t border-border"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-xs text-muted"><span>PolicyModerate · accountable, appealable moderation</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
