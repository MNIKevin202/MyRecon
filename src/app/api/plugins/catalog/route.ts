import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { searchUmodCatalog } from "@/server/plugins/catalog";

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const perPage = Number(request.nextUrl.searchParams.get("perPage") ?? "20");
  const result = await searchUmodCatalog(query, page, perPage);
  return NextResponse.json({
    ...result,
    sources: ["uMod"],
  });
}
