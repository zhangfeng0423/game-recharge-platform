"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteGame,
  deleteSku,
  saveGame,
  saveSku,
} from "@/actions/merchant.actions";
import { generateRedeemCodesAction } from "@/actions/redeem.actions";
import type { GameWithSkus, Sku } from "@/lib/supabase-types";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white";

export function CatalogueEditor({
  games,
  locale,
}: {
  games: GameWithSkus[];
  locale: "en" | "zh";
}) {
  const router = useRouter();
  const zh = locale === "zh";
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<GameWithSkus | null>(null);

  function perform(
    task: () => Promise<
      | {
          data?: { success: boolean };
          serverError?: unknown;
          validationErrors?: unknown;
        }
      | undefined
    >,
  ) {
    start(async () => {
      try {
        const result = await task();
        setMessage(
          result?.data?.success
            ? zh
              ? "保存成功！"
              : "Saved successfully!"
            : zh
              ? "操作失败，请检查输入；有历史订单的商品无法删除。"
              : "Unable to save. Check input; products with order history cannot be deleted.",
        );
        if (result?.data?.success) {
          setEditing(null);
          router.refresh();
        }
      } catch {
        setMessage(zh ? "操作失败，请重试。" : "Unable to save. Retry later.");
      }
    });
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {zh ? "商品分类与规格管理" : "Products & SKUs Management"}
        </h1>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {zh
            ? "管理自营商品、规格（SKU）、即时自动发货内容及跨平台兑换码。"
            : "Manage products, SKUs, auto-fulfillment delivery notes, and redeem codes."}
        </p>
      </div>

      {message && (
        <output className="block rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
          {message}
        </output>
      )}

      {/* Game/Category Form */}
      <form
        key={editing?.id ?? "new"}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          perform(() =>
            saveGame({
              id: editing?.id,
              locale,
              name: { en: String(f.get("en")), zh: String(f.get("zh")) },
              description: {
                en: String(f.get("descEn")),
                zh: String(f.get("descZh")),
              },
              banner_url: String(f.get("image")),
            }),
          );
        }}
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          {editing
            ? zh
              ? "编辑分类商品"
              : "Edit Product Category"
            : zh
              ? "➕ 新增分类商品"
              : "➕ Add Product Category"}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "英文名称" : "English Name"}
            </span>
            <input
              name="en"
              required
              defaultValue={editing?.name.en ?? ""}
              className={inputClass}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "中文名称" : "Chinese Name"}
            </span>
            <input
              name="zh"
              required
              defaultValue={editing?.name.zh ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "英文介绍" : "English Description"}
            </span>
            <textarea
              name="descEn"
              rows={2}
              required
              defaultValue={editing?.description?.en ?? ""}
              className={inputClass}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "中文介绍" : "Chinese Description"}
            </span>
            <textarea
              name="descZh"
              rows={2}
              required
              defaultValue={editing?.description?.zh ?? ""}
              className={inputClass}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {zh
              ? "封面图片 HTTPS 链接（可选）"
              : "Banner Image HTTPS URL (optional)"}
          </span>
          <input
            name="image"
            defaultValue={editing?.banner_url ?? ""}
            placeholder="https://images.example.com/cover.jpg"
            className={inputClass}
          />
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {editing
              ? zh
                ? "保存修改"
                : "Save Changes"
              : zh
                ? "创建分类"
                : "Create Category"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              {zh ? "取消" : "Cancel"}
            </button>
          )}
        </div>
      </form>

      {/* Product List */}
      <div className="space-y-6">
        {games.map((game) => (
          <section
            key={game.id}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {game.name[locale] || game.name.en}
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  ID: {game.id} · {game.skus.length} {zh ? "个规格" : "SKUs"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(game)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                >
                  {zh ? "编辑分类" : "Edit"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        zh ? "确定删除此商品分类？" : "Delete this category?",
                      )
                    )
                      perform(() => deleteGame({ id: game.id, locale }));
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
                >
                  {zh ? "删除分类" : "Delete"}
                </button>
              </div>
            </div>

            {/* Existing SKUs */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                {zh ? "现有规格（SKU）列表" : "SKU List"}
              </h3>
              {game.skus.map((sku) => (
                <SkuForm
                  key={sku.id}
                  gameId={game.id}
                  locale={locale}
                  sku={sku}
                  pending={pending}
                  perform={perform}
                />
              ))}

              <div className="pt-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
                  {zh ? "➕ 新增规格（SKU）" : "➕ Add New SKU"}
                </h3>
                <SkuForm
                  gameId={game.id}
                  locale={locale}
                  pending={pending}
                  perform={perform}
                />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SkuForm({
  gameId,
  locale,
  sku,
  pending,
  perform,
}: {
  gameId: string;
  locale: "en" | "zh";
  sku?: Sku;
  pending: boolean;
  perform: (task: () => ReturnType<typeof saveSku>) => void;
}) {
  const zh = locale === "zh";
  const [deliveryMode, setDeliveryMode] = useState<
    "auto" | "manual" | "showcase"
  >((sku as any)?.delivery_mode || "auto");
  const [showRedeemGenerator, setShowRedeemGenerator] = useState(false);
  const [genCount, setGenCount] = useState(10);
  const [genNote, setGenNote] = useState("");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [genPending, startGen] = useTransition();

  const handleGenerateCodes = () => {
    if (!sku?.id) return;
    startGen(async () => {
      try {
        const res = await generateRedeemCodesAction({
          skuId: sku.id,
          count: genCount,
          batchNote: genNote || undefined,
          locale,
        });
        if (res.data?.success && res.data.codes) {
          setGeneratedCodes(res.data.codes);
        }
      } catch {
        alert(zh ? "生成失败，请重试" : "Generation failed");
      }
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-5 dark:border-gray-800 dark:bg-gray-800/40 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const priceDollars = parseFloat(String(f.get("priceDollars")));
          const amountCents = Math.round(priceDollars * 100);

          perform(() =>
            saveSku({
              id: sku?.id,
              game_id: gameId,
              locale,
              name: { en: String(f.get("en")), zh: String(f.get("zh")) },
              description: {
                en: String(f.get("de")),
                zh: String(f.get("dz")),
              },
              amount: amountCents,
              image_url: String(f.get("image")),
              delivery_mode: deliveryMode,
              auto_delivery_content: String(f.get("autoContent") ?? ""),
              external_url: String(f.get("externalUrl") ?? ""),
              requires_recipient_info: f.get("requiresInfo") === "on",
            }),
          );
        }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {sku ? (zh ? "编辑规格" : "Edit SKU") : zh ? "新规格" : "New SKU"}
          </span>
          {sku && (
            <button
              type="button"
              onClick={() => setShowRedeemGenerator(!showRedeemGenerator)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
            >
              <span>🎟️</span>
              <span>{zh ? "批量生成兑换码" : "Generate Redeem Codes"}</span>
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "英文名称" : "English Name"}
            </span>
            <input
              className={inputClass}
              name="en"
              required
              defaultValue={sku?.name.en ?? ""}
            />
          </label>
          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "中文名称" : "Chinese Name"}
            </span>
            <input
              className={inputClass}
              name="zh"
              required
              defaultValue={sku?.name.zh ?? ""}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "售价（美元，例如 9.99）" : "Price (USD, e.g. 9.99)"}
            </span>
            <input
              className={inputClass}
              type="number"
              step="0.01"
              min="0.50"
              max="9999.99"
              name="priceDollars"
              required
              defaultValue={
                sku?.prices.usd ? (sku.prices.usd / 100).toFixed(2) : "9.99"
              }
            />
          </label>

          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "交付模式" : "Delivery Mode"}
            </span>
            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value as any)}
              className={inputClass}
            >
              <option value="auto">
                {zh ? "⚡ 自动即时发货" : "⚡ Instant Auto Delivery"}
              </option>
              <option value="manual">
                {zh ? "🛠 人工处理履约" : "🛠 Manual Fulfillment"}
              </option>
              <option value="showcase">
                {zh ? "🔗 仅外链展示" : "🔗 Showcase Only"}
              </option>
            </select>
          </label>

          <label>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "规格图片 HTTPS 链接" : "SKU Image HTTPS URL"}
            </span>
            <input
              className={inputClass}
              name="image"
              defaultValue={sku?.image_url ?? ""}
              placeholder="https://..."
            />
          </label>
        </div>

        {deliveryMode === "auto" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh
                ? "自动发货内容（付款/兑换成功后即时展示给买家）"
                : "Auto-fulfillment Content (shown on payment/redeem)"}
              <textarea
                name="autoContent"
                rows={2}
                defaultValue={(sku as any)?.auto_delivery_content ?? ""}
                placeholder={
                  zh
                    ? "如：百度网盘链接、软件激活码、使用说明文档..."
                    : "e.g. Download links, activation codes, or instructions..."
                }
                className={inputClass}
              />
            </label>
          </div>
        )}

        {deliveryMode === "showcase" && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              {zh ? "外部购买/访问链接" : "External URL"}
              <input
                name="externalUrl"
                defaultValue={(sku as any)?.external_url ?? ""}
                placeholder="https://partner.example.com/product"
                className={inputClass}
              />
            </label>
          </div>
        )}

        {deliveryMode === "manual" && (
          <label className="flex items-center gap-2 pt-1 text-xs text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              name="requiresInfo"
              defaultChecked={(sku as any)?.requires_recipient_info ?? true}
            />
            <span>
              {zh
                ? "要求买家在结账时填写接收账号/区服信息"
                : "Require buyer to provide account/server info"}
            </span>
          </label>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {sku ? (zh ? "保存规格" : "Save SKU") : zh ? "添加规格" : "Add SKU"}
          </button>
          {sku && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(zh ? "确定删除此规格？" : "Delete product?"))
                  perform(() =>
                    deleteSku({ id: sku.id, game_id: gameId, locale }),
                  );
              }}
              className="rounded-lg border border-red-200 px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400"
            >
              {zh ? "删除规格" : "Delete"}
            </button>
          )}
        </div>
      </form>

      {/* Redeem Code Generation Drawer */}
      {showRedeemGenerator && sku && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-3">
          <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
            <span>🎟️</span>
            <span>
              {zh
                ? `批量生成兑换码 (${sku.name[locale] || sku.name.en})`
                : `Batch Redeem Codes for ${sku.name.en}`}
            </span>
          </h4>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs">
              <span className="text-gray-600 dark:text-gray-400 mr-2">
                {zh ? "生成张数:" : "Count:"}
              </span>
              <input
                type="number"
                min={1}
                max={200}
                value={genCount}
                onChange={(e) => setGenCount(parseInt(e.target.value, 10) || 1)}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-xs dark:bg-gray-800"
              />
            </label>
            <label className="text-xs flex-1 min-w-[150px]">
              <span className="text-gray-600 dark:text-gray-400 mr-2">
                {zh ? "批次备注:" : "Note:"}
              </span>
              <input
                type="text"
                placeholder={zh ? "如：闲鱼批次01" : "e.g. Marketplace batch 1"}
                value={genNote}
                onChange={(e) => setGenNote(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:bg-gray-800"
              />
            </label>
            <button
              type="button"
              disabled={genPending}
              onClick={handleGenerateCodes}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {genPending
                ? zh
                  ? "生成中…"
                  : "Generating…"
                : zh
                  ? "开始生成"
                  : "Generate"}
            </button>
          </div>

          {generatedCodes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                  {zh
                    ? `已生成 ${generatedCodes.length} 张兑换码：`
                    : `Generated ${generatedCodes.length} codes:`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCodes.join("\n"));
                    alert(zh ? "已复制全部兑换码！" : "Copied all codes!");
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  {zh ? "📋 一键复制全部" : "📋 Copy All"}
                </button>
              </div>
              <textarea
                readOnly
                rows={4}
                value={generatedCodes.join("\n")}
                className="w-full rounded-lg border border-gray-300 p-2 font-mono text-xs dark:bg-gray-900 select-all"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
