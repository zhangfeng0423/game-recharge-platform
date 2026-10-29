import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { Sku } from "@/lib/supabase-types";
import { formatPrice } from "@/lib/utils";

interface SkuCardProps {
  sku: Sku;
  locale: string;
  onViewDetails: (sku: Sku) => void;
  translations: {
    popular: string;
    rechargeButton: string;
  };
}

export function SkuCard({
  sku,
  locale,
  onViewDetails,
  translations,
}: SkuCardProps) {
  const tCommon = useTranslations("common");
  // Get the localized SKU name and description
  const skuName = sku.name[locale as keyof typeof sku.name] || sku.name.en;
  const skuDescription = sku.description
    ? sku.description[locale as keyof typeof sku.description] ||
      sku.description.en
    : "";

  return (
    <div className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
      {/* SKU Image */}
      <div className="relative aspect-[1/1] overflow-hidden bg-gray-100 dark:bg-gray-700">
        {sku.image_url ? (
          <Image
            src={sku.image_url}
            alt={skuName}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 text-4xl">💎</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {tCommon("noImage")}
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {skuName}
          </h3>
          {skuDescription && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
              {skuDescription}
            </p>
          )}
        </div>

        {/* Price */}
        <div className="mb-4">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatPrice(sku.prices.usd, "usd", locale)}
          </p>
        </div>

        {/* Action Button - Following PRD prototype: "View Details" */}
        <Button
          className="w-full"
          onClick={() => onViewDetails(sku)}
          variant="outline"
        >
          {tCommon("viewDetails")}
        </Button>
      </div>
    </div>
  );
}
