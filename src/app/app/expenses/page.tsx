"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Budget = { id: string; title: string; amount: number };
type Expense = { id: string; title: string; amount: number; budget_id: string | null; paid_by: string | null; created_at: string };

export default function ExpensesPage() {
  const supabase = supabaseBrowser;
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");

  const [newBudgetTitle, setNewBudgetTitle] = useState("");
  const [newBudgetAmount, setNewBudgetAmount] = useState("");

  const [newExpenseTitle, setNewExpenseTitle] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseBudgetId, setNewExpenseBudgetId] = useState<string>("");

  const totals = useMemo(() => {
    const budget = budgets.find((b) => b.id === (selectedBudgetId || newExpenseBudgetId)) || null;
    const expensesForBudget = expenses.filter((e) => (selectedBudgetId ? e.budget_id === selectedBudgetId : true));
    const totalExpense = expensesForBudget.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const budgetAmount = budget ? Number(budget.amount) : 0;
    return {
      budgetAmount,
      totalExpense,
      balance: budget ? budgetAmount - totalExpense : 0,
    };
  }, [budgets, expenses, selectedBudgetId, newExpenseBudgetId]);

  const perUser = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => {
      const key = e.paid_by || "unknown";
      map.set(key, (map.get(key) || 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries()).map(([userId, total]) => ({ userId, total }));
  }, [expenses]);

  useEffect(() => {
    let isCancelled = false;
    let expenseSub: ReturnType<typeof supabase.channel> | null = null;
    let budgetSub: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: b } = await supabase.from("budgets").select("id,title,amount").order("created_at");
        const { data: ex } = await supabase
          .from("expenses")
          .select("id,title,amount,budget_id,paid_by,created_at")
          .order("created_at");
        if (!isCancelled) {
          setBudgets((b as any) || []);
          setExpenses((ex as any) || []);
        }

        // realtime
        expenseSub = supabase
          .channel("rt-expenses")
          .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, (payload) => {
            setExpenses((prev) => {
              const row = payload.new as Expense;
              if (payload.eventType === "INSERT") return [...prev, row];
              if (payload.eventType === "UPDATE") return prev.map((e) => (e.id === row.id ? (row as Expense) : e));
              if (payload.eventType === "DELETE") return prev.filter((e) => e.id !== (payload.old as any).id);
              return prev;
            });
          })
          .subscribe();

        budgetSub = supabase
          .channel("rt-budgets")
          .on("postgres_changes", { event: "*", schema: "public", table: "budgets" }, (payload) => {
            setBudgets((prev) => {
              const row = payload.new as Budget;
              if (payload.eventType === "INSERT") return [...prev, row];
              if (payload.eventType === "UPDATE") return prev.map((b) => (b.id === row.id ? (row as Budget) : b));
              if (payload.eventType === "DELETE") return prev.filter((b) => b.id !== (payload.old as any).id);
              return prev;
            });
          })
          .subscribe();
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load expenses");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();
    return () => {
      isCancelled = true;
      expenseSub?.unsubscribe();
      budgetSub?.unsubscribe();
    };
  }, [supabase]);

  async function addBudget() {
    try {
      if (!newBudgetTitle.trim() || !newBudgetAmount) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("budgets").insert({
        title: newBudgetTitle.trim(),
        amount: Number(newBudgetAmount),
        user_id: user.id,
      });
      if (error) throw error;
      setNewBudgetTitle("");
      setNewBudgetAmount("");
      toast.success("Budget added");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add budget");
    }
  }

  async function addExpense() {
    try {
      if (!newExpenseTitle.trim() || !newExpenseAmount) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("expenses").insert({
        title: newExpenseTitle.trim(),
        amount: Number(newExpenseAmount),
        budget_id: newExpenseBudgetId || null,
        paid_by: user.id,
        user_id: user.id,
      });
      if (error) throw error;
      setNewExpenseTitle("");
      setNewExpenseAmount("");
      toast.success("Expense added");
    } catch (e: any) {
      toast.error(e.message ?? "Could not add expense");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Expenses</h1>

      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Budgets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input placeholder="Title" value={newBudgetTitle} onChange={(e) => setNewBudgetTitle(e.target.value)} />
          <Input placeholder="Amount" inputMode="decimal" value={newBudgetAmount} onChange={(e) => setNewBudgetAmount(e.target.value)} />
          <Button onClick={addBudget} disabled={loading || !newBudgetTitle || !newBudgetAmount}>Add Budget</Button>
        </div>
        <div className="flex gap-2 overflow-x-auto py-2">
          <button className={`h-9 px-3 rounded border ${selectedBudgetId === "" ? "bg-muted" : ""}`} onClick={() => setSelectedBudgetId("")}>All</button>
          {budgets.map((b) => (
            <button key={b.id} className={`h-9 px-3 rounded border whitespace-nowrap ${selectedBudgetId === b.id ? "bg-muted" : ""}`} onClick={() => setSelectedBudgetId(b.id)}>
              {b.title}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="font-medium">Add Expense</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <Input placeholder="Title" value={newExpenseTitle} onChange={(e) => setNewExpenseTitle(e.target.value)} />
          <Input placeholder="Amount" inputMode="decimal" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} />
          <select className="border rounded-md h-9 px-2 text-sm" value={newExpenseBudgetId} onChange={(e) => setNewExpenseBudgetId(e.target.value)}>
            <option value="">No budget</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
          <Button onClick={addExpense} disabled={loading || !newExpenseTitle || !newExpenseAmount}>Add</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-medium">Summary</h2>
        <div className="text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-3 rounded border">
            <div className="text-muted-foreground">Budget</div>
            <div className="text-lg font-semibold">₹ {totals.budgetAmount.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-muted-foreground">Expenses</div>
            <div className="text-lg font-semibold">₹ {totals.totalExpense.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded border">
            <div className="text-muted-foreground">Balance</div>
            <div className="text-lg font-semibold">₹ {totals.balance.toFixed(2)}</div>
          </div>
        </div>
        <div className="text-sm">
          <div className="text-muted-foreground mb-1">Per-user overview</div>
          <div className="flex flex-wrap gap-2">
            {perUser.map((p) => (
              <div key={p.userId} className="px-2 py-1 rounded border text-xs">
                {p.userId.slice(0, 6)}: ₹ {p.total.toFixed(2)}
              </div>
            ))}
            {perUser.length === 0 && <div className="text-muted-foreground">No expenses yet</div>}
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="font-medium">Expenses</h2>
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            expenses
              .filter((e) => (selectedBudgetId ? e.budget_id === selectedBudgetId : true))
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
                  </div>
                  <div className="font-semibold">₹ {Number(e.amount).toFixed(2)}</div>
                </div>
              ))
          )}
        </div>
      </Card>
    </div>
  );
}


