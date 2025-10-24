'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarDays, CheckCircle2, ListChecks, Plus, Rocket, Table2, Trophy, Users } from 'lucide-react'
import { TaskComments } from '@/components/TaskComments'


// ====== 定義 ======
const PHASES = ['要件定義','撮影環境設計','ワークフロー設計','テンプレ/指示書','PoC/内製化トレーニング','運用移行'] as const
const PRIORITIES = ['低', '中', '高', '至急'] as const
const ASSIGNEES = ['Makoto', 'A', 'B', '外注'] as const

type TaskRow = {
  id: string
  title: string
  description?: string | null
  status?: string | null      // 既存DBは text 型のままでも可
  created_at?: string | null
  priority: (typeof PRIORITIES)[number] | null
  assignee?: string | null
  due_date?: string | null
  progress?: number | null
  labels?: string[] | null
  category?: string | null
  phase?: string | null
  checklist?: { k: string; done: boolean }[]
  customer?: string | null
  notes?: string | null
}

function percentComplete(task: TaskRow) {
  const total = task.checklist?.length ?? 0
  if (!total) return 0
  const done = task.checklist!.filter(c => c.done).length
  return Math.round((done / total) * 100)
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return 0
  const today = new Date()
  const d = new Date(`${dateStr}T00:00:00`)
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function kpi(tasks: TaskRow[]) {
  const total = tasks.length
  const urgent = tasks.filter(t => t.priority === '至急').length
  const dueSoon = tasks.filter(t => (daysUntil(t.due_date) <= 3)).length
  const overall = Math.round(tasks.reduce((acc, t) => acc + percentComplete(t), 0) / (tasks.length || 1))
  return { total, urgent, dueSoon, overall }
}

function AuthButtons() {
  const [session, setSession] = React.useState<any>(null)
  const [email, setEmail] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn() {
    if (!email) return
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    setSending(false)
    if (error) { alert(error.message); return }
    setSent(true)
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{session.user?.email}</span>
        <Button variant="outline" onClick={signOut}>ログアウト</Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {sent ? (
        <span className="text-xs text-muted-foreground">メールのMagic Linkを確認してください</span>
      ) : (
        <>
          <Input type="email" placeholder="you@example.com"
                 value={email} onChange={(e)=>setEmail(e.target.value)} className="w-56" />
          <Button onClick={signIn} disabled={!email || sending}>ログイン</Button>
        </>
      )}
    </div>
  )
}


export default function Page() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<'all' | string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<'all' | string>('all')

  const [newTask, setNewTask] = useState<Partial<TaskRow>>({
    title: '',
    phase: PHASES[0],
    assignee: ASSIGNEES[0],
    priority: '中',
    due_date: '',
    customer: '社内標準（fleston）',
    notes: '',
  })

  // ====== 初期ロード ======
  useEffect(() => { void loadTasks() }, [])

  async function loadTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('due_date', { ascending: true })
      .limit(1000)

    if (error) {
      console.error(error)
      alert('データ取得に失敗しました')
      setLoading(false)
      return
    }
    setTasks((data || []).map(t => ({ ...t, checklist: (t as any).checklist ?? [] })) as TaskRow[])
    setLoading(false)
  }

  // ====== 追加 ======
  async function addTask() {
    if (!newTask.title) return
    const payload = {
      title: newTask.title,
      phase: newTask.phase ?? null,
      assignee: newTask.assignee ?? null,
      priority: (newTask.priority as any) ?? '中',
      due_date: newTask.due_date || null,
      customer: newTask.customer ?? null,
      notes: newTask.notes ?? null,
      checklist: [],
    }
    const { data, error } = await supabase.from('tasks').insert(payload).select().single()
    if (error) {
      console.error(error)
      alert('保存に失敗しました')
      return
    }
    setTasks(prev => [data as TaskRow, ...prev])
    setNewTask({ title: '', phase: PHASES[0], assignee: ASSIGNEES[0], priority: '中', due_date: '', customer: '社内標準（fleston）', notes: '' })
  }

  // ====== 削除 ======
  async function removeTask(id: string) {
    const prev = tasks
    setTasks(prev.filter(t => t.id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) {
      console.error(error)
      alert('削除に失敗しました')
      setTasks(prev)
    }
  }

  // ====== チェックリストのトグル（即保存） ======
  async function toggleChecklist(taskId: string, idx: number) {
    const t = tasks.find(x => x.id === taskId)
    if (!t) return
    const list = (t.checklist ?? []).map((c, i) => (i === idx ? { ...c, done: !c.done } : c))
    setTasks(prev => prev.map(x => (x.id === taskId ? { ...x, checklist: list } : x)))
    const { error } = await supabase.from('tasks').update({ checklist: list }).eq('id', taskId)
    if (error) {
      console.error(error)
      alert('チェック保存に失敗しました')
      // 失敗時はリロードで整合
      void loadTasks()
    }
  }

  // ====== フィルタ & 集計 ======
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const okQ = q ? `${t.title} ${t.customer ?? ''} ${t.notes ?? ''}`.toLowerCase().includes(q.toLowerCase()) : true
      const okPhase = phaseFilter === 'all' ? true : (t.phase === phaseFilter)
      const okAssignee = assigneeFilter === 'all' ? true : (t.assignee === assigneeFilter)
      return okQ && okPhase && okAssignee
    })
  }, [tasks, q, phaseFilter, assigneeFilter])

  const byPhase = useMemo(() => {
    const map: Record<string, TaskRow[]> = Object.fromEntries(PHASES.map(p => [p, []]))
    filtered.forEach(t => { if (t.phase && map[t.phase]) map[t.phase].push(t) })
    // null/未設定のフェーズをどこかに表示したい場合は、別枠にまとめてもOK
    return map
  }, [filtered])

  const stats = useMemo(() => kpi(tasks), [tasks])

  // ====== UI ======
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="mx-auto max-w-7xl">

