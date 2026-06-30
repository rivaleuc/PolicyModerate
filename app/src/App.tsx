import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import { Scale, Wallet, Loader2, Plus, Gavel, Check, Ban, Undo2, Inbox } from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button } from './components/ui'

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
      for (let i = total - 1; i >= 0 && i >= total - 40; i--) { try { const c = (await read('get_case', [String(i)])) as any; if (c?.exists) out.push({ ...c, id: String(i) }) } catch {} }
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
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Toaster theme="light" position="bottom-right" richColors />
      {/* LEFT SIDEBAR */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 px-4 py-4"><div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Scale className="h-4 w-4" /></div><div><div className="text-sm font-bold leading-none">PolicyModerate</div><div className="mt-0.5 text-[10px] text-muted">consensus moderation</div></div></div>
        <div className="px-3"><Button size="sm" className="w-full" onClick={() => setCompose(!compose)}><Plus className="h-4 w-4" /> New submission</Button></div>
        <AnimatePresence>{compose && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-3 pt-2">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="Content…" className="w-full resize-none rounded-md border border-border bg-card px-2.5 py-2 text-sm outline-none focus:border-primary/60" />
            <textarea value={policy} onChange={(e) => setPolicy(e.target.value)} rows={2} placeholder="Policy…" className="mt-2 w-full resize-none rounded-md border border-border bg-card px-2.5 py-2 text-xs outline-none focus:border-primary/60" />
            <Button size="sm" className="mt-2 w-full" onClick={submit} disabled={creating}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add</Button>
          </motion.div>
        )}</AnimatePresence>
        <div className="mt-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted">Queue · {stats.total_cases}</div>
        <div className="mt-1 flex-1 overflow-y-auto px-2">
          {cases.map((x) => (
            <button key={x.id} onClick={() => setSel(x.id)} className={`mb-0.5 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left ${sel === x.id ? 'bg-primary/10' : 'hover:bg-card'}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot(x)}`} />
              <div className="min-w-0 flex-1"><div className="truncate text-[13px]">{x.content}</div><div className="text-[10px] text-muted">{x.state === 'moderated' ? x.decision : 'pending'}</div></div>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-3"><Button size="sm" variant={wallet ? 'outline' : 'primary'} className="w-full" onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect wallet'}</Button><div className="mt-2 text-center text-[10px] text-muted">{stats.removed} removed · <a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></div>
      </aside>

      {/* DETAIL */}
      <section className="flex-1 overflow-y-auto">
        {!c ? <div className="grid h-full place-items-center text-sm text-muted"><div className="text-center"><Inbox className="mx-auto mb-2 h-8 w-8 opacity-40" />Select an item from the queue.</div></div> : (
          <div className="mx-auto max-w-2xl px-8 py-10">
            <div className="flex items-center gap-2">
              {c.state === 'moderated' ? (c.decision === 'removed' ? <Ban className="h-5 w-5 text-false" /> : <Check className="h-5 w-5 text-true" />) : <Gavel className="h-5 w-5 text-muted" />}
              <span className={`text-sm font-bold uppercase tracking-wider ${c.state !== 'moderated' ? 'text-muted' : c.decision === 'removed' ? 'text-false' : 'text-true'}`}>{c.state === 'moderated' ? c.decision : 'pending review'}</span>
              <span className="ml-auto font-mono text-[11px] text-muted">#{c.id} · {short(c.author)}</span>
            </div>
            <div className="mt-4 rounded-xl border border-border bg-card p-5 text-[15px] leading-relaxed shadow-sm">{c.content}</div>
            <div className="mt-5 text-[11px] uppercase tracking-wider text-muted">policy applied</div>
            <p className="mt-1 text-sm text-foreground/80">{c.policy}</p>
            {c.state === 'moderated' && (<>
              {c.clause && <div className="mt-4 rounded-lg border-l-2 border-primary bg-primary/5 px-3 py-2"><span className="text-[10px] uppercase tracking-wider text-primary">cited clause</span><p className="text-sm">{c.clause}</p></div>}
              {c.reason && <p className="mt-3 text-sm text-muted">{c.reason}</p>}
            </>)}
            <div className="mt-6 flex gap-2">
              {c.state !== 'moderated' && <Button disabled={busy === c.id} onClick={() => moderate(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Moderate</Button>}
              {c.state === 'moderated' && !c.appealed && <Button variant="outline" disabled={busy === c.id} onClick={() => appeal(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Appeal</Button>}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
