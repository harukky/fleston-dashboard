'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Comment = {
  id: string
  task_id: string
  body: string
  created_by: string | null
  created_at: string
}

export function TaskComments({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])

  async function load() {
    const { data, error } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    if (!error && data) setComments(data as Comment[])
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  async function addComment() {
    if (!session) return alert('ログインが必要です')
    if (!body.trim()) return
    setLoading(true)
    const { error } = await supabase.from('task_comments').insert({
      task_id: taskId,
      body
    })
    setLoading(false)
    if (error) return alert(error.message)
    setBody('')
    load()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-xs">💬 コメント</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>コメント</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-80 overflow-auto">
          {comments.length === 0 && <div className="text-sm text-muted-foreground">まだコメントはありません</div>}
          {comments.map(c => (
            <div key={c.id} className="rounded-md border p-2">
              <div className="text-sm whitespace-pre-wrap">{c.body}</div>
              <div className="mt-1 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Input placeholder="コメントを入力…" value={body} onChange={(e)=>setBody(e.target.value)} />
          <Button onClick={addComment} disabled={!session || loading}>送信</Button>
        </div>

        {!session && <div className="text-xs text-muted-foreground">※ ログインするとコメントできます</div>}
      </DialogContent>
    </Dialog>
  )
}

