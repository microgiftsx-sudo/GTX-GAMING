import { getTranslations } from "next-intl/server";
import LegalDocument from "@/components/legal/LegalDocument";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LegalGuarantee" });
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

export default function GuaranteePage() {
  return <LegalDocument namespace="LegalGuarantee" />;
}
