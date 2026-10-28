import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ width: string; height: string }> },
) {
  const { width, height } = await params;
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text") || `${width}x${height}`;

  // Parse width and height as numbers
  const w = parseInt(width, 10);
  const h = parseInt(height, 10);

  // Validate dimensions
  if (
    Number.isNaN(w) ||
    Number.isNaN(h) ||
    w <= 0 ||
    h <= 0 ||
    w > 2000 ||
    h > 2000
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid dimensions. Width and height must be numbers between 1 and 2000.",
      },
      { status: 400 },
    );
  }

  try {
    // Create a simple SVG placeholder
    const svg = `
      <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f3f4f6"/>
        <text
          x="50%"
          y="50%"
          font-family="Arial, sans-serif"
          font-size="${Math.min(w, h) / 10}"
          text-anchor="middle"
          dominant-baseline="middle"
          fill="#9ca3af"
        >
          ${text}
        </text>
      </svg>
    `;

    // Return SVG with proper headers
    return new NextResponse(svg.trim(), {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400", // Cache for 1 day
      },
    });
  } catch (error) {
    console.error("Error generating placeholder:", error);
    return NextResponse.json(
      { error: "Failed to generate placeholder image" },
      { status: 500 },
    );
  }
}
