"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteGame,
  deleteSku,
  saveGame,
  saveSku,
} from "@/actions/merchant.actions";
import type { GameWithSkus, Sku } from "@/lib/supabase-types";

const inputClass = "block w-full rounded border p-2";
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
              ? "保存成功"
              : "Saved"
            : zh
              ? "操作失败，请检查输入；有历史订单的商品无法删除。"
              : "Unable to save. Check input; products with order history cannot be deleted.",
        );
        if (result?.data?.success) {
          setEditing(null);
          router.refresh();
        }
      } catch {
        setMessage(zh ? "操作失败，请重试" : "Unable to save. Retry later.");
      }
    });
  }
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">
        {zh ? "游戏与商品" : "Games & products"}
      </h1>
      <form
        key={editing?.id ?? "new"}
        className="grid gap-3 rounded border p-5"
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
        <h2 className="text-xl">
          {editing
            ? zh
              ? "编辑游戏"
              : "Edit game"
            : zh
              ? "新增游戏"
              : "Add game"}
        </h2>
        {[
          ["en", zh ? "英文名称" : "English name", editing?.name.en],
          ["zh", zh ? "中文名称" : "Chinese name", editing?.name.zh],
          [
            "descEn",
            zh ? "英文介绍" : "English description",
            editing?.description?.en,
          ],
          [
            "descZh",
            zh ? "中文介绍" : "Chinese description",
            editing?.description?.zh,
          ],
          [
            "image",
            zh ? "封面 HTTPS 地址（可选）" : "Banner HTTPS URL (optional)",
            editing?.banner_url,
          ],
        ].map(([name, label, value]) => (
          <label key={name}>
            {label}
            <input
              name={String(name)}
              required={name !== "image"}
              defaultValue={value ?? ""}
              className={inputClass}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blue-600 p-2 text-white"
        >
          {zh ? "保存游戏" : "Save game"}
        </button>
        {editing && (
          <button type="button" onClick={() => setEditing(null)}>
            {zh ? "取消编辑" : "Cancel editing"}
          </button>
        )}
      </form>
      <output aria-live="polite">{message}</output>
      {games.map((game) => (
        <section key={game.id} className="space-y-4 rounded border p-5">
          <h2 className="text-xl font-bold">{game.name[locale]}</h2>
          <div className="flex gap-4">
            <button type="button" onClick={() => setEditing(game)}>
              {zh ? "编辑游戏" : "Edit game"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm(zh ? "确定删除游戏？" : "Delete this game?"))
                  perform(() => deleteGame({ id: game.id, locale }));
              }}
            >
              {zh ? "删除游戏" : "Delete game"}
            </button>
          </div>
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
          <SkuForm
            gameId={game.id}
            locale={locale}
            pending={pending}
            perform={perform}
          />
        </section>
      ))}
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
  return (
    <form
      className="grid gap-2 rounded bg-slate-50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        perform(() =>
          saveSku({
            id: sku?.id,
            game_id: gameId,
            locale,
            name: { en: String(f.get("en")), zh: String(f.get("zh")) },
            description: { en: String(f.get("de")), zh: String(f.get("dz")) },
            amount: Number(f.get("amount")),
            image_url: String(f.get("image")),
          }),
        );
      }}
    >
      <h3>
        {sku
          ? zh
            ? "编辑商品"
            : "Edit product"
          : zh
            ? "新增商品"
            : "New product"}
      </h3>
      {[
        ["en", zh ? "英文名称" : "English name", sku?.name.en],
        ["zh", zh ? "中文名称" : "Chinese name", sku?.name.zh],
        ["de", zh ? "英文描述" : "English description", sku?.description?.en],
        ["dz", zh ? "中文描述" : "Chinese description", sku?.description?.zh],
        [
          "image",
          zh ? "图片 HTTPS 地址（可选）" : "Image HTTPS URL (optional)",
          sku?.image_url,
        ],
      ].map(([name, label, value]) => (
        <label key={name}>
          {label}
          <input
            className={inputClass}
            name={String(name)}
            required={name !== "image"}
            defaultValue={value ?? ""}
          />
        </label>
      ))}
      <label>
        {zh
          ? "价格（美分，例如 1099 = $10.99）"
          : "Price (USD cents, e.g. 1099 = $10.99)"}
        <input
          className={inputClass}
          type="number"
          step="1"
          min="50"
          max="999999"
          name="amount"
          required
          defaultValue={sku?.prices.usd ?? 50}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 p-2 text-white"
      >
        {zh ? "保存商品" : "Save product"}
      </button>
      {sku && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(zh ? "确定删除商品？" : "Delete product?"))
              perform(() => deleteSku({ id: sku.id, game_id: gameId, locale }));
          }}
        >
          {zh ? "删除商品" : "Delete product"}
        </button>
      )}
    </form>
  );
}
