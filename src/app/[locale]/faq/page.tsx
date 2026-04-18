import { getTranslations } from "next-intl/server";
import LegalFaq from "@/components/legal/LegalFaq";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LegalFaq" });
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default function FaqPage() {
  return <LegalFaq />;
}
