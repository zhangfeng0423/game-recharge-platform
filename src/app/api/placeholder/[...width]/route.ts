import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // 解析尺寸参数
  const pathParts = pathname.split("/");
  const width = parseInt(pathParts[pathParts.length - 2], 10) || 100;
  const height = parseInt(pathParts[pathParts.length - 1], 10) || 100;

  // 获取文本参数
  const textParam = request.nextUrl.searchParams.get("text") || "";

  // 创建一个简单的 SVG 占位符
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-size="14" fill="#6b7280">
        ${textParam || `${width}x${height}`}
      </text>
    </svg>
  `;

  return new NextResponse(svg.trim(), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400", // 缓存1天
    },
  });
}
