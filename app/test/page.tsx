"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>shadcn/ui セットアップ確認</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">
              Button / Card コンポーネントの表示とスタイルが効いていればOKです。
            </p>
            <Button onClick={() => alert("shadcn OK!")}>Shadcn Button</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
