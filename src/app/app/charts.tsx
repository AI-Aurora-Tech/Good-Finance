"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBRL } from "@/lib/format";

export function CategoryPie({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  if (!data.length) return <p className="py-16 text-center text-sm text-slate-500">Sem despesas neste mês.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2} stroke="#fff">
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatBRL(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBars({ data }: { data: Array<{ month: string; Receitas: number; Despesas: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} width={70} tickFormatter={(v) => formatBRL(v).replace(",00", "")} />
        <Tooltip formatter={(v) => formatBRL(Number(v))} cursor={{ fill: "#f1f5f9" }} />
        <Legend iconType="circle" />
        <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
