import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const admin = verifyAdminInitData(body.initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: { isActive: !task.isActive },
  });

  return NextResponse.json({ ok: true, task: updated });
}
