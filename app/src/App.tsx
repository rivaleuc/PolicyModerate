import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Toaster, toast } from 'sonner'
import {
  Scale, Wallet, Loader2, Plus, Gavel, Check, Ban, Undo2, ChevronDown,
} from 'lucide-react'
import { read, write, connectWallet, isWalletConnected, CONTRACT } from './genlayer'
import { Button, Badge } from './components/ui'
import { NumberTicker } from './components/magic'

const EXPLORER = `https://explorer-bradbury.genlayer.com/contract/${CONTRACT}`
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

type Case = { id: string; author: string; content: string; policy: string; state: string; decision: string; clause: string; reason: string; appealed: boolean }

export default function App() {
  const [wallet, setWallet] = useState<string | null>(null)
  const [stats, setStats] = useState({ total_cases: 0, removed: 0 })
  const [cases, setCases] = useState<Case[]>([])
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(''); const [policy, setPolicy] = useState('No spam, hate speech, or solicitation.')
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState<string | null>(null); const [exp, setExp] = useState<string | null>(null)

  async function load() {
    try {
      const s = (await read('stats')) as any
      setStats({ total_cases: Number(s?.total_cases ?? 0), removed: Number(s?.removed ?? 0) })
      const total = Number(s?.total_cases ?? 0); const out: Case[] = []
      for (let i = total - 1; i >= 0 && i >= total - 12; i--) { try { const c = (await read('get_case', [String(i)])) as any; if (c?.exists) out.push({ ...c, id: String(i) }) } catch {} }
      setCases(out)
    } catch (e) { console.warn(e) }
  }
  useEffect(() => { load(); setWallet(isWalletConnected() ? 'connected' : null) /* eslint-disable-next-line */ }, [])

  async function connect() { try { const a = await connectWallet(); setWallet(a); toast.success(`Connected · ${short(a)}`) } catch (e: any) { toast.error(e?.message ?? 'Failed') } }
  async function submit() { if (!content.trim() || !policy.trim()) return toast.error('Content + policy.'); setCreating(true); const t = toast.loading('Submitting…'); try { await write('submit', [content.trim(), policy.trim()]); toast.success('Submitted to the queue.', { id: t }); setContent(''); setOpen(false); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setCreating(false) } }
  async function moderate(c: Case) { setBusy(c.id); const t = toast.loading('Validators ruling against the policy… (30–60s)'); try { await write('moderate', [c.id]); const x = (await read('get_case', [c.id])) as any; toast.success(`Ruling: ${String(x?.decision).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }
  async function appeal(c: Case) { setBusy(c.id); const t = toast.loading('Re-judging on appeal… (30–60s)'); try { await write('appeal', [c.id]); const x = (await read('get_case', [c.id])) as any; toast.success(`Appeal ruling: ${String(x?.decision).toUpperCase()}`, { id: t }); await load() } catch (e: any) { toast.error(`Failed: ${e?.shortMessage ?? e?.message ?? e}`, { id: t }) } finally { setBusy(null) } }

  const tone = (d: string) => (d === 'allowed' ? 'true' : d === 'removed' ? 'false' : 'neutral')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(720px_circle_at_50%_-5%,#fbbf2418,transparent_60%)]" />

      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-2.5 px-5">
          <Scale className="h-5 w-5 text-primary" /><span className="text-[15px] font-bold tracking-tight">PolicyModerate</span>
          <div className="ml-4 hidden font-mono text-xs text-muted md:block"><b className="text-foreground"><NumberTicker value={stats.total_cases} /></b> cases · <b className="text-accent"><NumberTicker value={stats.removed} /></b> removed</div>
          <Button size="sm" className="ml-auto" variant={wallet ? 'outline' : 'primary'} onClick={connect}><Wallet className="h-4 w-4" />{wallet && wallet !== 'connected' ? short(wallet) : wallet ? 'Connected' : 'Connect'}</Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Moderation, judged against your policy</h1>
        <p className="mt-1 text-sm text-muted">The policy is an input — validators agree on the decision and cite the clause. Every removal can be appealed once.</p>

        <div className="mt-5"><Button onClick={() => setOpen(!open)} variant={open ? 'ghost' : 'primary'}><Plus className="h-4 w-4" />{open ? 'Cancel' : 'Submit content'}</Button></div>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
            <div className="mt-3 grid gap-2 rounded-xl border border-border bg-card/60 p-3">
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Content to moderate…" className="resize-none rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <textarea value={policy} onChange={(e) => setPolicy(e.target.value)} rows={2} placeholder="The policy / ruleset…" className="resize-none rounded-md border border-border bg-background/70 px-3 py-2.5 text-sm outline-none focus:border-primary/50" />
              <Button size="sm" onClick={submit} disabled={creating} className="justify-self-end">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />} Submit</Button>
            </div>
          </motion.div>
        )}

        <div className="mt-6 space-y-2">
          {cases.length === 0 && <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">Queue is empty.</div>}
          {cases.map((c) => {
            const ruled = c.state === 'moderated'
            return (
              <div key={c.id} className={`rounded-xl border ${c.decision === 'removed' ? 'border-false/30 bg-false/[0.03]' : c.decision === 'allowed' ? 'border-true/30 bg-true/[0.03]' : 'border-border bg-card/50'}`}>
                <button onClick={() => setExp(exp === c.id ? null : c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  {ruled ? (c.decision === 'removed' ? <Ban className="h-4 w-4 shrink-0 text-false" /> : <Check className="h-4 w-4 shrink-0 text-true" />) : <Gavel className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="flex-1 truncate text-sm">{c.content}</span>
                  {ruled ? <Badge tone={tone(c.decision)}>{c.decision}{c.appealed ? ' · appealed' : ''}</Badge> : <Badge tone="neutral">pending</Badge>}
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${exp === c.id ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {exp === c.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-border/60">
                      <div className="space-y-3 px-4 py-3">
                        <div><div className="text-[10px] uppercase tracking-wider text-muted">policy</div><p className="text-xs text-foreground/80">{c.policy}</p></div>
                        {ruled && (<>
                          {c.clause && <div className="rounded-lg border border-border bg-background/40 px-3 py-2"><span className="text-[10px] uppercase tracking-wider text-primary">cited clause</span><p className="text-sm">{c.clause}</p></div>}
                          {c.reason && <p className="text-xs text-muted">{c.reason}</p>}
                        </>)}
                        <div className="flex gap-2">
                          {!ruled && <Button size="sm" disabled={busy === c.id} onClick={() => moderate(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />} Moderate</Button>}
                          {ruled && !c.appealed && <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => appeal(c)}>{busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} Appeal</Button>}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="border-t border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6 text-xs text-muted"><span>PolicyModerate · accountable, appealable moderation on GenLayer</span><a href={EXPLORER} target="_blank" rel="noreferrer" className="hover:text-primary">{short(CONTRACT)} ↗</a></div></footer>
    </div>
  )
}