{/* Header */}
<div className="mb-6 flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold">ささげ内製化サービスプロジェクト</h1>
    <p className="text-sm text-slate-500">MVPダッシュボード（Supabase 永続化対応）</p>
  </div>

  <div className="flex items-center gap-3">
    <AuthButtons />

    <Input
      placeholder="検索（タイトル/顧客/メモ）"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      className="w-64"
    />

    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          タスク追加
        </Button>
      </DialogTrigger>

      {/* ここからモーダルの中身（必ず Dialog の内側に置く） */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>新規タスク</DialogTitle>
          <DialogDescription>入力後、Supabaseに保存されます。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <Label>タイトル</Label>
          <Input
            value={newTask.title ?? ''}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="例：初品チェック票 v1 リリース"
          />

          <Label className="mt-2">フェーズ</Label>
          <Select
            value={newTask.phase ?? ''}
            onValueChange={(v) => setNewTask({ ...newTask, phase: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHASES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>担当</Label>
              <Select
                value={newTask.assignee ?? ''}
                onValueChange={(v) => setNewTask({ ...newTask, assignee: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASSIGNEES.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>優先度</Label>
              <Select
                value={(newTask.priority as any) ?? ''}
                onValueChange={(v) => setNewTask({ ...newTask, priority: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>期限</Label>
              <Input
                type="date"
                value={newTask.due_date ?? ''}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
            </div>
            <div>
              <Label>顧客/区分</Label>
              <Input
                value={newTask.customer ?? ''}
                onChange={(e) => setNewTask({ ...newTask, customer: e.target.value })}
              />
            </div>
          </div>

          <Label className="mt-2">メモ</Label>
          <Input
            value={newTask.notes ?? ''}
            onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
            placeholder="補足やURLなど"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() =>
                setNewTask({
                  title: '',
                  phase: PHASES[0],
                  assignee: ASSIGNEES[0],
                  priority: '中',
                  due_date: '',
                  customer: '社内標準（fleston）',
                  notes: '',
                })
              }
            >
              クリア
            </Button>
            <Button onClick={addTask} className="gap-2">
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </div>
      </DialogContent>
      {/* ここまでモーダル */}
    </Dialog>
  </div>
</div>


        {/* Filters + KPI */}
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600"><Table2 className="h-4 w-4" /> フェーズ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={phaseFilter === 'all' ? 'default' : 'outline'} onClick={() => setPhaseFilter('all')}>すべて</Button>
                {PHASES.map((p) => (
                  <Button key={p} size="sm" variant={phaseFilter === p ? 'default' : 'outline'} onClick={() => setPhaseFilter(p)}>{p}</Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600"><Users className="h-4 w-4" /> 担当</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(['all', ...ASSIGNEES] as const).map((a) => (
                  <Button key={a} size="sm" variant={assigneeFilter === a ? 'default' : 'outline'} onClick={() => setAssigneeFilter(a)}>
                    {a === 'all' ? 'すべて' : a}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600"><Trophy className="h-4 w-4" /> KPI/進捗</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div><div className="text-2xl font-semibold">{stats.total}</div><div className="text-xs text-slate-500">タスク</div></div>
                <div><div className="text-2xl font-semibold">{stats.urgent}</div><div className="text-xs text-slate-500">至急</div></div>
                <div><div className="text-2xl font-semibold">{stats.dueSoon}</div><div className="text-xs text-slate-500">3日以内</div></div>
                <div><div className="text-2xl font-semibold">{stats.overall}%</div><div className="text-xs text-slate-500">全体進捗</div></div>
              </div>
              <Progress className="mt-3" value={stats.overall} />
            </CardContent>
          </Card>
        </div>

        {/* Main */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">読み込み中...</div>
        ) : (
          <Tabs defaultValue="board" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="board" className="gap-2"><ListChecks className="h-4 w-4" /> ボード</TabsTrigger>
              <TabsTrigger value="table" className="gap-2"><Table2 className="h-4 w-4" /> テーブル</TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2"><CalendarDays className="h-4 w-4" /> 期限順</TabsTrigger>
            </TabsList>

            {/* Board */}
            <TabsContent value="board" className="mt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {PHASES.map((p) => (
                  <Card key={p} className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {p} <Badge variant="outline" className="ml-2">{byPhase[p]?.length ?? 0}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(byPhase[p]?.length ?? 0) === 0 && (
                        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-slate-400">タスクなし</div>
                      )}
                      {byPhase[p]?.map((t) => (
                        <div key={t.id} className="rounded-2xl border border-slate-200 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-sm font-medium">{t.title}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant={t.priority === '至急' ? 'destructive' : t.priority === '高' ? 'default' : 'secondary'}>{t.priority ?? '-'}</Badge>
                              <Badge variant="outline">{t.assignee ?? '-'}</Badge>
                            </div>
                          </div>
                          <div className="mb-2 grid grid-cols-2 text-xs text-slate-500">
                            <div>期限：{t.due_date ?? '-'}（残{Math.max(daysUntil(t.due_date), 0)}日）</div>
                            <div className="text-right">進捗：{percentComplete(t)}%</div>
                          </div>
                          <Progress value={percentComplete(t)} />
                          <div className="mt-2 space-y-1">
                            {(t.checklist ?? []).map((c, i) => (
                              <label key={i} className="flex items-center gap-2 text-sm">
                                <Checkbox checked={c.done} onCheckedChange={() => toggleChecklist(t.id, i)} />
                                <span className={c.done ? 'line-through text-slate-400' : ''}>{c.k}</span>
                              </label>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                            <div>{t.customer ?? ''}</div>
                            <Button size="sm" variant="ghost" onClick={() => removeTask(t.id)}>削除</Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Table */}
            <TabsContent value="table" className="mt-4">
              <Card className="border-slate-200">
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>タイトル</TableHead>
                        <TableHead>フェーズ</TableHead>
                        <TableHead>担当</TableHead>
                        <TableHead>優先度</TableHead>
                        <TableHead>期限</TableHead>
                        <TableHead>進捗</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.title}</TableCell>
                          <TableCell>{t.phase ?? '-'}</TableCell>
                          <TableCell>{t.assignee ?? '-'}</TableCell>
                          <TableCell>
                            <Badge variant={t.priority === '至急' ? 'destructive' : t.priority === '高' ? 'default' : 'secondary'}>
                              {t.priority ?? '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>{t.due_date ?? '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">{percentComplete(t)}%</span>
                              <Progress value={percentComplete(t)} className="w-28" />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => removeTask(t.id)}>削除</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Calendar-like */}
            <TabsContent value="calendar" className="mt-4">
              <Card className="border-slate-200">
                <CardContent>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {filtered
                      .slice()
                      .sort((a, b) => new Date(a.due_date || '').getTime() - new Date(b.due_date || '').getTime())
                      .map((t) => (
                        <div key={t.id} className="rounded-2xl border border-slate-200 p-3">
                          <div className="mb-1 text-xs text-slate-500">期限 {t.due_date ?? '-'}（残{Math.max(daysUntil(t.due_date), 0)}日）</div>
                          <div className="text-sm font-medium">{t.title}</div>
                          <div className="mt-1 text-xs text-slate-500">{t.phase ?? '-'}・{t.assignee ?? '-'}・{t.customer ?? ''}</div>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant={t.priority === '至急' ? 'destructive' : t.priority === '高' ? 'default' : 'secondary'}>
                              {t.priority ?? '-'}
                            </Badge>
                            <span className="text-xs text-slate-500">進捗 {percentComplete(t)}%</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-slate-400">
          Prototype v1 — Supabase 永続化版。RLSや認証の運用は後段で強化可能。
        </div>
      </div>
    </div>
  )
}
